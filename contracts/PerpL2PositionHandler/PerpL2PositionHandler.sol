//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./OptimismL2Wrapper.sol";
import "./SocketV1Controller.sol";
import "./UniswapV3Controller.sol";
import "./PerpV2Controller.sol";
import "./interfaces/IPositionHandler.sol";
import "./interfaces/IERC20.sol";

/// @title PerpPositionHandlerL2
/// @author Bapireddy and 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract PerpL2PositionHandler is
    SocketV1Controller,
    OptimismL2Wrapper,
    UniswapV3Controller,
    PerpV2Controller,
    IPositionHandler
{
    /*///////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

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

    /// @notice PerpController Arguments
    PerpArgs public perpArgs;

    /*///////////////////////////////////////////////////////////////
                            INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _wantTokenL2,
        address _positionHandlerL1,
        address _keeper,
        address _governance,
        address _socketRegistry,
        PerpArgs memory _perpArgs
    ) {
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        keeper = _keeper;
        socketRegistry = _socketRegistry;
        governance = _governance;
        perpArgs = _perpArgs;

        // approve max want token L2 balance to uniV3 router
        IERC20(wantTokenL2).approve(
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
    function positionInWantToken()
        public
        view
        override(PerpV2Controller)
        returns (uint256)
    {
        uint256 perpBalance = PerpV2Controller.positionInWantToken();
        uint256 wantTokenBalance = IERC20(wantTokenL2).balanceOf(address(this));

        return wantTokenBalance + perpBalance;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT / WITHDRAW LOGIC
    //////////////////////////////////////////////////////////////*/

    // function deposit() public override onlyAuthorized {}

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

    struct CurrentPosition {
        bool isActive;
    }

    /// @notice Gets the current position of the executor
    CurrentPosition public currentPosition;

    /// @notice Takes leveraged position on Perp
    /// @dev Check PerpContoller for leveraged position details
    /// @param isShort bool indicating position to be short or long
    /// @param amountIn amountIn for Perp position
    /// @param slippage slippage for opening position
    function openPosition(
        bool isShort,
        uint256 amountIn,
        uint24 slippage
    ) public override(IPositionHandler, PerpV2Controller) onlyAuthorized {
        if (currentPosition.isActive == false) {
            currentPosition.isActive = true;
            PerpV2Controller.openPosition(isShort, amountIn, slippage);
        }
    }

    /// @notice Reduce existing position by closing position on Perp.
    /// @dev Closes the position, withdraws all the funds from perp
    /// @param slippage max slippage while closing position
    function closePosition(uint24 slippage)
        public
        override(IPositionHandler, PerpV2Controller)
        onlyAuthorized
    {
        if (currentPosition.isActive == true) {
            currentPosition.isActive = false;
            PerpV2Controller.closePosition(slippage);
        }
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

    /// @notice checks wether txn sender is keeper address or L1TradeExecutor using optimism gateway
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
