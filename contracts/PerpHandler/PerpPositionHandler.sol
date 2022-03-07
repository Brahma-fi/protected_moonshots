//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./OptimismWrapper.sol";
import "./MovrV1Controller.sol";
import "../../interfaces/BasePositionHandler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PerpPositionHandlerL1
/// @author 0xAd1
/// @notice Used to control the short position handler deployed on Optimism which interacts with PerpV2
contract PerpPositionHandler is
  BasePositionHandler,
  OptimismWrapper,
  MovrV1Controller
{
  struct OpenPositionParams {
    uint256 _amount;
    bool _isShort;
    uint24 _slippage;
    uint32 _gasLimit;
  }

  struct ClosePositionParams {
    uint256 _amountOut;
    uint24 _slippage;
    uint32 _gasLimit;
  }

  struct DepositParams {
    uint256 _amount;
    address _allowanceTarget;
    address _movrRegistry;
    bytes _movrData;
  }

  struct WithdrawParams {
    uint256 _amount;
    address _allowanceTarget;
    address _movrRegistry;
    bytes _movrData;
    uint32 _gasLimit;
  }

  address public wantTokenL1;

  address public wantTokenL2;

  address public SPHL2Address;

  Position public override positionInWantToken;

  function _initHandler(
    address _wantTokenL2,
    address _SPHL2Address,
    address _L1CrossDomainMessenger
  ) internal {
    wantTokenL2 = _wantTokenL2;
    SPHL2Address = _SPHL2Address;
    L1CrossDomainMessenger = _L1CrossDomainMessenger;
  }

  /// @notice Sends message to SPHL2 to open a position on PerpV2
  /// @dev Check `openPosition` implementation in SPHL2 for more info
  /// @param data Encoded OpenPositionParams as data
  function _openPosition(bytes calldata data) internal override {
    OpenPositionParams memory openPositionParams = abi.decode(
      data,
      (OpenPositionParams)
    );
    bytes memory L2calldata = abi.encodeWithSignature(
      "openPosition(uint256,uint24)",
      openPositionParams._amount,
      openPositionParams._slippage
    );

    sendMessageToL2(SPHL2Address, L2calldata, openPositionParams._gasLimit);
  }

  /// @notice Sends message to SPHL2 to close existing position on PerpV2
  /// @dev Check `closePosition` implementation in SPHL2 for more info
  /// @param data Encoded ClosePositionParams as data
  function _closePosition(bytes calldata data) internal override {
    ClosePositionParams memory closePositionParams = abi.decode(
      data,
      (ClosePositionParams)
    );
    bytes memory L2calldata = abi.encodeWithSignature(
      "closePosition(uint256,uint24)",
      closePositionParams._amountOut,
      closePositionParams._slippage
    );
    sendMessageToL2(SPHL2Address, L2calldata, closePositionParams._gasLimit);
  }

  /// @notice Sends tokens to SPHL2 using fundMovr
  /// @dev Check `sendTokens` implementation in MovrV1Controller for more info
  /// @param data Encoded DepositParams as data
  function _deposit(bytes calldata data) internal override {
    DepositParams memory depositParams = abi.decode(data, (DepositParams));
    sendTokens(
      wantTokenL1,
      depositParams._allowanceTarget,
      depositParams._movrRegistry,
      depositParams._amount,
      depositParams._movrData
    );
  }

  /// @notice Sends message to SPHL2 to send tokens back to strategy using Movr
  /// @dev Check `withdraw` implementation in SPHL2 for more info
  /// @param data Encoded WithdrawParams as data
  function _withdraw(bytes calldata data) internal override {
    WithdrawParams memory withdrawParams = abi.decode(data, (WithdrawParams));
    bytes memory L2calldata = abi.encodeWithSignature(
      "withdraw(uint256,address,address,bytes)",
      withdrawParams._amount,
      withdrawParams._allowanceTarget,
      withdrawParams._movrRegistry,
      withdrawParams._movrData
    );
    sendMessageToL2(SPHL2Address, L2calldata, withdrawParams._gasLimit);
  }

  function _claimRewards(bytes calldata _data) internal override {
    // DO Nothing - Perp autocompounds, nothing to claim
    // TODO: Decide wether to do nothing or revert
  }

  function setPosValue(uint256 _posValue) internal {
    positionInWantToken.posValue = _posValue;
    positionInWantToken.lastUpdatedBlock = block.number;
  }
}
