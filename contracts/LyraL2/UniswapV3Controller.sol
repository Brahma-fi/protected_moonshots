//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.4;

import "../../interfaces/IUniswapSwapRouter.sol";
import "../../interfaces/IAggregatorV3.sol";

import "./interfaces/IPositionHandler.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UniswapV3Controller
/// @author Pradeep
/// @notice Used to perform swaps for synthetix tokens
contract UniswapV3Controller {
    using SafeERC20 for IERC20;

    /// @notice sUSD IERC20 address
    // 0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9
    address public sUSDAddr;

    /// @notice maximum basis points for all numeric operations
    uint256 public constant MAX_BPS = 10000;
    /// @notice normalization factor for decimals
    uint256 public constant NORMALIZATION_FACTOR = 1e18;
    /// @notice normalization factor for USDC decimals
    uint256 public constant USDC_NORMALIZATION_FACTOR = 1e6;
    /// @notice uniswap swap fee
    uint24 public constant UNISWAP_FEE = 500;

    /// @notice uniswap router to swap tokens
    IUniswapSwapRouter public constant uniswapRouter =
        IUniswapSwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    /// @notice chainlink price feed for SUSD/USD
    IAggregatorV3 public constant susdUsd =
        IAggregatorV3(0x7f99817d87baD03ea21E05112Ca799d715730efe);
    /// @notice chainlink price feed for USDC/USD
    IAggregatorV3 public constant usdcUsd =
        IAggregatorV3(0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3);

    /// @notice slippage for swaps
    uint256 public slippage;

    function _setConfig(address _sUSDAddr) internal {
        sUSDAddr = _sUSDAddr;
    }

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

        // get USDC price and estimate amount out to account for slippage
        uint256 USDCPriceInsUSD = _getUSDCPriceInSUSD();
        uint256 amountOutExpected = direction
            ? (amountToSwap * USDCPriceInsUSD) / USDC_NORMALIZATION_FACTOR
            : (amountToSwap * NORMALIZATION_FACTOR * NORMALIZATION_FACTOR) /
                USDCPriceInsUSD /
                USDC_NORMALIZATION_FACTOR;

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

    function _getUSDCPriceInSUSD() internal view returns (uint256) {
        (, int256 susdPriceInUSD, , , ) = susdUsd.latestRoundData();
        (, int256 usdcPriceInUSD, , , ) = usdcUsd.latestRoundData();

        return ((uint256(usdcPriceInUSD) * NORMALIZATION_FACTOR) /
            uint256(susdPriceInUSD));
    }
}
