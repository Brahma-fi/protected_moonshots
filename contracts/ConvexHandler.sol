// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../interfaces/IVault.sol";
import "../interfaces/IConvexHandler.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/ICurvePool.sol";
import "../interfaces/IHarvester.sol";

import "../library/Math.sol";

import "./solmate/ERC20.sol";
import "./solmate/SafeTransferLib.sol";

contract ConvexHandler is IConvexHandler {
  using SafeTransferLib for ERC20;

  enum UST3PoolCoinIndexes {
    DAI,
    USDC,
    USDT
  }

  // 0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A
  IConvexRewards public override baseRewardPool;
  // 0x890f4e345B1dAED0367A877a1612f86A1f86985f
  ICurvePool public override ust3Pool;

  IHarvester public override harvester;

  function approveRewardTokensToHarvester(address[] memory tokens)
    external
    override
  {
    require(msg.sender == _vault().governance(), "access :: Governance");

    for (uint256 idx = 0; idx < tokens.length; idx++) {
      ERC20(tokens[idx]).safeApprove(
        address(_vault().harvester()),
        type(uint256).max
      );
    }
  }

  function harvestRewards() external override returns (uint256) {
    _claimAndHarvest();

    return
      ERC20(ust3Pool.base_coins(uint256(UST3PoolCoinIndexes.USDC))).balanceOf(
        address(this)
      );
  }

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

    ERC20 usdc = ERC20(ust3Pool.base_coins(uint256(UST3PoolCoinIndexes.USDC)));
    uint256 usdcPriceInLpToken = 1 / _UST3WCRVPrice();
    uint256 usdcBalanceInLpToken = usdc.balanceOf(address(this)) *
      usdcPriceInLpToken;

    amountToWithdraw = Math.min(
      maxWithdraw,
      (stakedLpBalance + lpTokenBalance + usdcBalanceInLpToken)
    );

    if (amountToWithdraw > lpTokenBalance) {
      uint256 lpTokensUnstaked = 0;

      if (stakedLpBalance > 0) {
        lpTokensUnstaked =
          amountToWithdraw -
          lpTokenBalance -
          usdcBalanceInLpToken;

        require(
          baseRewardPool.withdraw(lpTokensUnstaked, true),
          "could not unstake"
        );
      }

      uint256 usdcBalanceToConvert = amountToWithdraw -
        lpTokenBalance -
        lpTokensUnstaked;

      if (usdcBalanceToConvert > 0) {
        uint256 usdcToDeposit = usdcBalanceToConvert / usdcBalanceInLpToken;
        uint256[3] memory liquidityAmounts = [usdcToDeposit, 0, 0];

        usdc.safeApprove(address(ust3Pool), usdcToDeposit);
        ust3Pool.add_liquidity(liquidityAmounts, usdcBalanceInLpToken);
      }
    }
  }

  function _claimAndHarvest() internal {
    require(baseRewardPool.getReward(), "reward claim failed");
    harvester.harvest();
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
