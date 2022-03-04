//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

interface ITradeExecutor {

    struct ActionStatus {
        bool inProcess;
        address from;
    }


    function initiateDeposit(bytes calldata _data) external;

    function confirmDeposit() external;

    function initateWithdraw(bytes calldata _data) external;

    function confirmWithdraw() external;

}