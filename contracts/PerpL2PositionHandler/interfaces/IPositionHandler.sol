/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "./IERC20.sol";

interface IPositionHandler {
    function wantTokenL2() external view returns (address);

    function openPosition(
        bool isShort,
        uint256 amountIn,
        uint24 slippage
    ) external;

    function closePosition(uint24 slippage) external;

    // function deposit() external;

    function withdraw(
        uint256 amountOut,
        address socketRegistry,
        bytes calldata socketData
    ) external;

    function sweep(address _token) external;
}
