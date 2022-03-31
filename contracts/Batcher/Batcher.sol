// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IBatcher.sol";
import "../../interfaces/IHauler.sol";
import "../ConvexExecutor/interfaces/ICurvePool.sol";
import "../ConvexExecutor/interfaces/ICurveDepositZapper.sol";

import "./EIP712.sol";

/// @title Batcher
/// @author 0xAd1
/// @notice Used to batch user deposits and withdrawals until the next rebalance
contract Batcher is IBatcher, EIP712, ReentrancyGuard {
  using SafeERC20 for IERC20;

  uint256 DUST_LIMIT = 10000;

  struct VaultInfo {
    address vaultAddress;
    address tokenAddress;
    uint256 maxAmount;
    uint256 currentAmount;
  }

  // mapping(address => Vault) public vaults;
  VaultInfo public vaultInfo;

  mapping(address => uint256) public depositLedger;
  mapping(address => uint256) public withdrawLedger;

  mapping(address => uint256) public userTokens;

  mapping(address => bool) private processedAddresses;

  event DepositRequest(
    address indexed sender,
    address indexed hauler,
    uint256 amountIn
  );
  event WithdrawRequest(
    address indexed sender,
    address indexed hauler,
    uint256 amountOut
  );

  address public verificationAuthority;
  address public governance;
  address public pendingGovernance;
  uint256 public slippageForCurveLp = 30;

  constructor(address _verificationAuthority, address _governance, address haulerAddress, uint256 maxAmount) {
    verificationAuthority = _verificationAuthority;
    governance = _governance;
  
    require (haulerAddress != address(0), 'Invalid hauler address');
    vaultInfo = VaultInfo({
      vaultAddress: haulerAddress,
      tokenAddress: IHauler(haulerAddress).wantToken(),
      maxAmount: maxAmount,
      currentAmount: 0
    });

    IERC20(vaultInfo.tokenAddress).approve(haulerAddress, type(uint256).max);
  }

  function setAuthority(address authority) public onlyGovernance {
    verificationAuthority = authority;
  }

  /// @inheritdoc IBatcher
  function depositFunds(
    uint256 amountIn,
    bytes memory signature
  ) external override validDeposit(signature) nonReentrant {

    IERC20(vaultInfo.tokenAddress).safeTransferFrom(
      msg.sender,
      address(this),
      amountIn
    );

    vaultInfo.currentAmount += amountIn;
    require(
      vaultInfo.currentAmount <= vaultInfo.maxAmount,
      "Exceeded deposit limit"
    );

    _completeDeposit(amountIn);
  }

  /// @inheritdoc IBatcher
  function depositFundsInCurveLpToken(
    uint256 amountIn,
    bytes memory signature
  ) external override validDeposit(signature) nonReentrant {
    /// Curve Lp Token - UST_Wormhole
    IERC20 lpToken = IERC20(0xCEAF7747579696A2F0bb206a14210e3c9e6fB269);

    lpToken.safeTransferFrom(msg.sender, address(this), amountIn);

    uint256 usdcReceived = _convertLpTokenIntoUSDC(lpToken);

    _completeDeposit(usdcReceived);
  }

  function _completeDeposit(uint256 amountIn) internal {
    depositLedger[msg.sender] =
      depositLedger[msg.sender] +
      (amountIn);

    emit DepositRequest(msg.sender, vaultInfo.vaultAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function withdrawFunds(uint256 amountIn)
    external
    override
    nonReentrant
  {

    require(
      depositLedger[msg.sender] == 0,
      "Cannot withdraw funds from hauler while waiting to deposit"
    );


    if (amountIn > userTokens[msg.sender]) {
      IERC20(vaultInfo.vaultAddress).safeTransferFrom(msg.sender, address(this), amountIn - userTokens[msg.sender]);
      userTokens[msg.sender] = 0;
    } else {
      userTokens[msg.sender] = userTokens[msg.sender] - amountIn;
    }
    
    

    withdrawLedger[msg.sender] =
      withdrawLedger[msg.sender] +
      (amountIn);

    vaultInfo.currentAmount -= amountIn;

    emit WithdrawRequest(msg.sender, vaultInfo.vaultAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function batchDeposit(address[] memory users)
    external
    override
    nonReentrant
  {
    onlyKeeper();
    IHauler hauler = IHauler(vaultInfo.vaultAddress);

    uint256 amountToDeposit = 0;
    uint256 oldLPBalance = IERC20(address(hauler)).balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      if (!processedAddresses[users[i]]) {
        amountToDeposit =
          amountToDeposit +
          (depositLedger[users[i]]);
        processedAddresses[users[i]] = true;
      }
    }

    require(amountToDeposit > 0, "no deposits to make");

    uint256 lpTokensReportedByHauler = hauler.deposit(
      amountToDeposit,
      address(this)
    );

    uint256 lpTokensReceived = IERC20(address(hauler)).balanceOf(
      address(this)
    ) - (oldLPBalance);

    require(
      lpTokensReceived == lpTokensReportedByHauler,
      "LP tokens received by hauler does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = depositLedger[users[i]];
      if (processedAddresses[users[i]]) {
        if (userAmount > 0) {
          uint256 userShare = (userAmount * (lpTokensReceived)) /
            (amountToDeposit);
          userTokens[users[i]] = userTokens[users[i]] + userShare;
          depositLedger[users[i]] = 0;
        }
        processedAddresses[users[i]] = false;
      }
    }
  }

  /// @inheritdoc IBatcher
  function claimTokens(uint256 amount, address recipient) public override nonReentrant{
    require(userTokens[msg.sender] >= amount, "No funds available");
    userTokens[msg.sender] = userTokens[msg.sender] - amount;
    IERC20(vaultInfo.vaultAddress).safeTransfer(recipient, amount);
  }

  /// @inheritdoc IBatcher
  function batchWithdraw(address[] memory users)
    external
    override
    nonReentrant
  {
    onlyKeeper();
    IHauler hauler = IHauler(vaultInfo.vaultAddress);

    IERC20 token = IERC20(vaultInfo.tokenAddress);

    uint256 amountToWithdraw = 0;
    uint256 oldWantBalance = token.balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      if (!processedAddresses[users[i]]) {
        amountToWithdraw =
          amountToWithdraw +
          (withdrawLedger[users[i]]);
        processedAddresses[users[i]] = true;
      }
    }

    require(amountToWithdraw > 0, "no deposits to make");

    uint256 wantTokensReportedByHauler = hauler.withdraw(
      amountToWithdraw,
      address(this)
    );

    uint256 wantTokensReceived = token.balanceOf(address(this)) -
      (oldWantBalance);

    require(
      wantTokensReceived == wantTokensReportedByHauler,
      "Want tokens received by hauler does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = withdrawLedger[users[i]];
      if (processedAddresses[users[i]]) {
        if (userAmount > 0) {
          uint256 userShare = (userAmount * wantTokensReceived) /
            amountToWithdraw;
          token.safeTransfer(users[i], userShare);

          withdrawLedger[users[i]] = 0;
        }
        processedAddresses[users[i]] = false;
      }
    }
  }

  /// @inheritdoc IBatcher
  function setHaulerLimit(uint256 maxAmount) external override {
    onlyKeeper();
    vaultInfo.maxAmount = maxAmount;
  }

  function sweep(address _token) public onlyGovernance nonReentrant{
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

  function keeper() public view returns (address) {
    require(vaultInfo.vaultAddress != address(0), "Hauler not set");
    return IHauler(vaultInfo.vaultAddress).keeper();
  }



  function setSlippage(uint256 _slippage) external override {
    onlyKeeper();
    require(_slippage <= 10000, "Slippage must be between 0 and 10000");
    slippageForCurveLp = _slippage;
  }

  modifier onlyGovernance() {
    require(governance == msg.sender, "Only governance can call this");
    _;
  }

  function onlyKeeper() internal view {
    require(msg.sender == keeper(), "Only keeper can call this function");
  }

  modifier validDeposit(bytes memory signature) {
    require(
      verifySignatureAgainstAuthority(signature, verificationAuthority),
      "Signature is not valid"
    );

    require(
      withdrawLedger[msg.sender] == 0,
      "Cannot deposit funds to hauler while waiting to withdraw"
    );

    _;
  }
}
