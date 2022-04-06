// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title IBatcher
 * @notice A batcher to resolve hauler deposits/withdrawals in batches
 * @dev Provides an interface for Batcher
 */
interface IBatcher {
  /**
   * @notice Stores the deposits for future batching via periphery
   * @param amountIn Value of token to be deposited
   * @param signature signature verifying that depositor has enough karma and is authorized to deposit by brahma
   */
  function depositFunds(
    uint256 amountIn,
    bytes memory signature
  ) external;

  /**
   * @notice Stores the deposits for future batching via periphery
   * @param amountIn Value of Lp token to be deposited
   * @param signature signature verifying that depositor has enough karma and is authorized to deposit by brahma
   */
  function depositFundsInCurveLpToken(
    uint256 amountIn,
    bytes memory signature
  ) external;

  /**
   * @notice Allows user to withdraw LP tokens
   * @param amount Amount of LP tokens to withdraw
   * @param recipient Address to receive the LP tokens
   */
  function claimTokens(
    uint256 amount,
    address recipient
  ) external;

  /**
   * @notice Stores the deposits for future batching via periphery
   * @param amountOut Value of token to be deposited
   */
  function withdrawFunds(uint256 amountOut) external;

  /**
   * @notice Performs deposits on the periphery for the supplied users in batch
   * @param users array of users whose deposits must be resolved
   */
  function batchDeposit(address[] memory users) external;

  /**
   * @notice Performs withdraws on the periphery for the supplied users in batch
   * @param users array of users whose deposits must be resolved
   */
  function batchWithdraw(address[] memory users)
    external;

  /**
   * @notice To set a token address as the deposit token for a hauler
   * @param maxLimit max deposit limit on vault
   */
  function setHaulerLimit(uint256 maxLimit) external;


  /**
   * @notice To set slippage param for curve lp token conversion
   * @param slippage for curve lp token to usdc conversion
   */
  function setSlippage(uint256 slippage) external;
}
