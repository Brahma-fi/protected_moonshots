//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.4;

import "../../interfaces/IUniswapSwapRouter.sol";

import "./interfaces/IPositionHandler.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILyraRegistry, ISynthetixAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";

/// @title UniswapV3Controller
/// @author Pradeep
/// @notice Used to perform swaps for synthetix tokens
contract UniswapV3Controller {
    using SafeERC20 for IERC20;

    /// @notice maximum basis points for all numeric operations
    uint256 public constant MAX_BPS = 10000;
    /// @notice normalization factor for decimals
    uint256 public constant NORMALIZATION_FACTOR = 1e18;
    /// @notice uniswap swap fee
    uint24 public constant UNISWAP_FEE = 3000;
    /// @notice address of lyra eth options market
    address public constant LYRA_ETH_OPTIONS_MARKET =
        0x1d42a98848e022908069c2c545aE44Cc78509Bc8;

    /// @notice uniswap router to swap tokens
    IUniswapSwapRouter public constant uniswapRouter =
        IUniswapSwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    /// @notice sUSD IERC20 address
    address public constant sUSDAddr =
        0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9;

    /// @notice SyntheticAdapter contract
    ISynthetixAdapter public immutable lyraSynthetixAdapter;

    /// @notice slippage for swaps
    uint256 public slippage;

    constructor() {
        lyraSynthetixAdapter = ISynthetixAdapter(
            ILyraRegistry(0xF5A0442D4753cA1Ea36427ec071aa5E786dA5916)
                .getGlobalAddress("SYNTHETIX_ADAPTER")
        );
    }

    function _setSlippage(uint256 _slippage) internal {
        slippage = _slippage;
    }

    function _estimateAndSwap(bool direction, uint256 amountToSwap) internal {
        require(amountToSwap > 0, "INVALID_AMOUNT");

        // direction = true -> swap WETH -> USD else swap USD -> ETH
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

        // get ETH price and estimate amount out to account for slippage
        uint256 ETHPriceInsUSD = lyraSynthetixAdapter.getSpotPriceForMarket(
            LYRA_ETH_OPTIONS_MARKET
        );
        uint256 amountOutExpected = direction
            ? (amountToSwap * ETHPriceInsUSD) / NORMALIZATION_FACTOR
            : (amountToSwap * NORMALIZATION_FACTOR) / ETHPriceInsUSD;

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
}
