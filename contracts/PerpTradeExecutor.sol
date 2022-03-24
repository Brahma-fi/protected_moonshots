//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./BaseTradeExecutor.sol";
import "./PerpHandler/PerpPositionHandler.sol";

contract PerpTradeExecutor is BaseTradeExecutor, PerpPositionHandler {

    constructor(address hauler, address _wantTokenL2, address _SPHL2Address, address _L1CrossDomainMessenger, address _socketRegistry) BaseTradeExecutor(hauler){
        _initHandler(_wantTokenL2, _SPHL2Address, _L1CrossDomainMessenger, _socketRegistry);
    }

    function _initateDeposit (bytes calldata _data) internal override{
        PerpPositionHandler._deposit(_data);
    }

    function _confirmDeposit() internal override {}

    function _initiateWithdraw (bytes calldata _data) internal override {
        PerpPositionHandler._withdraw(_data);
    }

    function _confirmWithdraw() internal override {}

    function totalFunds() public view override returns (uint256 posValue, uint256 lastUpdatedBlock) {
        return ( positionInWantToken.posValue, positionInWantToken.lastUpdatedBlock );
    }

    function openPosition(bytes calldata _data) public onlyKeeper{
        PerpPositionHandler._openPosition(_data);
    }

    function setPosValue(uint256 _posValue) public onlyKeeper{
        PerpPositionHandler._setPosValue(_posValue);
    }
    function setSocketRegistry(address _socketRegistry) public onlyKeeper{
        socketRegistry = _socketRegistry;
    }
}