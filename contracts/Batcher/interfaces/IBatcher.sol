// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title IBatcher
 * @notice A batcher to resolve hauler deposits/withdrawals in batches
 * @dev Provides an interface for Batcher
 */
interface IBatcher {

  /// @notice Data structure to store vault info
  /// @param vaultAddress Address of the vault
  /// @param tokenAddress Address vault's want token
  /// @param maxAmount Max amount of tokens to deposit in vault
  /// @param currentAmount Current amount of wantTokens deposited in the vault
  struct VaultInfo {
    address vaultAddress;
    address tokenAddress;
    uint256 maxAmount;
    uint256 currentAmount;
  }

  /// @notice Deposit event
  /// @param sender Address of the depositor
  /// @param hauler Address of the hauler
  /// @param amountIn Tokens deposited
  event DepositRequest(
    address indexed sender,
    address indexed hauler,
    uint256 amountIn
  );

  /// @notice Withdraw event
  /// @param sender Address of the withdawer
  /// @param hauler Address of the hauler
  /// @param amountOut Tokens deposited
  event WithdrawRequest(
    address indexed sender,
    address indexed hauler,
    uint256 amountOut
  );


  function depositFunds(
    uint256 amountIn,
    bytes memory signature
  ) external;


  function depositFundsInCurveLpToken(
    uint256 amountIn,
    bytes memory signature
  ) external;


  function claimTokens(
    uint256 amount,
    address recipient
  ) external;


  function withdrawFunds(uint256 amountOut) external;


  function batchDeposit(address[] memory users) external;


  function batchWithdraw(address[] memory users)
    external;


  function setHaulerLimit(uint256 maxLimit) external;

  function setSlippage(uint256 slippage) external;
}
