//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ITradeExecutor.sol";
import "../interfaces/IHauler.sol";

abstract contract BaseTradeExecutor is ITradeExecutor {
  uint256 constant MAX_INT = 2**256 - 1;

  ActionStatus public override depositStatus;
  ActionStatus public override withdrawalStatus;

  address public override hauler;

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

  modifier onlyGovernance() {
    require(msg.sender == governance(), "access :: Governance");
    _;
  }

  modifier onlyKeeper() {
    require(msg.sender == keeper(), "access :: Keeper");
    _;
  }

  function sweep(address _token) public onlyGovernance {
    IERC20(_token).transfer(
      governance(),
      IERC20(_token).balanceOf(address(this))
    );
  }

  function initiateDeposit(bytes calldata _data) public override onlyKeeper {
    require(!depositStatus.inProcess, "Deposit already in process");
    depositStatus.inProcess = true;
    _initateDeposit(_data);
  }

  function confirmDeposit() public override onlyKeeper {
    require(depositStatus.inProcess, "No Deposit Pending");
    _confirmDeposit();
    depositStatus.inProcess = false;
  }

  function initateWithdraw(bytes calldata _data) public override onlyKeeper {
    require(!withdrawalStatus.inProcess, "Withdraw already in process");
    withdrawalStatus.inProcess = true;
    _initiateWithdraw(_data);
  }

  function confirmWithdraw() public override onlyKeeper {
    require(withdrawalStatus.inProcess, "No Withdraw Pending");
    _confirmWithdraw();
    withdrawalStatus.inProcess = false;
  }

  /// Internal Funcs

  function _initateDeposit(bytes calldata _data) internal virtual;

  function _confirmDeposit() internal virtual;

  function _initiateWithdraw(bytes calldata _data) internal virtual;

  function _confirmWithdraw() internal virtual;
}
