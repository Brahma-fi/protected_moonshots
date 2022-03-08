/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

abstract contract BasePositionHandler {
  struct Position {
    uint256 posValue;
    uint256 lastUpdatedBlock;
  }

  function positionInWantToken()
    external
    view
    virtual
    returns (uint256, uint256);

  function _openPosition(bytes calldata _data) internal virtual;

  function _closePosition(bytes calldata _data) internal virtual;

  function _deposit(bytes calldata _data) internal virtual;

  function _withdraw(bytes calldata _data) internal virtual;

  function _claimRewards(bytes calldata _data) internal virtual;
}
