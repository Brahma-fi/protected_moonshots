//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/ITradeExecutor.sol";


abstract contract BaseTradeExecutor is ITradeExecutor {


    ActionStatus public depositStatus;
    ActionStatus public withdrawalStatus;


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

    function totalFunds() public virtual returns(uint256 _sharePrice, uint256 lastUpdatedBlock);


    /// Internal Funcs

    function _initateDeposit (bytes calldata _data) internal virtual;

    function _confirmDeposit() internal virtual;

    function _initiateWithdraw (bytes calldata _data) internal virtual;

    function _confirmWithdraw() internal virtual;

}
