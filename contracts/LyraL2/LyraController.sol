// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IOptionMarket} from "@lyrafinance/protocol/contracts/interfaces/IOptionMarket.sol";
import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";
import "hardhat/console.sol";

/// @title LyraPositionHandlerL2
/// @author Pradeep and Bapireddy
/// @notice Acts as controller to interact with lyra protocol.
contract LyraController is LyraAdapter {
    using DecimalMath for uint256;

    /*///////////////////////////////////////////////////////////////
                          STRUCTS FOR STORAGE
  //////////////////////////////////////////////////////////////*/

    /// @notice Params required to close a position
    /// @dev send these params encoded in bytes
    /// @param toSettle boolean if true settle position, else close position
    struct ClosePositionParams {
        bool toSettle;
    }

    /// @notice struct indicating the current position
    /// @param strikeId Strike ID of the option based on strike price
    /// @param optionType call or put option
    /// @param amount Amount of sUSD used to purchase option
    /// @param isActive bool indicating if position is active
    struct CurrentPosition {
        uint256 strikeId;
        uint256 positionId;
        LyraAdapter.OptionType optionType;
        uint256 amount;
        uint256 optionsPurchased;
        bool isActive;
    }

    /*///////////////////////////////////////////////////////////////
                          IMMUTABLES
  //////////////////////////////////////////////////////////////*/

    IERC20 public constant sUSD =
        IERC20(0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9);

    /*///////////////////////////////////////////////////////////////
                          MUTABLES
  //////////////////////////////////////////////////////////////*/
    /// @notice address of the option market we trade on
    IOptionMarket public lyraOptionMarket;

    // 0x1f6d98638eee9f689684767c3021230dd68df419

    /// @notice struct inidcating the current position
    CurrentPosition public currentPosition;

    /// @notice Configures the handlers with base state.
    /// @param _lyraOptionMarket The option market we buy options on.
    /// @param _lyraOptionMarket The short collateral contract to settle options.
    function _configHandler(address _lyraOptionMarket) internal {
        lyraOptionMarket = IOptionMarket(_lyraOptionMarket);
    }

    /*///////////////////////////////////////////////////////////////
                        OPEN / CLOSE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Purchases new option on lyra.
    /// @dev Will use all sUSD balance to purchase option on Lyra.
    /// @param strikeId Strike ID of the option based on strike price
    /// @param isCall boolean indication call or put option
    /// @param amount amount of options to buy
    /// @param updateExistingPosition boolean indication of if existing position should be updated
    function _openPosition(
        uint256 strikeId,
        bool isCall,
        uint256 amount,
        bool updateExistingPosition
    ) internal returns (LyraAdapter.TradeResult memory tradeResult) {
        LyraAdapter.OptionType optionType;
        LyraAdapter.TradeInputParameters memory openPositionParams;

        uint256 sUSDBal = sUSD.balanceOf(address(this));
        require(sUSDBal > 0, "NO_BALANCE");

        sUSD.approve(address(lyraOptionMarket), sUSDBal);

        if (updateExistingPosition) {
            optionType = currentPosition.optionType;
            openPositionParams = _getTradeInputParams(
                currentPosition.strikeId,
                currentPosition.positionId,
                optionType,
                amount,
                sUSD.balanceOf(address(this))
            );
        } else {
            optionType = isCall
                ? LyraAdapter.OptionType.LONG_CALL
                : LyraAdapter.OptionType.LONG_PUT;

            /// Use params to open new position on lyra
            openPositionParams = _getTradeInputParams(
                strikeId,
                0,
                optionType,
                amount,
                sUSD.balanceOf(address(this))
            );
        }

        tradeResult = LyraAdapter._openPosition(openPositionParams);

        uint256 sUSDSent = sUSDBal - sUSD.balanceOf(address(this));

        currentPosition = CurrentPosition({
            strikeId: strikeId,
            positionId: tradeResult.positionId,
            optionType: optionType,
            amount: sUSDSent,
            optionsPurchased: amount,
            isActive: true
        });
    }

    /// @notice Exercises/Sell option on lyra.
    /// @dev Will sell back or settle the option on Lyra.
    /// @param toSettle boolean if true settle position, else close position
    function _closePosition(bool toSettle) internal {
        require(currentPosition.isActive, "NO_ACTIVE_POSITION");

        /// Check if option has to be settled.
        if (toSettle == true) {
            uint256[] memory positionsToClose = new uint256[](1);
            positionsToClose[0] = currentPosition.positionId;

            LyraAdapter.shortCollateral.settleOptions(positionsToClose);
        } else {
            LyraAdapter.TradeInputParameters
                memory closePositionParams = _getTradeInputParams(
                    currentPosition.strikeId,
                    currentPosition.positionId,
                    currentPosition.optionType,
                    currentPosition.optionsPurchased,
                    type(uint256).max
                );
            LyraAdapter._closeOrForceClosePosition(closePositionParams);
        }

        // reset the current position value.
        currentPosition = CurrentPosition({
            strikeId: 0,
            positionId: 0,
            optionType: LyraAdapter.OptionType.SHORT_CALL_BASE,
            amount: 0,
            optionsPurchased: 0,
            isActive: false
        });
    }

    /// @notice Get the value of current active position on Lyra.
    /// @dev Gives the total value of position handler in susd.
    function _positionInWantToken() public view returns (uint256) {
        uint256[] memory positions = new uint256[](1);
        positions[0] = currentPosition.positionId;

        LyraAdapter.OptionPosition[] memory allPositions = LyraAdapter
            ._getPositions(positions);
        LyraAdapter.OptionPosition memory positionData = allPositions[0];

        if (positionData.state == LyraAdapter.PositionState.ACTIVE) {
            (uint256 callPremium, uint256 putPremium) = LyraAdapter
                ._getPurePremiumForStrike(currentPosition.strikeId);
            uint256 totalPremium = (
                currentPosition.optionType == LyraAdapter.OptionType.LONG_CALL
                    ? callPremium
                    : putPremium
            ).multiplyDecimal(currentPosition.amount);

            return totalPremium + sUSD.balanceOf(address(this));
        } else {
            return sUSD.balanceOf(address(this));
        }
    }

    /// @notice helper function to get trade input parameters for opening and closing positions
    /// @param strikeId strike id of the option
    /// @param positionId position ID of the ERC721 position
    /// @param optionType type of option (LONG_CALL|LONG_PUT)
    /// @param amount amount of options
    function _getTradeInputParams(
        uint256 strikeId,
        uint256 positionId,
        LyraAdapter.OptionType optionType,
        uint256 amount,
        uint256 maxCost
    ) internal returns (LyraAdapter.TradeInputParameters memory) {
        console.log("maxCost", maxCost);
        return
            LyraAdapter.TradeInputParameters({
                strikeId: strikeId,
                positionId: positionId,
                iterations: 3,
                optionType: optionType,
                amount: amount,
                setCollateralTo: 0,
                minTotalCost: 0,
                maxTotalCost: maxCost,
                rewardRecipient: address(this)
            });
    }
}
