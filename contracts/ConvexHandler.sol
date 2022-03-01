// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../interfaces/IVault.sol";
import "../interfaces/IConvexHandler.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/ICurvePool.sol";

import "../library/Math.sol";

contract ConvexHandler is IConvexHandler {
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

    amountToWithdraw = Math.min(
      maxWithdraw,
      (stakedLpBalance + lpTokenBalance)
    );

    if (amountToWithdraw > lpTokenBalance) {
      require(
        baseRewardPool.withdraw(amountToWithdraw - lpTokenBalance, true),
        "could not unstake"
      );
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
