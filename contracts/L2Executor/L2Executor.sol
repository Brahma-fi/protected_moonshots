//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./LyraController.sol";
import "./OptimismL2Wrapper.sol";
import "./SocketV1Controller.sol";
import "./UniswapV3Controller.sol";
import "./PerpV2Controller.sol";

import "./interfaces/IPositionHandler.sol";
import "./interfaces/IOptionMarketViewer.sol";
import "./interfaces/IERC20.sol";

/// @title LyraPositionHandlerL2
/// @author Bapireddy and 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract L2PositionHandler is
    IPositionHandler,
    LyraController,
    SocketV1Controller,
    OptimismL2Wrapper,
    UniswapV3Controller,
    PerpV2Controller
{
    /*///////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    struct LyraArgs {
        address lyraOptionMarket;
        uint256 uniswapSlippage;
    }

    struct PerpArgs {
        address perpVault;
        address clearingHouse;
        address clearingHouseConfig;
        address accountBalance;
        address exchange;
        address baseToken;
        address quoteTokenvUSDC;
    }

    /// @notice wantTokenL2 address
    address public override wantTokenL2;

    /// @notice Address of TradeExecutor on L1
    address public positionHandlerL1;

    /// @notice Address of socket registry on L2
    address public socketRegistry;

    /// @notice Keeper address
    address public keeper;

    /// @notice Governance address
    address public governance;

    /// @notice Pengin governance address
    address public pendingGovernance;

    /// @notice Lyracontroller Arguments
    LyraArgs lyraArgs;

    /// @notice PerpController Arguments
    PerpArgs perpArgs;

    /*///////////////////////////////////////////////////////////////
                            INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _wantTokenL2,
        address _positionHandlerL1,
        address _keeper,
        address _governance,
        address _socketRegistry,
        LyraArgs memory _lyraArgs,
        PerpArgs memory _perpArgs
    ) {
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        keeper = _keeper;
        socketRegistry = _socketRegistry;
        governance = _governance;
        lyraArgs = _lyraArgs;
        perpArgs = _perpArgs;

        // Setting up LyraController
        LyraController._configHandler(lyraArgs.lyraOptionMarket);

        // approve max want token L2 balance to uniV3 router
        IERC20(wantTokenL2).approve(
            address(UniswapV3Controller.uniswapRouter),
            type(uint256).max
        );
        // approve max susd balance to uniV3 router
        LyraController.sUSD.approve(
            address(UniswapV3Controller.uniswapRouter),
            type(uint256).max
        );

        // Setting up PerpController
        PerpV2Controller._configHandler(perpArgs);
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
        uint256 usdcPriceInsUSD = UniswapV3Controller._getUSDCPriceInsUSD();
        uint256 lyraBalance = (sUSDbalance * NORMALIZATION_FACTOR) /
            usdcPriceInsUSD;
        uint256 perpBalance = PerpV2Controller._positionInWantToken();
        uint256 wantTokenBalance = IERC20(wantTokenL2).balanceOf(address(this));

        return lyraBalance + wantTokenBalance + perpBalance;
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
