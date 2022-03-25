//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./OptimismWrapper.sol";
import "./SocketV1Controller.sol";
import "../../interfaces/BasePositionHandler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../PerpL2/interfaces/IPositionHandler.sol";

/// @title PerpPositionHandlerL1
/// @author 0xAd1
/// @notice Used to control the short position handler deployed on Optimism which interacts with PerpV2
contract PerpPositionHandler is
  BasePositionHandler,
  OptimismWrapper,
  SocketV1Controller
{
  struct OpenPositionParams {
    uint256 _amount;
    bool _isShort;
    uint24 _slippage;
    uint32 _gasLimit;
  }

  struct ClosePositionParams {
    uint24 _slippage;
    uint32 _gasLimit;
  }

  struct DepositParams {
    uint256 _amount;
    address _allowanceTarget;
    address _socketRegistry;
    bytes _socketData;
  }

  struct WithdrawParams {
    uint256 _amount;
    address _allowanceTarget;
    address _socketRegistry;
    bytes _socketData;
    uint32 _gasLimit;
  }

  struct DepositStats {
    uint256 lastDeposit;
    uint256 totalDeposit;
  }

  address public wantTokenL1;

  address public wantTokenL2;

  address public positionHandlerL2Address;

  address public socketRegistry;

  Position public override positionInWantToken;

  DepositStats public depositStats;

  function _initHandler(
    address _wantTokenL2,
    address _positionHandlerL2Address,
    address _L1CrossDomainMessenger,
    address _socketRegistry
  ) internal {
    wantTokenL2 = _wantTokenL2;
    positionHandlerL2Address = _positionHandlerL2Address;
    L1CrossDomainMessenger = _L1CrossDomainMessenger;
    socketRegistry = _socketRegistry;
  }

  /// @notice Sends message to SPHL2 to open a position on PerpV2
  /// @dev Check `openPosition` implementation in SPHL2 for more info
  /// @param data Encoded OpenPositionParams as data
  function _openPosition(bytes calldata data) internal override {
    OpenPositionParams memory openPositionParams = abi.decode(
      data,
      (OpenPositionParams)
    );
    bytes memory L2calldata = abi.encodeWithSelector(
      IPositionHandler.openPosition.selector,
      openPositionParams._isShort,
      openPositionParams._amount,
      openPositionParams._slippage
    );

    sendMessageToL2(positionHandlerL2Address, L2calldata, openPositionParams._gasLimit);
  }

  /// @notice Sends message to SPHL2 to close existing position on PerpV2
  /// @dev Check `closePosition` implementation in SPHL2 for more info
  /// @param data Encoded ClosePositionParams as data
  function _closePosition(bytes calldata data) internal override {
    ClosePositionParams memory closePositionParams = abi.decode(
      data,
      (ClosePositionParams)
    );
    bytes memory L2calldata = abi.encodeWithSelector(
      IPositionHandler.closePosition.selector,
      closePositionParams._slippage
    );
    sendMessageToL2(positionHandlerL2Address, L2calldata, closePositionParams._gasLimit);
  }

  /// @notice Sends tokens to positionHandlerL2 using Socket
  /// @dev Check `sendTokens` implementation in SocketV1Controller for more info
  /// @param data Encoded DepositParams as data
  function _deposit(bytes calldata data) internal override {
    DepositParams memory depositParams = abi.decode(data, (DepositParams));
    require (depositParams._socketRegistry == socketRegistry, "socketRegistry is not set correctly");
    depositStats.lastDeposit = depositParams._amount;
    depositStats.totalDeposit += depositParams._amount;
    sendTokens(
      wantTokenL1,
      depositParams._allowanceTarget,
      depositParams._socketRegistry,
      positionHandlerL2Address,
      depositParams._amount,
      10, /// TODO: hardcode or not??
      depositParams._socketData
    );
  }

  // function decoderDeposit(bytes calldata data) internal returns(DepositParams calldata) {
  //   DepositParams calldata depositParams = abi.decode(data, (DepositParams));
  //   return depositParams;
  // }

  /// @notice Sends message to SPHL2 to send tokens back to strategy using Socket
  /// @dev Check `withdraw` implementation in SPHL2 for more info
  /// @param data Encoded WithdrawParams as data
  function _withdraw(bytes calldata data) internal override {
    WithdrawParams memory withdrawParams = abi.decode(data, (WithdrawParams));
    bytes memory L2calldata = abi.encodeWithSelector(
      IPositionHandler.withdraw.selector,
      withdrawParams._amount,
      withdrawParams._allowanceTarget,
      withdrawParams._socketRegistry,
      withdrawParams._socketData
    );
    sendMessageToL2(positionHandlerL2Address, L2calldata, withdrawParams._gasLimit);
  }

  function _claimRewards(bytes calldata _data) internal override {
    /// Nothing to claim
  }

  function _setPosValue(uint256 _posValue) internal {
    positionInWantToken.posValue = _posValue;
    positionInWantToken.lastUpdatedBlock = block.number;
  }
}
