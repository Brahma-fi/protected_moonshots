//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./BaseTradeExecutor.sol";
import "./PerpHandler/PerpPositionHandler.sol";

contract PerpTradeExecutor is BaseTradeExecutor, PerpPositionHandler {

    // constructor()

    function _initateDeposit (bytes calldata _data) internal override{
        PerpPositionHandler._deposit(_data);
    }

    function _confirmDeposit() internal override {}

    function _initiateWithdraw (bytes calldata _data) internal override {
        PerpPositionHandler._withdraw(_data);
    }

    function _confirmWithdraw() internal override {}

    function totalFunds() public override returns (uint256 _sharePrice, uint256 lastUpdatedBlock) {
        return ( positionInWantToken.posValue, positionInWantToken.lastUpdatedBlock );
    }

    function openPosition(bytes calldata _data) public onlyKeeper{
        _openPosition(_data);
    }

    modifier onlyKeeper {
        // require (msg.sender == keeper);
        _;
    }

}