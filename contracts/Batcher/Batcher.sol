// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/IMetaRouter.sol";
import "./interfaces/IBatcher.sol";

import "./EIP712.sol";

/// @title Batcher
/// @author 0xAd1
/// @notice Used to batch user deposits and withdrawals until the next rebalance
contract Batcher is Ownable, IBatcher, EIP712 {
  using SafeERC20 for IERC20;

  uint256 DUST_LIMIT = 10000;

  mapping(address => address) public tokenAddress;

  mapping(address => mapping(address => uint256)) public depositLedger;
  mapping(address => mapping(address => uint256)) public withdrawLedger;

  event DepositRequest(
    address indexed sender,
    address indexed router,
    uint256 amountIn
  );
  event WithdrawRequest(
    address indexed sender,
    address indexed router,
    uint256 amountOut
  );

  address public verificationAuthority;
  address public governance;
  address public pendingGovernance;

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
    address routerAddress,
    bytes memory signature
  ) external override {
    require(
      verifySignatureAgainstAuthority(signature, verificationAuthority),
      "Signature is not valid"
    );

    require(
      tokenAddress[routerAddress] != address(0),
      "Invalid router address"
    );

    require(
      withdrawLedger[routerAddress][msg.sender] == 0,
      "Cannot deposit funds to router while waiting to withdraw"
    );

    require(
      IERC20(tokenAddress[routerAddress]).allowance(
        msg.sender,
        address(this)
      ) >= amountIn,
      "No allowance"
    );

    IERC20(tokenAddress[routerAddress]).safeTransferFrom(
      msg.sender,
      address(this),
      amountIn
    );

    depositLedger[routerAddress][msg.sender] =
      depositLedger[routerAddress][msg.sender] +
      (amountIn);

    emit DepositRequest(msg.sender, routerAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function withdrawFunds(uint256 amountIn, address routerAddress)
    external
    override
  {
    require(
      tokenAddress[routerAddress] != address(0),
      "Invalid router address"
    );

    require(
      depositLedger[routerAddress][msg.sender] == 0,
      "Cannot withdraw funds from router while waiting to deposit"
    );

    // require(depositLedger[routerAddress][msg.sender] >= amountOut, "No funds available");

    IERC20(routerAddress).safeTransferFrom(msg.sender, address(this), amountIn);

    withdrawLedger[routerAddress][msg.sender] =
      withdrawLedger[routerAddress][msg.sender] +
      (amountIn);

    emit WithdrawRequest(msg.sender, routerAddress, amountIn);
  }

  /// @inheritdoc IBatcher
  function batchDeposit(address routerAddress, address[] memory users)
    external
    override
    onlyOwner
  {
    IMetaRouter router = IMetaRouter(routerAddress);

    uint256 amountToDeposit = 0;
    uint256 oldLPBalance = IERC20(address(router)).balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      amountToDeposit =
        amountToDeposit +
        (depositLedger[routerAddress][users[i]]);
    }

    require(amountToDeposit > 0, "no deposits to make");

    uint256 lpTokensReportedByRouter = router.deposit(
      amountToDeposit,
      address(this)
    );

    uint256 lpTokensReceived = IERC20(address(router)).balanceOf(
      address(this)
    ) - (oldLPBalance);

    require(
      lpTokensReceived == lpTokensReportedByRouter,
      "LP tokens received by router does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = depositLedger[routerAddress][users[i]];
      if (userAmount > 0) {
        uint256 userShare = (userAmount * (lpTokensReceived)) /
          (amountToDeposit);
        IERC20(address(router)).safeTransfer(users[i], userShare);

        // uint tokenLeftShare = userAmount * (tokenLeft) / (amountToDeposit);
        // if (tokenLeftShare > DUST_LIMIT) {
        //     token.safeTransfer(users[i], tokenLeftShare);

        // }
        depositLedger[routerAddress][users[i]] = 0;
      }
    }
  }

  /// @inheritdoc IBatcher
  function batchWithdraw(address routerAddress, address[] memory users)
    external
    override
    onlyOwner
  {
    IMetaRouter router = IMetaRouter(routerAddress);

    IERC20 token = IERC20(tokenAddress[routerAddress]);

    uint256 amountToWithdraw = 0;
    uint256 oldWantBalance = token.balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      amountToWithdraw =
        amountToWithdraw +
        (withdrawLedger[routerAddress][users[i]]);
    }

    require(amountToWithdraw > 0, "no deposits to make");

    uint256 wantTokensReportedByRouter = router.withdraw(
      amountToWithdraw,
      address(this)
    );

    uint256 wantTokensReceived = token.balanceOf(address(this)) -
      (oldWantBalance);

    require(
      wantTokensReceived == wantTokensReportedByRouter,
      "Want tokens received by router does not match"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = withdrawLedger[routerAddress][users[i]];
      if (userAmount > 0) {
        uint256 userShare = (userAmount * (wantTokensReceived)) /
          (amountToWithdraw);
        token.safeTransfer(users[i], userShare);

        // uint tokenLeftShare = userAmount * (tokenLeft) / (amountToWithdraw);
        // if (tokenLeftShare > DUST_LIMIT) {
        //     token.safeTransfer(users[i], tokenLeftShare);

        // }
        withdrawLedger[routerAddress][users[i]] = 0;
      }
    }
  }

  /// @inheritdoc IBatcher
  function setRouterTokenAddress(address routerAddress, address token)
    external
    override
    onlyOwner
  {
    // (, , IERC20Metadata token0, IERC20Metadata token1) = _getVault(routerAddress);
    // require(address(token0) == token || address(token1) == token, 'wrong token address');
    tokenAddress[routerAddress] = token;

    IERC20(token).approve(routerAddress, type(uint256).max);
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

  modifier onlyGovernance() {
    require(governance == msg.sender, "Only governance can call this");
    _;
  }
}
