// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IBatcher.sol";
import "../../interfaces/IVault.sol";
import "../ConvexExecutor/interfaces/ICurvePool.sol";
import "../ConvexExecutor/interfaces/ICurveDepositZapper.sol";

import "./EIP712.sol";

/// @title Batcher
/// @author 0xAd1
/// @notice Used to batch user deposits and withdrawals until the next rebalance
contract Batcher is Ownable, IBatcher, EIP712 {
  using SafeERC20 for IERC20;

  uint256 DUST_LIMIT = 10000;

  struct Vault {
    address tokenAddress;
    uint256 maxAmount;
    uint256 currentAmount;
  }

  mapping(address => Vault) public vaults;

  mapping(address => mapping(address => uint256)) public depositLedger;
  mapping(address => mapping(address => uint256)) public withdrawLedger;

  event DepositRequest(
    address indexed sender,
    address indexed vault,
    uint256 amountIn
  );
  event WithdrawRequest(
    address indexed sender,
    address indexed vault,
    uint256 amountOut
  );

  address public verificationAuthority;
  address public governance;
  address public pendingGovernance;
  uint256 public slippageForCurveLp = 30;

  constructor(address _verificationAuthority, address _governance) {
    verificationAuthority = _verificationAuthority;
    governance = _governance;
  }

  function setAuthority(address authority) public onlyGovernance {
    verificationAuthority = authority;
  }

  /// @inheritdoc IBatcher
  function depositFunds(
    uint256 amountIn,
    address vaultAddress,
    bytes memory signature
  ) external override validDeposit(vaultAddress, signature) {
    require(
      IERC20(vaults[vaultAddress].tokenAddress).allowance(
        msg.sender,
        address(this)
      ) >= amountIn,
      "No allowance"
    );

    IERC20(vaults[vaultAddress].tokenAddress).safeTransferFrom(
      msg.sender,
      address(this),
      amountIn
    );

    vaults[vaultAddress].currentAmount += amountIn;
    require(
      vaults[vaultAddress].currentAmount <= vaults[vaultAddress].maxAmount,
      "Exceeded deposit limit"
    );

    _completeDeposit(vaultAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function depositFundsInCurveLpToken(
    uint256 amountIn,
    address vaultAddress,
    bytes memory signature
  ) external override validDeposit(vaultAddress, signature) {
    /// Curve Lp Token - UST_Wormhole
    IERC20 lpToken = IERC20(0xCEAF7747579696A2F0bb206a14210e3c9e6fB269);

    require(
      lpToken.allowance(msg.sender, address(this)) >= amountIn,
      "No allowance"
    );

    lpToken.safeTransferFrom(msg.sender, address(this), amountIn);

    uint256 usdcReceived = _convertLpTokenIntoUSDC(lpToken);

    _completeDeposit(vaultAddress, usdcReceived);
  }

  function _completeDeposit(address vaultAddress, uint256 amountIn) internal {
    depositLedger[vaultAddress][msg.sender] =
      depositLedger[vaultAddress][msg.sender] +
      (amountIn);

    emit DepositRequest(msg.sender, vaultAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function withdrawFunds(uint256 amountIn, address vaultAddress)
    external
    override
  {
    require(
      vaults[vaultAddress].tokenAddress != address(0),
      "Invalid vault address"
    );

    require(
      depositLedger[vaultAddress][msg.sender] == 0,
      "Cannot withdraw funds from vault while waiting to deposit"
    );

    // require(depositLedger[vaultAddress][msg.sender] >= amountOut, "No funds available");

    IERC20(vaultAddress).safeTransferFrom(msg.sender, address(this), amountIn);

    withdrawLedger[vaultAddress][msg.sender] =
      withdrawLedger[vaultAddress][msg.sender] +
      (amountIn);

    vaults[vaultAddress].currentAmount -= amountIn;

    emit WithdrawRequest(msg.sender, vaultAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function batchDeposit(address vaultAddress, address[] memory users)
    external
    override
    onlyOwner
  {
    IVault vault = IVault(vaultAddress);

    uint256 amountToDeposit = 0;
    uint256 oldLPBalance = IERC20(address(vault)).balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      amountToDeposit =
        amountToDeposit +
        (depositLedger[vaultAddress][users[i]]);
    }

    require(amountToDeposit > 0, "no deposits to make");

    uint256 lpTokensReportedByvault = vault.deposit(
      amountToDeposit,
      address(this)
    );

    uint256 lpTokensReceived = IERC20(address(vault)).balanceOf(address(this)) -
      (oldLPBalance);

    require(
      lpTokensReceived == lpTokensReportedByvault,
      "LP tokens received by vault does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = depositLedger[vaultAddress][users[i]];
      if (userAmount > 0) {
        uint256 userShare = (userAmount * (lpTokensReceived)) /
          (amountToDeposit);
        IERC20(address(vault)).safeTransfer(users[i], userShare);
        depositLedger[vaultAddress][users[i]] = 0;
      }
    }
  }

  /// @inheritdoc IBatcher
  function batchWithdraw(address vaultAddress, address[] memory users)
    external
    override
    onlyOwner
  {
    IVault vault = IVault(vaultAddress);

    IERC20 token = IERC20(vaults[vaultAddress].tokenAddress);

    uint256 amountToWithdraw = 0;
    uint256 oldWantBalance = token.balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      amountToWithdraw =
        amountToWithdraw +
        (withdrawLedger[vaultAddress][users[i]]);
    }

    require(amountToWithdraw > 0, "no deposits to make");

    uint256 wantTokensReportedByvault = vault.withdraw(
      amountToWithdraw,
      address(this)
    );

    uint256 wantTokensReceived = token.balanceOf(address(this)) -
      (oldWantBalance);

    require(
      wantTokensReceived == wantTokensReportedByvault,
      "Want tokens received by vault does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = withdrawLedger[vaultAddress][users[i]];
      if (userAmount > 0) {
        uint256 userShare = (userAmount * wantTokensReceived) /
          amountToWithdraw;
        token.safeTransfer(users[i], userShare);

        withdrawLedger[vaultAddress][users[i]] = 0;
      }
    }
  }

  /// @inheritdoc IBatcher
  function setVaultParams(
    address vaultAddress,
    address token,
    uint256 maxLimit
  ) external override onlyOwner {
    require(vaultAddress != address(0), "Invalid vault address");
    require(token != address(0), "Invalid token address");
    // (, , IERC20Metadata token0, IERC20Metadata token1) = _getVault(vaultAddress);
    // require(address(token0) == token || address(token1) == token, 'wrong token address');
    vaults[vaultAddress] = Vault({
      tokenAddress: token,
      maxAmount: maxLimit,
      currentAmount: 0
    });

    IERC20(token).approve(vaultAddress, type(uint256).max);
  }

  /**
   * @notice Get the balance of a token in contract
   * @param token token whose balance needs to be returned
   * @return balance of a token in contract
   */
  function _tokenBalance(IERC20Metadata token) internal view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function sweep(address _token) public onlyGovernance {
    IERC20(_token).transfer(
      msg.sender,
      IERC20(_token).balanceOf(address(this))
    );
  }

  function setGovernance(address _governance) external onlyGovernance {
    pendingGovernance = _governance;
  }

  function acceptGovernance() external {
    require(
      msg.sender == pendingGovernance,
      "Only pending governance can accept"
    );
    governance = pendingGovernance;
  }

  /// @notice Helper to convert Lp tokens into USDC
  /// @dev Burns LpTokens on UST3-Wormhole pool on curve to get USDC
  /// @param lpToken Curve Lp Token
  function _convertLpTokenIntoUSDC(IERC20 lpToken)
    internal
    returns (uint256 receivedWantTokens)
  {
    uint256 MAX_BPS = 10000;

    ICurvePool ust3Pool = ICurvePool(
      0xCEAF7747579696A2F0bb206a14210e3c9e6fB269
    );
    ICurveDepositZapper curve3PoolZap = ICurveDepositZapper(
      0xA79828DF1850E8a3A3064576f380D90aECDD3359
    );

    uint256 _amount = lpToken.balanceOf(address(this));

    lpToken.safeApprove(address(curve3PoolZap), _amount);

    int128 usdcIndexInPool = int128(int256(uint256(2)));

    // estimate amount of USDC received on burning Lp tokens
    uint256 expectedWantTokensOut = curve3PoolZap.calc_withdraw_one_coin(
      address(ust3Pool),
      _amount,
      usdcIndexInPool
    );
    // burn Lp tokens to receive USDC with a slippage of 0.3%
    receivedWantTokens = curve3PoolZap.remove_liquidity_one_coin(
      address(ust3Pool),
      _amount,
      usdcIndexInPool,
      (expectedWantTokensOut * (MAX_BPS - slippageForCurveLp)) / (MAX_BPS)
    );
  }

  function setSlippage(uint256 _slippage) external override onlyOwner {
    require(_slippage <= 10000, "Slippage must be between 0 and 10000");
    slippageForCurveLp = _slippage;
  }

  modifier onlyGovernance() {
    require(governance == msg.sender, "Only governance can call this");
    _;
  }

  modifier validDeposit(address vaultAddress, bytes memory signature) {
    require(
      verifySignatureAgainstAuthority(signature, verificationAuthority),
      "Signature is not valid"
    );

    require(
      vaults[vaultAddress].tokenAddress != address(0),
      "Invalid vault address"
    );

    require(
      withdrawLedger[vaultAddress][msg.sender] == 0,
      "Cannot deposit funds to vault while waiting to withdraw"
    );

    _;
  }
}
