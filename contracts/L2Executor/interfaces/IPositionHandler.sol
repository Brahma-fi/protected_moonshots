/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "./IERC20.sol";

interface IPositionHandler {
    function wantTokenL2() external view returns (address);

    function openPosition(bool isPerp, bytes memory data) external;

    function closePosition(bytes memory data) external;

    function deposit() external;

    function withdraw(
        uint256 amountOut,
        address socketRegistry,
        bytes calldata socketData
    ) external;

    function sweep(address _token) external;
}
