//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ITradeExecutor.sol";
import "../interfaces/IHauler.sol";


abstract contract BaseTradeExecutor is ITradeExecutor {

    uint256 constant MAX_INT = 2**256 - 1;

    ActionStatus public override depositStatus;
    ActionStatus public override withdrawalStatus;

    address public hauler;
    
    constructor(address _hauler) {
        hauler = _hauler;
        IERC20(haulerWantToken()).approve(hauler, MAX_INT);
    }

    function haulerWantToken() public view returns (address) {
        return IHauler(hauler).wantToken();
    }

    function governance() public view returns (address) {
        return IHauler(hauler).governance();
    }

    function keeper() public view returns (address) {
        return IHauler(hauler).keeper();
    }

    modifier onlyGovernance {
        require(msg.sender == governance(), "access :: Governance");
        _;
    }

    modifier onlyKeeper {
        require(msg.sender == keeper(), "access :: Keeper");
        _;
    }


    function initiateDeposit (bytes calldata _data) public override{
        require(!depositStatus.inProcess, "Deposit already in process");
        _initateDeposit(_data);
        depositStatus.inProcess = true;
    }

     function confirmDeposit() public override{
        require(depositStatus.inProcess, "No Deposit Pending");
        _confirmDeposit();
        depositStatus.inProcess = false;
    }

    function initateWithdraw (bytes calldata _data) public override{
        require(!withdrawalStatus.inProcess, "Withdraw already in process");
        _initiateWithdraw(_data);
        withdrawalStatus.inProcess = true;
    }

    function confirmWithdraw() public override{
        require(withdrawalStatus.inProcess, "No Withdraw Pending");
        _confirmWithdraw();
        withdrawalStatus.inProcess = false;

    }


    /// Internal Funcs

    function _initateDeposit (bytes calldata _data) internal virtual;

    function _confirmDeposit() internal virtual;

    function _initiateWithdraw (bytes calldata _data) internal virtual;

    function _confirmWithdraw() internal virtual;

}
