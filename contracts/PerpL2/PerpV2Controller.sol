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

import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import { SignedSafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SignedSafeMathUpgradeable.sol";

/// @title PerpV2Controller
/// @author 0xAd1
/// @notice Handles positions on PerpV2
contract PerpV2Controller {

    using SignedSafeMathUpgradeable for int256;
    using SafeMathUpgradeable for uint256;

    event Damn(uint amountIn, uint amountOut, uint price);

    // // USDC token 
    // TODO: init   
    // IERC20 public USDCToken = IERC20(0x3e22e37Cb472c872B5dE121134cFD1B57Ef06560);

    // Perp Internal Tokens
    // TODO: init
    IERC20 public baseTokenvCRV = IERC20(0x7cE531e940B24EE760e5dDBF8A2E0E359fA04400);
    IERC20 public quoteTokenvUSDC = IERC20(0xd52d4175F937B965dE49E6C24E081eEe6DaE5645);

    bytes32 public referralCode; 

    // Perp contracts - Kovan Optimism
    // TODO: init
    IVault public perpVault = IVault(0x87113069Cd05E819B1F009BEEC70dd41594A9D12);
    IClearingHouse public clearingHouse = IClearingHouse(0x21BFC3ee9f1B3156b446654C571433ff05147153);
    IClearingHouseConfig public clearingHouseConfig = IClearingHouseConfig(0x3c99fFe490C6EBd18A2CF9E7d59669a0113802Dd);
    IAccountBalance public accountBalance = IAccountBalance(0xB35669c4F64faBBF71dc2e4307485Ad74d46f4E8);
    IOrderBook public orderBook = IOrderBook(0x6155d88B3939493A1bba90959dEEea5Bf1dDa72c);
    IExchange public exchange = IExchange(0x870fdaC8DD38c727C1daa67F088ed0926Fb5fd4d);


    uint256 public markPriceOnLastPosition = 0;
    /// VIEW / CALL

    /// @notice Get free collateral available on Perp V2
    /// @return Free collateral available on Perp V2 in quoteToken terms
    function getFreeCollateral() public view returns (uint256) {
        return perpVault.getFreeCollateral(address(this));
    }

    /// @notice Gets twap price of Perp's uniswap pool (quoteToken/baseToken)
    /// @return uint160 gets SqrtX96 price
    function getTwapPrice() public view returns (uint160) {
        uint32 twapInterval = clearingHouseConfig.getTwapInterval();
        uint160 twapPrice = exchange.getSqrtMarkTwapX96(address(baseTokenvCRV), twapInterval);
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

        uint256 price = formatSqrtPriceX96(getTwapPrice());
        
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
        
        uint256 price = formatSqrtPriceX96(getTwapPrice());
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
