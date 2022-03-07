//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./interfaces/IERC20.sol";

contract MovrV1Controller {

    function sendWantTokens(
        address wantTokenL2,
        address allowanceTarget, 
        address movrRegistry, 
        uint amount, 
        bytes memory data ) internal {

            IERC20(wantTokenL2).approve(allowanceTarget, amount);

            (bool success, ) = movrRegistry.call(data);

            require(success, "Failed to call movrRegistry");
    }
 
}
