// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./interfaces/IERC20.sol";
import {IOptionMarket} from "./interfaces/IOptionMarket.sol";
import {IOptionMarketViewer} from "./interfaces/IOptionMarketViewer.sol";

/// @title LyraPositionHandlerL2
/// @author Pradeep and Bapireddy
/// @notice Acts as controller to interact with lyra protocol.
contract LyraController {
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
    /// @param listingId Listing ID of the option based on strike price
    /// @param tradeType call or put option
    /// @param amount Amount of sUSD used to purchase option
    /// @param isActive bool indicating if position is active
    struct CurrentPosition {
        uint256 listingId;
        IOptionMarket.TradeType tradeType;
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
    function _configHandler(address _lyraOptionMarket) internal {
        lyraOptionMarket = IOptionMarket(_lyraOptionMarket);
    }

    /*///////////////////////////////////////////////////////////////
                        OPEN / CLOSE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Purchases new option on lyra.
    /// @dev Will use all sUSD balance to purchase option on Lyra.
    /// @param listingId Listing ID of the option based on strike price
    /// @param isCall boolean indication call or put option
    /// @param amount amount of options to buy
    function _openPosition(
        uint256 listingId,
        bool isCall,
        uint256 amount
    ) internal {
        /// Check if contract doesnt have a position on lyra
        require(!currentPosition.isActive, "POSITION_ACTIVE");

        uint256 sUSDBal = sUSD.balanceOf(address(this));
        require(sUSDBal > 0, "NO_BALANCE");

        sUSD.approve(address(lyraOptionMarket), sUSDBal);

        IOptionMarket.TradeType tradeType = isCall
            ? IOptionMarket.TradeType.LONG_CALL
            : IOptionMarket.TradeType.LONG_PUT;

        /// Use params to open new position on lyra
        lyraOptionMarket.openPosition(listingId, tradeType, amount);

        uint256 sUSDSent = sUSDBal - sUSD.balanceOf(address(this));

        currentPosition = CurrentPosition({
            listingId: listingId,
            tradeType: tradeType,
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
            lyraOptionMarket.settleOptions(
                currentPosition.listingId,
                IOptionMarket.TradeType(currentPosition.tradeType)
            );
        } else {
            lyraOptionMarket.closePosition(
                currentPosition.listingId,
                IOptionMarket.TradeType(currentPosition.tradeType),
                currentPosition.optionsPurchased
            );
        }

        // reset the current position value.
        currentPosition = CurrentPosition({
            listingId: 0,
            tradeType: IOptionMarket.TradeType.SHORT_CALL,
            amount: 0,
            optionsPurchased: 0,
            isActive: false
        });
    }

    /// @notice Get the value of current active position on Lyra.
    /// @dev Gives the total value of position handler in susd.
    function _positionInWantToken() internal view returns (uint256) {
        if (currentPosition.isActive) {
            IOptionMarketViewer optionMarketViewer = IOptionMarketViewer(
                0x43592bffCF14f1e0A096091E125f023B2ccC2525
            );
            IOptionMarketViewer.TradePremiumView
                memory output = optionMarketViewer.getPremiumForClose(
                    currentPosition.listingId,
                    currentPosition.tradeType,
                    currentPosition.optionsPurchased
                );
            return output.premium + sUSD.balanceOf(address(this));
        } else {
            return sUSD.balanceOf(address(this));
        }
    }
}
