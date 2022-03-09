/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

interface IPositionHandler {

    /// @notice Creates a new position on Perp V2
    /// @dev Will deposit all USDC balance to Perp. Will close any existing position, then open a position with given amountIn on Perp.
    /// @param _amount the amountIn with respect to free collateral on perp for new position
    /// @param _slippage slippage while opening position, calculated out of 10000
    function openPosition(
        bool _isShort,
        uint256 _amount,
        uint24 _slippage
    ) external;


    /// @notice Closes existing position on Perp V2
    /// @dev Closes the position, withdraws all the funds, keeps the amountOut, deposits the rest and opens a new position with the remaining amount. To completely close position, request amountOut greater than the position value
    /// @param _amountOut the amountOut that will be freed from the position
    /// @param _slippage slippage while opening position, calculated out of 10000
    /// @return actualAmount amount freed from the position
    function closePosition(uint256 _amountOut, uint24 _slippage) external returns (uint256);

    /// @notice Bridges wantToken back to strategy on L1
    /// @dev Check MovrV1Controller for more details on implementation of token bridging
    /// @param amountOut amount needed to be sent to strategy
    /// @param allowanceTarget address of contract to provide ERC20 allowance to
    /// @param movrRegistry address of movr contract to send txn to
    /// @param movrData movr txn calldata
    function withdraw(uint256 amountOut, address allowanceTarget, address movrRegistry, bytes calldata movrData) external;

    /// @notice Sweep tokens 
    /// @param _token Address of the token to sweep
    function sweep(address _token) external;
}

