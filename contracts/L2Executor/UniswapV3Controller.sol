//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./interfaces/IPositionHandler.sol";

import "../../interfaces/IUniswapSwapRouter.sol";
import "../../interfaces/IAggregatorV3.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UniswapV3Controller
/// @author Pradeep
/// @notice Used to perform swaps for synthetix tokens
contract UniswapV3Controller {
    using SafeERC20 for IERC20;

    /// @notice maximum basis points for all numeric operations
    uint256 public constant MAX_BPS = 10000;
    /// @notice normalization factor for all decimals
    uint256 public constant NORMALIZATION_FACTOR = 1e18;
    /// @notice uniswap swap fee
    uint24 public constant UNISWAP_FEE = 500;

    /// @notice chainlink price feed for sUSD/USD
    IAggregatorV3 public constant sUSDPrice =
        IAggregatorV3(0x7f99817d87baD03ea21E05112Ca799d715730efe);
    /// @notice chainlink price feed for USDC/USD
    IAggregatorV3 public constant usdcPrice =
        IAggregatorV3(0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3);

    /// @notice uniswap router to swap tokens
    IUniswapSwapRouter public constant uniswapRouter =
        IUniswapSwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    /// @notice sUSD IERC20 address
    address public constant sUSDAddr =
        0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9;

    /// @notice slippage for swaps
    uint256 public slippage;

    function _setSlippage(uint256 _slippage) internal {
        slippage = _slippage;
    }

    function _estimateAndSwap(bool direction, uint256 amountToSwap) internal {
        require(amountToSwap > 0, "INVALID_AMOUNT");

        // direction = true -> swap USDC -> sUSD else swap sUSD -> USDC
        address srcToken = direction
            ? IPositionHandler(address(this)).wantTokenL2()
            : sUSDAddr;
        address destToken = direction
            ? sUSDAddr
            : IPositionHandler(address(this)).wantTokenL2();

        require(
            IERC20(srcToken).balanceOf(address(this)) >= amountToSwap,
            "INSUFFICIENT_BALANCE"
        );

        // get USDC price and estimate amount out to account for slippage, using chanlink price feeds
        uint256 usdcPriceInsUSD = _getUSDCPriceInsUSD();

        uint256 amountOutExpected = direction
            ? (amountToSwap * usdcPriceInsUSD) / NORMALIZATION_FACTOR
            : (amountToSwap * NORMALIZATION_FACTOR) / usdcPriceInsUSD;

        IUniswapSwapRouter.ExactInputSingleParams
            memory params = IUniswapSwapRouter.ExactInputSingleParams({
                tokenIn: srcToken,
                tokenOut: destToken,
                fee: UNISWAP_FEE,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountToSwap,
                amountOutMinimum: (amountOutExpected * (MAX_BPS - slippage)) /
                    MAX_BPS,
                sqrtPriceLimitX96: 0
            });
        uniswapRouter.exactInputSingle(params);
    }

    /// @notice returns the price of usdc in terms of sUSD, normalized to 18 decimals
    function _getUSDCPriceInsUSD()
        internal
        view
        returns (uint256 usdcPriceInsUSD)
    {
        (, int256 usdcPriceInUSD, , , ) = usdcPrice.latestRoundData();
        (, int256 sUSDPriceInUSD, , , ) = sUSDPrice.latestRoundData();

        usdcPriceInsUSD =
            (uint256(usdcPriceInUSD) * NORMALIZATION_FACTOR) /
            uint256(sUSDPriceInUSD);
    }
}
