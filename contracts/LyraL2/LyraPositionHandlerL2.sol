//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./LyraController.sol";
import "./OptimismL2Wrapper.sol";
import "./SocketV1Controller.sol";
import "./UniswapV3Controller.sol";

import "./interfaces/IPositionHandler.sol";
import "./interfaces/IOptionMarketViewer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LyraPositionHandlerL2
/// @author Bapireddy and 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract LyraPositionHandlerL2 is
    IPositionHandler,
    LyraController,
    SocketV1Controller,
    OptimismL2Wrapper,
    UniswapV3Controller
{
    using SafeERC20 for IERC20;
    /*///////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice wantTokenL2 address
    address public override wantTokenL2;

    /// @notice Address of LyraTradeExecutor on L1
    address public positionHandlerL1;

    /// @notice Address of socket registry on L2
    address public socketRegistry;

    /// @notice Keeper address
    address public keeper;

    /*///////////////////////////////////////////////////////////////
                            INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _wantTokenL2,
        address _positionHandlerL1,
        address _lyraOptionMarket,
        address _keeper,
        address _socketRegistry,
        uint256 _slippage
    ) {
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        keeper = _keeper;
        socketRegistry = _socketRegistry;

        slippage = _slippage;

        _configHandler(_lyraOptionMarket);

        // approve max want token L2 balance to uniV3 router
        IERC20(wantTokenL2).safeApprove(
            address(UniswapV3Controller.uniswapRouter),
            type(uint256).max
        );
        // approve max susd balance to uniV3 router
        LyraController.sUSD.safeApprove(
            address(UniswapV3Controller.uniswapRouter),
            type(uint256).max
        );
    }

    function setSlippage(uint256 _slippage) public onlyAuthorized {
        slippage = _slippage;
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function positionInWantToken() public view override returns (uint256) {
        /// Get balance in sUSD and convert it into USDC
        uint256 sUSDbalance = LyraController._positionInWantToken();
        uint256 usdcPriceInsUSD = _getUSDCPriceInsUSD();

        return (sUSDbalance * NORMALIZATION_FACTOR) / usdcPriceInsUSD;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT / WITHDRAW LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Converts the whole wantToken to sUSD.
    function deposit() public override onlyAuthorized {
        require(
            IERC20(wantTokenL2).balanceOf(address(this)) > 0,
            "INSUFFICIENT_BALANCE"
        );

        UniswapV3Controller._estimateAndSwap(
            true,
            IERC20(wantTokenL2).balanceOf(address(this))
        );
    }

    /// @notice Bridges wantToken back to strategy on L1
    /// @dev Check MovrV1Controller for more details on implementation of token bridging
    /// @param amountOut amount needed to be sent to strategy
    /// @param _socketRegistry address of movr contract to send txn to
    /// @param socketData movr txn calldata
    function withdraw(
        uint256 amountOut,
        address _socketRegistry,
        bytes calldata socketData
    ) public override onlyAuthorized {
        require(
            IERC20(wantTokenL2).balanceOf(address(this)) >= amountOut,
            "NOT_ENOUGH_TOKENS"
        );
        require(socketRegistry == _socketRegistry, "INVALID_REGISTRY");
        SocketV1Controller.sendTokens(
            wantTokenL2,
            socketRegistry,
            positionHandlerL1,
            amountOut,
            1,
            socketData
        );
    }

    /*///////////////////////////////////////////////////////////////
                        OPEN / CLOSE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Purchases new option on lyra.
    /// @dev Will use all sUSD balance to purchase option on Lyra.
    /// @param listingId Listing ID of the option based on strike price
    /// @param isCall boolean indication call or put option to purchase.
    /// @param amount amount of options to buy
    function openPosition(
        uint256 listingId,
        bool isCall,
        uint256 amount
    ) public override onlyAuthorized {
        LyraController._openPosition(listingId, isCall, amount);
    }

    /// @notice Exercises/Sell option on lyra.
    /// @dev Will sell back or settle the option on Lyra.
    /// @param toSettle boolean if true settle position, else close position
    function closePosition(bool toSettle) public override onlyAuthorized {
        LyraController._closePosition(toSettle);
        UniswapV3Controller._estimateAndSwap(
            false,
            LyraController.sUSD.balanceOf(address(this))
        );
    }

    /*///////////////////////////////////////////////////////////////
                            MAINTAINANCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sweep tokens
    /// @param _token Address of the token to sweepr
    function sweep(address _token) public override onlyAuthorized {
        IERC20(_token).transfer(
            msg.sender,
            IERC20(_token).balanceOf(address(this))
        );
    }

    /// @notice socket registry setter
    /// @param _socketRegistry new address of socket registry
    function setSocketRegistry(address _socketRegistry) public onlyAuthorized {
        socketRegistry = _socketRegistry;
    }

    /// @notice keeper setter
    /// @param _keeper new keeper address
    function setKeeper(address _keeper) public onlyAuthorized {
        keeper = _keeper;
    }

    /// @notice checks wether txn sender is keeper address or LyraTradeExecutor using optimism gateway
    modifier onlyAuthorized() {
        require(
            ((msg.sender == L2CrossDomainMessenger &&
                OptimismL2Wrapper.messageSender() == positionHandlerL1) ||
                msg.sender == keeper),
            "ONLY_AUTHORIZED"
        );
        _;
    }
}
