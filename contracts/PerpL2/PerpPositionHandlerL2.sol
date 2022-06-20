//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./PerpV2Controller.sol";
import "./OptimismL2Wrapper.sol";
import "./SocketV1Controller.sol";
import "./interfaces/IPositionHandler.sol";

import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IERC20.sol";

/// @title PerpPositionHandlerL2
/// @author 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract PerpPositionHandlerL2 is
    IPositionHandler,
    PerpV2Controller,
    SocketV1Controller,
    OptimismL2Wrapper
{
    using SafeMathUpgradeable for uint256;

    /*///////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice wantTokenL1 address
    address public wantTokenL1;

    /// @notice wantTokenL2 address
    address public wantTokenL2;

    /// @notice Address of PerpTradeExecutor on L1
    address public positionHandlerL1;

    /// @notice Address of socket registry on L2
    address public socketRegistry;

    /// @notice Keeper address
    address public keeper;

    /// @notice Governance address
    address public governance;

    address public pendingGovernance;

    /// @notice Details of current position on Perp
    PerpPosition public perpPosition;

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

    /// @notice Emitted when Perp V2 referral code is updated.
    /// @param oldReferral Old Perp V2 Referral code
    /// @param newReferral New Perp V2 Referral code
    event UpdatedPerpReferral(bytes32 oldReferral, bytes32 newReferral);

    /*///////////////////////////////////////////////////////////////
                            INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _wantTokenL1,
        address _wantTokenL2,
        address _positionHandlerL1,
        address _perpVault,
        address _clearingHouse,
        address _clearingHouseConfig,
        address _accountBalance,
        address _exchange,
        address _baseToken,
        address _quoteTokenvUSDC,
        address _keeper,
        address _governance,
        address _socketRegistry
    ) {
        wantTokenL1 = _wantTokenL1;
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        perpVault = IVault(_perpVault);
        clearingHouse = IClearingHouse(_clearingHouse);
        clearingHouseConfig = IClearingHouseConfig(_clearingHouseConfig);
        accountBalance = IAccountBalance(_accountBalance);
        exchange = IExchange(_exchange);
        baseToken = IERC20(_baseToken);
        quoteTokenvUSDC = IERC20(_quoteTokenvUSDC);
        keeper = _keeper;
        governance = _governance;
        socketRegistry = _socketRegistry;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT / WITHDRAW LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Bridges wantToken back to PerpTE on L1
    /// @dev Check MovrV1Controller for more details on implementation of token bridging
    /// @param amountOut amount needed to be sent to PerpTE
    /// @param allowanceTarget address of contract to provide ERC20 allowance to
    /// @param _socketRegistry address of movr contract to send txn to
    /// @param socketData movr txn calldata
    function withdraw(
        uint256 amountOut,
        address allowanceTarget,
        address _socketRegistry,
        bytes calldata socketData
    ) public override onlyAuthorized {
        require(
            IERC20(wantTokenL2).balanceOf(address(this)) >= amountOut,
            "NOT_ENOUGH_TOKENS"
        );
        require(socketRegistry == _socketRegistry, "INVALID_REGISTRY");
        sendTokens(
            wantTokenL2,
            allowanceTarget,
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

    /// @notice Creates a new position on Perp V2
    /// @dev Will deposit all USDC balance to Perp. Will close any existing position, then open a position with given amountIn on Perp.
    /// @param isShort true for short, false for long
    /// @param amountIn the amountIn with respect to free collateral on perp for new position
    /// @param slippage slippage while opening position, calculated out of 10000
    function openPosition(
        bool isShort,
        uint256 amountIn,
        uint24 slippage
    ) public override onlyAuthorized {
        require(perpPosition.isActive == false, "ACTIVE_POSITION");
        uint256 wantTokenBalance = IERC20(wantTokenL2).balanceOf(address(this));
        _depositToPerp(wantTokenBalance);
        perpPosition = PerpPosition({
            entryMarkPrice: formatSqrtPriceX96(getMarkTwapPrice()),
            entryIndexPrice: getIndexTwapPrice(),
            entryAmount: amountIn,
            isShort: isShort,
            isActive: true
        });
        _openPositionByAmount(isShort, amountIn, slippage);
    }

    /// @notice Closes existing position on Perp V2
    /// @dev Closes the position, withdraws all the funds from perp as well.
    /// @param slippage slippage while closing position, calculated out of 10000
    function closePosition(uint24 slippage) public override onlyAuthorized {
        require(perpPosition.isActive, "NO_OPEN_POSITION");
        _closePosition(slippage);
        perpPosition.isActive = false;
        _withdrawFromPerp(getFreeCollateral());
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

    /// @notice referral code setter
    /// @param _referralCode updated referral code
    function setReferralCode(bytes32 _referralCode) public onlyGovernance {
        emit UpdatedPerpReferral(referralCode, _referralCode);
        referralCode = _referralCode;
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

    /// @notice governance setter
    /// @param _newGovernance new governance address
    function setGovernance(address _newGovernance) public onlyGovernance {
        pendingGovernance = _newGovernance;
    }

    /// @notice governance accepter
    function acceptGovernance() public {
        emit UpdatedGovernance(governance, pendingGovernance);
        require(msg.sender == pendingGovernance, "INVALID_ADDRESS");
        governance = pendingGovernance;
    }

    /// @notice checks wether txn sender is keeper address or PerpTradeExecutor using optimism gateway
    modifier onlyAuthorized() {
        require(
            ((msg.sender == L2CrossDomainMessenger &&
                messageSender() == positionHandlerL1) || msg.sender == keeper),
            "ONLY_AUTHORIZED"
        );
        _;
    }

    /// @notice checks wether txn sender is keeper address
    modifier onlyKeeper() {
        require(msg.sender == keeper, "ONLY_KEEPER");
        _;
    }

    /// @notice checks wether txn sender is governance address
    modifier onlyGovernance() {
        require(msg.sender == governance, "ONLY_GOVERNANCE");
        _;
    }
}
