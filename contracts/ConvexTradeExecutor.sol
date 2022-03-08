//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./BaseTradeExecutor.sol";
import { ConvexPositionHandler } from "./ConvexExecutor/ConvexPositionHandler.sol";

contract ConvexTradeExecutor is BaseTradeExecutor, ConvexPositionHandler {
  constructor(
    address _baseRewardPool,
    address _ust3Pool,
    address _token,
    address _lpToken,
    address _harvester,
    address _governance,
    address _keeper
  ) {
    _initHandler(
      _baseRewardPool,
      _ust3Pool,
      _token,
      _lpToken,
      _harvester,
      _governance,
      _keeper
    );
  }

  function setHandler(
    address _baseRewardPool,
    address _ust3Pool,
    address _token,
    address _lpToken,
    address _harvester,
    address _governance,
    address _keeper
  ) external onlyGovernance {
    _initHandler(
      _baseRewardPool,
      _ust3Pool,
      _token,
      _lpToken,
      _harvester,
      _governance,
      _keeper
    );
  }

  function openPosition(bytes calldata _data) public onlyKeeper {
    _openPosition(_data);
  }

  function closePosition(bytes calldata _data) public onlyKeeper {
    _closePosition(_data);
  }

  function claimRewards(bytes calldata _data) public onlyKeeper {
    _claimRewards(_data);
  }

  function totalFunds() public view override returns (uint256, uint256) {
    return positionInWantToken();
  }

  function _initateDeposit(bytes calldata _data) internal override {
    _deposit(_data);
  }

  function _initiateWithdraw(bytes calldata _data) internal override {
    _withdraw(_data);
  }

  function _confirmDeposit() internal override {}

  function _confirmWithdraw() internal override {}
}
