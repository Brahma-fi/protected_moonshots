//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./PerpV2Controller.sol";
import "./OptimismL2Wrapper.sol";
import "./MovrV1Controller.sol";
import "./interfaces/IPositionHandler.sol";

import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "./interfaces/IERC20.sol";

/// @title PerpPositionHandlerL2
/// @author 0xAd1
/// @notice Acts as positon handler and token bridger on L2 Optimism
contract PerpPositionHandlerL2 is IPositionHandler, PerpV2Controller, MovrV1Controller, OptimismL2Wrapper{
    using SafeMathUpgradeable for uint256;

    struct PerpPosition {
        uint256 entryMarkTwap;
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
    address public SPHL1Address;

    address public keeper;

    PerpPosition public perpPosition;

    function init(
        address _wantTokenL1,
        address _wantTokenL2,
        address _SPHL1Address,
        address _perpVault,
        address _clearingHouse,
        address _clearingHouseConfig,
        address _accountBalance,
        address _orderBook,
        address _exchange,
        address _baseTokenvCRV,
        address _quoteTokenvUSDC,
        address _keeper
    ) public onlyAuthorized {
        wantTokenL1 = _wantTokenL1;
        wantTokenL2 = _wantTokenL2;
        SPHL1Address = _SPHL1Address;
        perpVault = IVault(_perpVault);
        clearingHouse = IClearingHouse(_clearingHouse);
        clearingHouseConfig = IClearingHouseConfig(_clearingHouseConfig);
        accountBalance = IAccountBalance(_accountBalance);
        orderBook = IOrderBook(_orderBook);
        exchange = IExchange(_exchange);
        baseTokenvCRV = IERC20(_baseTokenvCRV);
        quoteTokenvUSDC = IERC20(_quoteTokenvUSDC);
        keeper = _keeper;
    }




    /// @inheritdoc IPositionHandler
    // opens short position by default and accepts 
    function openPosition(bool isShort, uint256 amountIn, uint24 slippage) public override onlyAuthorized{
        require (perpPosition.isActive == false, "Position already open");
        uint256 wantTokenBalance = IERC20(wantTokenL2).balanceOf(address(this));
        _depositToPerp(wantTokenBalance);
        perpPosition = PerpPosition({entryMarkTwap: formatSqrtPriceX96(getTwapPrice()), entryAmount: amountIn, isShort: isShort, isActive: true});
        _openPositionByAmount(isShort, amountIn, slippage);
    }

    /// @inheritdoc IPositionHandler
    function closePosition(uint24 slippage)
        public
        override
        onlyAuthorized
    {
        require(perpPosition.isActive, "No active position");
        _closePosition(slippage);
        perpPosition.isActive = false;
        _withdrawFromPerp(getFreeCollateral());


    }

    /// @inheritdoc IPositionHandler
    function withdraw(uint256 amountOut, address allowanceTarget, address movrRegistry, bytes calldata movrData) public override onlyAuthorized{
        require(IERC20(wantTokenL2).balanceOf(address(this)) >= amountOut, "Insufficient balance");
        sendWantTokens(wantTokenL2, allowanceTarget, movrRegistry, amountOut, movrData);

    }

    /// @inheritdoc IPositionHandler
    function sweep(address _token) public override onlyAuthorized{
        IERC20(_token).transfer(
            msg.sender,
            IERC20(_token).balanceOf(address(this))
        );
    }

    function setReferralCode(bytes32 _referralCode) onlyAuthorized public {
        referralCode = _referralCode;
    }

    modifier onlyAuthorized {
        require(((msg.sender == L2CrossDomainMessenger && messageSender() == SPHL1Address) || msg.sender == keeper), "Only owner can call this function");
        _;
    }
 
}
