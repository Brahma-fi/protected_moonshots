//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./PerpV2Controller.sol";
import "./OptimismL2Wrapper.sol";
import "./MovrV1Controller.sol";
import "./interfaces/IPositionHandler.sol";

import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IERC20.sol";


/// @title PerpPositionHandlerL2
/// @author 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract PerpPositionHandlerL2 is
    IPositionHandler,
    PerpV2Controller,
    MovrV1Controller,
    OptimismL2Wrapper
{
    using SafeMathUpgradeable for uint256;

    struct PerpPosition {
        uint256 entryMarkPrice;
        uint256 entryIndexPrice;
        uint256 entryAmount;
        bool isShort;
        bool isActive;
    }

    /// @notice wantTokenL1 getter
    /// @return address of wantTokenL1 contract
    address public wantTokenL1;

    /// @notice wantTokenL2 getter
    /// @return address of wantTokenL2 contract
    address public wantTokenL2;

    /// @notice SPHL1 getter
    /// @return address of SPHL1 contract
    address public positionHandlerL1;
    address public movrRegistry;

    address public keeper;

    PerpPosition public perpPosition;

    constructor(
        address _wantTokenL1,
        address _wantTokenL2,
        address _positionHandlerL1,
        address _perpVault,
        address _clearingHouse,
        address _clearingHouseConfig,
        address _accountBalance,
        address _orderBook,
        address _exchange,
        address _baseToken,
        address _quoteTokenvUSDC,
        address _keeper,
        address _movrRegistry
    ) {
        init(
            _wantTokenL1,
            _wantTokenL2,
            _positionHandlerL1,
            _perpVault,
            _clearingHouse,
            _clearingHouseConfig,
            _accountBalance,
            _orderBook,
            _exchange,
            _baseToken,
            _quoteTokenvUSDC,
            _keeper,
            _movrRegistry
        );
    }

    function init(
        address _wantTokenL1,
        address _wantTokenL2,
        address _positionHandlerL1,
        address _perpVault,
        address _clearingHouse,
        address _clearingHouseConfig,
        address _accountBalance,
        address _orderBook,
        address _exchange,
        address _baseToken,
        address _quoteTokenvUSDC,
        address _keeper,
        address _movrRegistry
    ) internal {

        wantTokenL1 = _wantTokenL1;
        wantTokenL2 = _wantTokenL2;
        positionHandlerL1 = _positionHandlerL1;
        perpVault = IVault(_perpVault);
        clearingHouse = IClearingHouse(_clearingHouse);
        clearingHouseConfig = IClearingHouseConfig(_clearingHouseConfig);
        accountBalance = IAccountBalance(_accountBalance);
        orderBook = IOrderBook(_orderBook);
        exchange = IExchange(_exchange);
        baseToken = IERC20(_baseToken);
        quoteTokenvUSDC = IERC20(_quoteTokenvUSDC);
        keeper = _keeper;
        movrRegistry = _movrRegistry;
    }

    /// @inheritdoc IPositionHandler
    // opens short position by default and accepts
    function openPosition(
        bool isShort,
        uint256 amountIn,
        uint24 slippage
    ) public override onlyAuthorized {
        require(perpPosition.isActive == false, "Position already open");
        uint256 wantTokenBalance = IERC20(wantTokenL2).balanceOf(address(this));
        _depositToPerp(wantTokenBalance);
        perpPosition = PerpPosition({
            entryMarkPrice: formatSqrtPriceX96(getMarkTwapPrice()),
            entryIndexPrice: getIndexTwapPrice(),
            // entryIndexPrice: getIndexTwapPrice(),
            entryAmount: amountIn,
            isShort: isShort,
            isActive: true
        });
        _openPositionByAmount(isShort, amountIn, slippage);
    }

    /// @inheritdoc IPositionHandler
    function closePosition(uint24 slippage) public override onlyAuthorized {
        require(perpPosition.isActive, "No active position");
        _closePosition(slippage);
        perpPosition.isActive = false;
        _withdrawFromPerp(getFreeCollateral());
    }

    /// @inheritdoc IPositionHandler
    function withdraw(
        uint256 amountOut,
        address allowanceTarget,
        address _movrRegistry,
        bytes calldata movrData
    ) public override onlyAuthorized {
        require(
            IERC20(wantTokenL2).balanceOf(address(this)) >= amountOut,
            "Insufficient balance"
        );
        require(movrRegistry == _movrRegistry, "Invalid movr registry");
        sendTokens(
            wantTokenL2,
            allowanceTarget,
            movrRegistry,
            positionHandlerL1, 
            amountOut,
            1, /// TODO: should hardcode destination chain 1 or accept argument??
            movrData
        );
    }

    /// @inheritdoc IPositionHandler
    function sweep(address _token) public override onlyAuthorized {
        IERC20(_token).transfer(
            msg.sender,
            IERC20(_token).balanceOf(address(this))
        );
    }

    function setReferralCode(bytes32 _referralCode) public onlyAuthorized {
        referralCode = _referralCode;
    }

    function setMovrRegistry(address _movrRegistry) public onlyAuthorized {
        movrRegistry = _movrRegistry;
    }

    modifier onlyAuthorized() {
        require(
            ((msg.sender == L2CrossDomainMessenger &&
                messageSender() == positionHandlerL1) || msg.sender == keeper),
            "Only owner can call this function"
        );
        _;
    }
}
