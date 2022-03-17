//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./BaseTradeExecutor.sol";
import {ConvexPositionHandler} from "./ConvexExecutor/ConvexPositionHandler.sol";

contract ConvexTradeExecutor is BaseTradeExecutor, ConvexPositionHandler {
    constructor(
        address _baseRewardPool,
        address _convexBooster,
        address _ust3Pool,
        address _curve3PoolZap,
        address _harvester,
        address _hauler
    ) BaseTradeExecutor(_hauler) {
        ConvexPositionHandler._configHandler(
            _baseRewardPool,
            _convexBooster,
            _ust3Pool,
            _curve3PoolZap,
            haulerWantToken(),
            _harvester
        );
    }

    function setHandler(
        address _baseRewardPool,
        address _convexBooster,
        address _ust3Pool,
        address _curve3PoolZap,
        address _harvester
    ) external onlyGovernance {
        ConvexPositionHandler._configHandler(
            _baseRewardPool,
            _convexBooster,
            _ust3Pool,
            _curve3PoolZap,
            haulerWantToken(),
            _harvester
        );
    }

    function setSlippage(uint256 _slippage) external onlyKeeper {
        ConvexPositionHandler._setSlippage(_slippage);
    }

    function openPosition(bytes calldata _data) public onlyKeeper {
        ConvexPositionHandler._openPosition(_data);
    }

    function closePosition(bytes calldata _data) public onlyKeeper {
        ConvexPositionHandler._closePosition(_data);
    }

    function claimRewards(bytes calldata _data) public onlyKeeper {
        ConvexPositionHandler._claimRewards(_data);
    }

    function totalFunds() public view override returns (uint256, uint256) {
        return positionInWantToken();
    }

    function _initateDeposit(bytes calldata _data) internal override {
        ConvexPositionHandler._deposit(_data);
        BaseTradeExecutor.confirmDeposit();
    }

    function _initiateWithdraw(bytes calldata _data) internal override {
        ConvexPositionHandler._withdraw(_data);
        BaseTradeExecutor.confirmWithdraw();
    }

    function _confirmDeposit() internal override {}

    function _confirmWithdraw() internal override {}
}
