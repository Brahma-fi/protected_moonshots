//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./interfaces/IERC20.sol";
import "@perp/curie-contract/contracts/interface/IVault.sol";
import "@perp/curie-contract/contracts/interface/IClearingHouse.sol";
import "@perp/curie-contract/contracts/interface/IAccountBalance.sol";
import "@perp/curie-contract/contracts/interface/IVirtualToken.sol";
import "@perp/curie-contract/contracts/interface/IOrderBook.sol";
import "@perp/curie-contract/contracts/interface/IExchange.sol";
import "@perp/curie-contract/contracts/interface/IClearingHouseConfig.sol";
import "@perp/curie-contract/contracts/interface/IIndexPrice.sol";


import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";

/// @title PerpV2Controller
/// @author 0xAd1
/// @notice Handles positions on PerpV2
contract PerpV2Controller {

    using SignedSafeMathUpgradeable for int256;
    using SafeMathUpgradeable for uint256;

    IERC20 public baseTokenvCRV;
    IERC20 public quoteTokenvUSDC;

    bytes32 public referralCode; 

    // Perp contracts - Kovan Optimism
    // TODO: init
    IVault public perpVault;
    IClearingHouse public clearingHouse;
    IClearingHouseConfig public clearingHouseConfig;
    IAccountBalance public accountBalance;
    IOrderBook public orderBook;
    IExchange public exchange;


    /// VIEW / CALL

    /// @notice Get free collateral available on Perp V2
    /// @return Free collateral available on Perp V2 in quoteToken terms
    function getFreeCollateral() public view returns (uint256) {
        return perpVault.getFreeCollateral(address(this));
    }

    /// @notice Gets mark twap price of Perp's uniswap pool (quoteToken/baseToken)
    /// @return uint160 gets SqrtX96 price
    function getMarkTwapPrice() public view returns (uint160) {
        uint32 twapInterval = clearingHouseConfig.getTwapInterval();
        uint160 twapPrice = exchange.getSqrtMarkTwapX96(address(baseTokenvCRV), twapInterval);
        return twapPrice;
    }


    function getIndexTwapPrice() public view returns (uint256) {
        uint32 twapInterval = clearingHouseConfig.getTwapInterval();
        uint256 twapPrice = IIndexPrice(address(baseTokenvCRV)).getIndexPrice(twapInterval);
        return twapPrice;
    }

    /// @notice Formats SqrtX96 amount to regular price
    /// @param sqrtPriceX96 SqrtX96 amount
    /// @return price formatted output
    function formatSqrtPriceX96(uint160 sqrtPriceX96) public pure returns (uint256 price) {
        return uint(sqrtPriceX96).mul(uint(sqrtPriceX96)) >> (96 * 2);
    }

    /// @notice Returns the size of current position in baseTokens
    /// @return amount size of position in baseTokens
    function getTotalPerpPositionSize() public view returns (int256) {
        return accountBalance.getTotalPositionSize(address(this), address(baseTokenvCRV));
    }

    /// @notice Returns the value of current position in wantToken value
    /// @return amount value of position in wantToken (USDC)
    function positionInUSDC() public view returns (uint256) {
        int256 posValue = clearingHouse.getAccountValue(address(this));
        uint256 amountOut = (posValue < 0) ? uint256(-1*posValue) : uint256(posValue);
        return amountOut.div(1e12);
    }



    /// SEND
    function approveQuoteToken(IERC20 token, uint256 _value) internal {
        token.approve(address(perpVault), _value);
    }

    /// @notice Deposits wantTokens to Perp Vault
    /// @param _value amount of wantTokens to deposit
    function _depositToPerp(uint256 _value) internal {
        address settlementToken = perpVault.getSettlementToken();
        approveQuoteToken(IERC20(settlementToken), _value);
        perpVault.deposit(settlementToken, _value);
    }

    /// @notice Withdraws wantTokens from Perp Vault
    /// @param _value amount of wantTokens to withdraw
    function _withdrawFromPerp(uint256 _value) internal {
        address settlementToken = perpVault.getSettlementToken();
        perpVault.withdraw(settlementToken, _value);
    }

    /// @notice Opens short or long position on Perp against baseToken 
    /// @param short bool true for short position, false for long position
    /// @param amountIn amount of quoteToken to open position with
    /// @param slippage slippage while opening position
    function _openPositionByAmount(bool short, uint256 amountIn, uint24 slippage) internal returns (int256 positionSize){

        uint256 price = formatSqrtPriceX96(getMarkTwapPrice());
        
        // (amountIn/price) * (1-slippage)
        // 1- 0.005 = 0.995
        uint amountOut = short ? amountIn.mul(10**4+slippage).div(10**4) : amountIn.mul(10**4-slippage).div(10**4);
        amountOut = amountOut.div(price);
        
        IClearingHouse.OpenPositionParams memory params = IClearingHouse.OpenPositionParams({
            baseToken: address(baseTokenvCRV),
            isBaseToQuote: short, 
            isExactInput: false,
            amount: amountIn,
            oppositeAmountBound: amountOut,
            deadline: block.timestamp,
            sqrtPriceLimitX96: 0,
            referralCode: referralCode
        });

        clearingHouse.openPosition(params);
        
        return accountBalance.getTakerPositionSize(address(this), address(baseTokenvCRV));
    }

    /// @notice Closes short or long position on Perp against baseToken 
    /// @param slippage slippage while opening position
    function _closePosition(uint slippage) internal {
        
        uint256 price = formatSqrtPriceX96(getMarkTwapPrice());
        uint256 amountOut = (getTotalPerpPositionSize() < 0) ? uint256(-1*getTotalPerpPositionSize()) : uint256(getTotalPerpPositionSize());
        
        amountOut = (getTotalPerpPositionSize() < 0) ? amountOut.mul(10**4+slippage).div(10**4) : amountOut.mul(10**4-slippage).div(10**4);
        amountOut = amountOut.mul(price);
        IClearingHouse.ClosePositionParams memory params = IClearingHouse.ClosePositionParams({
            baseToken: address(baseTokenvCRV),
            sqrtPriceLimitX96: 0, 
            oppositeAmountBound: amountOut,
            deadline: block.timestamp,
            referralCode: referralCode 
        });

        clearingHouse.closePosition(params);
        
    }
}
