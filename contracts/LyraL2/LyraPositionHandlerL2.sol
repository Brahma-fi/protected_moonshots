//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.4;

import "./LyraController.sol";
import "./OptimismL2Wrapper.sol";
import "./SocketV1Controller.sol";
import "./UniswapV3Controller.sol";

import "./interfaces/IPositionHandler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BasicFeeCounter} from "@lyrafinance/protocol/contracts/periphery/BasicFeeCounter.sol";

/// @title LyraPositionHandlerL2
/// @author Bapireddy and Pradeep
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract LyraPositionHandlerL2 is
    IPositionHandler,
    LyraController,
    SocketV1Controller,
    OptimismL2Wrapper,
    UniswapV3Controller
{
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

    /// @notice Governance address
    address public governance;

    /// @notice Pengin governance address
    address public pendingGovernance;

    /*///////////////////////////////////////////////////////////////
                            EVENT LOGS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when keeper is updated.
    /// @param oldKeeper The address of the current keeper.
    /// @param newKeeper The address of new keeper.
    event UpdatedKeeper(address indexed oldKeeper, address indexed newKeeper);

    /// @notice Emitted when governance is updated.
    /// @param oldGovernance The address of the current governance.
    /// @param newGovernance The address of new governance.
    event UpdatedGovernance(
        address indexed oldGovernance,
        address indexed newGovernance
    );

    /// @notice Emitted when socket registry is updated.
    /// @param oldRegistry The address of the current Registry.
    /// @param newRegistry The address of new Registry.
    event UpdatedSocketRegistry(
        address indexed oldRegistry,
        address indexed newRegistry
    );

    /// @notice Emitted when slippage is updated.
    /// @param oldSlippage The current slippage.
    /// @param newSlippage Newnew slippage.
    event UpdatedSlippage(uint256 oldSlippage, uint256 newSlippage);

    /*///////////////////////////////////////////////////////////////
                            INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _wantTokenL2,
        address _positionHandlerL1,
        address _lyraOptionMarket,
        address _keeper,
        address _governance,
        address _socketRegistry,
        uint256 _slippage
    ) {
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        keeper = _keeper;
        socketRegistry = _socketRegistry;

        slippage = _slippage;
        governance = _governance;

        _configHandler(_lyraOptionMarket);

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

        // deploy basic fee counter and set trusted counter
        BasicFeeCounter feeCounter = new BasicFeeCounter();
        feeCounter.setTrustedCounter(address(this), true);

        // set Lyra Adapter
        LyraAdapter.setLyraAddresses(
            // lyra registry
            0xF5A0442D4753cA1Ea36427ec071aa5E786dA5916,
            // option market
            _lyraOptionMarket,
            // curve swap
            0xA5407eAE9Ba41422680e2e00537571bcC53efBfD,
            // fee counter
            address(feeCounter)
        );
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function positionInWantToken() public view override returns (uint256) {
        /// Get balance in susd and convert it into USDC
        uint256 sUSDbalance = LyraController._positionInWantToken();
        uint256 USDCPriceInsUSD = UniswapV3Controller._getUSDCPriceInSUSD();
        /// Adding USDC balance of contract as wantToken is wrapped USDC
        return
            (sUSDbalance * USDC_NORMALIZATION_FACTOR) /
            USDCPriceInsUSD +
            IERC20(wantTokenL2).balanceOf(address(this));
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT / WITHDRAW LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Converts the whole wantToken to sUSD.
    function deposit() public override onlyKeeper {
        require(
            address(this).balance > 0 ||
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
        require(address(this).balance >= amountOut, "NOT_ENOUGH_TOKENS");
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
    /// @param strikeId Strike ID of the option based on strike price
    /// @param isCall boolean indication call or put option to purchase.
    /// @param amount amount of options to buy
    /// @param updateExistingPosition boolean indication of if existing position should be updated
    function openPosition(
        uint256 strikeId,
        bool isCall,
        uint256 amount,
        bool updateExistingPosition
    )
        public
        override
        onlyAuthorized
        returns (LyraAdapter.TradeResult memory tradeResult)
    {
        tradeResult = LyraController._openPosition(
            strikeId,
            isCall,
            amount,
            updateExistingPosition
        );
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
    function sweep(address _token) public override onlyGovernance {
        IERC20(_token).transfer(
            msg.sender,
            IERC20(_token).balanceOf(address(this))
        );
    }

    /// @notice slippage setter
    /// @param _slippage updated slippage value
    function setSlippage(uint256 _slippage) public onlyGovernance {
        emit UpdatedSlippage(slippage, _slippage);
        slippage = _slippage;
    }

    /// @notice socket registry setter
    /// @param _socketRegistry new address of socket registry
    function setSocketRegistry(address _socketRegistry) public onlyGovernance {
        emit UpdatedSocketRegistry(socketRegistry, _socketRegistry);
        socketRegistry = _socketRegistry;
    }

    /// @notice keeper setter
    /// @param _keeper new keeper address
    function setKeeper(address _keeper) public onlyGovernance {
        emit UpdatedKeeper(keeper, _keeper);
        keeper = _keeper;
    }

    /// @notice Governance setter
    /// @param _pendingGovernance new governance address
    function setGovernance(address _pendingGovernance) public onlyGovernance {
        pendingGovernance = _pendingGovernance;
    }

    /// @notice Governance accepter
    function acceptGovernance() public {
        require(msg.sender == pendingGovernance, "NOT_PENDING_GOVERNANCE");
        emit UpdatedGovernance(governance, pendingGovernance);
        governance = pendingGovernance;
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

    /// @notice only keeper can call this function
    modifier onlyKeeper() {
        require(msg.sender == keeper, "ONLY_KEEPER");
        _;
    }

    /// @notice only governance can call this function
    modifier onlyGovernance() {
        require(msg.sender == governance, "ONLY_GOVERNANCE");
        _;
    }
}
