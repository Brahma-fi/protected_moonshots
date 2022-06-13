//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./interfaces/IERC20.sol";
import "@perp/curie-contract/contracts/interface/IVault.sol";
import "@perp/curie-contract/contracts/interface/IClearingHouse.sol";
import "@perp/curie-contract/contracts/interface/IAccountBalance.sol";
import "@perp/curie-contract/contracts/interface/IVirtualToken.sol";
import "@perp/curie-contract/contracts/interface/IExchange.sol";
import "@perp/curie-contract/contracts/interface/IClearingHouseConfig.sol";
import "@perp/curie-contract/contracts/interface/IIndexPrice.sol";

import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";

/// @title PerpV2Controller
/// @author 0xAd1 and Bapireddy
/// @notice Handles positions on PerpV2
contract PerpV2Controller {
    using SafeMathUpgradeable for uint256;

    /*///////////////////////////////////////////////////////////////
                            GLOBAL IMMUTABLES
    //////////////////////////////////////////////////////////////*/
    uint256 public constant MAX_BPS = 1e4;

    /*///////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice referralCode to be used while opening positions on Perp
    bytes32 public referralCode;

    /*///////////////////////////////////////////////////////////////
                                EXTERNAL CONTRACTS
    //////////////////////////////////////////////////////////////*/

    /// @notice baseToken address of asset traded on Perp
    IERC20 public baseToken;

    /// @notice quoteToken address on Perp (Settlement token)
    IERC20 public quoteTokenvUSDC;

    /// @notice Address of vault contract on Perp
    IVault public perpVault;

    /// @notice Address of clearingHouse contract on Perp
    IClearingHouse public clearingHouse;

    /// @notice Address of clearingHouseConfig contract on Perp
    IClearingHouseConfig public clearingHouseConfig;

    /// @notice Address of accountBalance contract on Perp
    IAccountBalance public accountBalance;

    /// @notice Address of exchange contract on Perp
    IExchange public exchange;

    struct PerpArgs {
        address wantTokenL1;
        address perpVault;
        address clearingHouse;
        address clearingHouseConfig;
        address accountBalance;
        address exchange;
        address baseToken;
        address quoteTokenvUSDC;
    }

    /*///////////////////////////////////////////////////////////////
                        STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    function _configHandler(PerpArgs perpArgs) {
        quoteTokenvUSDC = IERC20(perpArgs.quoteTokenvUSDC);
        perpVault = IVault(_perpVault);
        clearingHouse = IClearingHouse(_clearingHouse);
        clearingHouseConfig = IClearingHouseConfig(_clearingHouseConfig);
        accountBalance = IAccountBalance(_accountBalance);
        exchange = IExchange(_exchange);
        baseToken = IERC20(_baseToken);
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT / WITHDRAW LOGIC
    //////////////////////////////////////////////////////////////*/

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

    /*///////////////////////////////////////////////////////////////
                        OPEN / CLOSE LOGIC
    //////////////////////////////////////////////////////////////*/
    /// @notice Opens short or long position on Perp against baseToken
    /// @param short bool true for short position, false for long position
    /// @param amountIn amount of quoteToken to open position with
    /// @param slippage slippage while opening position
    function _openPositionByAmount(
        bool short,
        uint256 amountIn,
        uint24 slippage
    ) internal returns (int256 positionSize) {
        uint256 price = formatSqrtPriceX96(getMarkTwapPrice());

        uint256 amountOut;
        if (slippage == MAX_BPS) {
            amountOut = 0;
        } else {
            // accounting for the slippage provided
            amountOut = short
                ? amountIn.mul(MAX_BPS + slippage).div(MAX_BPS)
                : amountIn.mul(MAX_BPS - slippage).div(MAX_BPS);

            // As deposit is USDC, amountOut will always be in baseToken terms so division by price.
            amountOut = amountOut.mul(MAX_BPS).div(price);
        }

        IClearingHouse.OpenPositionParams memory params = IClearingHouse
            .OpenPositionParams({
                baseToken: address(baseToken),
                isBaseToQuote: short, // true for short, false for long
                isExactInput: !short, // false for short, true for long
                amount: amountIn,
                oppositeAmountBound: amountOut,
                deadline: block.timestamp,
                sqrtPriceLimitX96: 0,
                referralCode: referralCode
            });

        clearingHouse.openPosition(params);
        return
            accountBalance.getTakerPositionSize(
                address(this),
                address(baseToken)
            );
    }

    /// @notice Closes short or long position on Perp against baseToken
    /// @param slippage slippage while opening position
    function _closePosition(uint256 slippage) internal {
        uint256 price = formatSqrtPriceX96(getMarkTwapPrice());
        uint256 amountOut = (getTotalPerpPositionSize() < 0)
            ? uint256(-1 * getTotalPerpPositionSize())
            : uint256(getTotalPerpPositionSize());

        if (slippage == MAX_BPS) {
            amountOut = 0;
        } else {
            amountOut = (getTotalPerpPositionSize() < 0)
                ? amountOut.mul(MAX_BPS + slippage).div(MAX_BPS)
                : amountOut.mul(MAX_BPS - slippage).div(MAX_BPS);
            amountOut = amountOut.mul(price).div(MAX_BPS);
        }

        IClearingHouse.ClosePositionParams memory params = IClearingHouse
            .ClosePositionParams({
                baseToken: address(baseToken),
                sqrtPriceLimitX96: 0,
                oppositeAmountBound: amountOut,
                deadline: block.timestamp,
                referralCode: referralCode
            });

        clearingHouse.closePosition(params);
    }

    /*///////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Approves given token to perp vault
    /// @param token token to approve
    /// @param _value amount of tokens to approve
    function approveQuoteToken(IERC20 token, uint256 _value) internal {
        token.approve(address(perpVault), _value);
    }

    /// @notice Formats SqrtX96 amount to regular price with MAX_BPS precision
    /// @param sqrtPriceX96 SqrtX96 amount
    /// @return price formatted output
    function formatSqrtPriceX96(uint160 sqrtPriceX96)
        internal
        view
        returns (uint256 price)
    {
        return
            uint256(sqrtPriceX96).mul(uint256(sqrtPriceX96).mul(MAX_BPS)) >>
            (96 * 2);
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get free collateral available on Perp V2
    /// @return Free collateral available on Perp V2 in quoteToken terms
    function getFreeCollateral() public view returns (uint256) {
        return perpVault.getFreeCollateral(address(this));
    }

    /// @notice Gets mark twap price of Perp's uniswap pool (quoteToken/baseToken)
    /// @return uint160 gets SqrtX96 price
    function getMarkTwapPrice() public view returns (uint160) {
        uint160 twapPrice = exchange.getSqrtMarkTwapX96(
            address(baseToken),
            clearingHouseConfig.getTwapInterval()
        );
        return twapPrice;
    }

    /// @notice Gets index twap price from Perp
    /// @return regular decimal price
    function getIndexTwapPrice() public view returns (uint256) {
        uint256 twapPrice = IIndexPrice(address(baseToken)).getIndexPrice(
            clearingHouseConfig.getTwapInterval()
        );
        return twapPrice;
    }

    /// @notice Returns the size of current position in baseTokens
    /// @return amount size of position in baseTokens
    function getTotalPerpPositionSize() public view returns (int256) {
        return
            accountBalance.getTotalPositionSize(
                address(this),
                address(baseToken)
            );
    }

    /// @notice Returns the value of current position in wantToken value
    /// @return amount value of position in wantToken (USDC)
    function _positionInWantToken() public view returns (uint256) {
        int256 posValue = clearingHouse.getAccountValue(address(this));
        uint256 amountOut = (posValue < 0)
            ? uint256(-1 * posValue)
            : uint256(posValue);
        return amountOut.div(1e12);
    }
}
