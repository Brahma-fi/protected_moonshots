// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../interfaces/IVault.sol";
import "../interfaces/IConvexHandler.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/ICurvePool.sol";

import "../library/Math.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract ConvexHandler is IConvexHandler {
  enum UST3PoolCoinIndexes {
    DAI,
    USDC,
    USDT
  }

  // 0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A
  IConvexRewards public override baseRewardPool;
  // 0xCEAF7747579696A2F0bb206a14210e3c9e6fB269
  ICurvePool public override ust3Pool;

  function _depositToConvex(uint256 _amount) internal {
    require(
      _vault().token().balanceOf(address(this)) >= _amount,
      "insufficient balance"
    );
    require(baseRewardPool.stake(_amount), "convex staking failed");
  }

  function _calcAmountsAndUnstake(uint256 maxWithdraw)
    internal
    returns (uint256 amountToWithdraw)
  {
    uint256 stakedLpBalance = baseRewardPool.balanceOf(address(this));
    uint256 lpTokenBalance = _vault().token().balanceOf(address(this));

    uint256 usdcBalance = IERC20Metadata(
      ust3Pool.base_coins(uint256(UST3PoolCoinIndexes.USDC))
    ).balanceOf(address(this));
    uint256 usdcPriceInLpToken = 1 / _UST3WCRVPrice();
    uint256 usdcBalanceInLpToken = usdcBalance * usdcPriceInLpToken;

    amountToWithdraw = Math.min(
      maxWithdraw,
      (stakedLpBalance + lpTokenBalance + usdcBalanceInLpToken)
    );

    if (amountToWithdraw > lpTokenBalance) {
      if (stakedLpBalance > 0) {
        require(
          baseRewardPool.withdraw(
            amountToWithdraw - lpTokenBalance - usdcBalanceInLpToken,
            true
          ),
          "could not unstake"
        );
      }

      uint256 usdcBalanceToConvert = amountToWithdraw -
        lpTokenBalance -
        stakedLpBalance;

      if (usdcBalanceToConvert > 0) {
        uint256 usdcToDeposit = usdcBalanceToConvert / usdcBalanceInLpToken;
        uint256[3] memory liquidityAmounts = [usdcToDeposit, 0, 0];

        ust3Pool.add_liquidity(liquidityAmounts, usdcBalanceInLpToken);
      }
    }
  }

  function _UST3WCRVBalance() internal view returns (uint256) {
    return
      _vault().token().balanceOf(address(this)) +
      baseRewardPool.balanceOf(address(this));
  }

  function _UST3WCRVPrice() internal view returns (uint256) {
    return ust3Pool.get_virtual_price();
  }

  function _vault() internal view returns (IVault) {
    return IVault(address(this));
  }
}
