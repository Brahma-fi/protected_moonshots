// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "./IConvexRewards.sol";
import "./ICurvePool.sol";
import "./IHarvester.sol";

interface IConvexHandler {
  function baseRewardPool() external view returns (IConvexRewards);

  function ust3Pool() external view returns (ICurvePool);

  function harvester() external view returns (IHarvester);
}
