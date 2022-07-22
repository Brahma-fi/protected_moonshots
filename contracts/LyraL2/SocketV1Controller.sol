//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SocketV1Controller
/// @author 0xAd1
/// @notice Used to bridge ERC20 tokens cross chain
contract SocketV1Controller {
    struct MiddlewareRequest {
        uint256 id;
        uint256 optionalNativeAmount;
        address inputToken;
        bytes data;
    }
    struct BridgeRequest {
        uint256 id;
        uint256 optionalNativeAmount;
        address inputToken;
        bytes data;
    }
    struct UserRequest {
        address receiverAddress;
        uint256 toChainId;
        uint256 amount;
        MiddlewareRequest middlewareRequest;
        BridgeRequest bridgeRequest;
    }

    /// @notice Decode the Bungee request calldata
    /// @param _data Bungee txn calldata
    /// @return userRequest parsed calldata
    function decodeSocketRegistryCalldata(bytes calldata _data)
        internal
        pure
        returns (UserRequest memory userRequest)
    {
        (userRequest) = abi.decode(_data[4:], (UserRequest));
    }

    function verifySocketCalldata(
        bytes calldata _data,
        uint256 _chainId,
        address _inputToken,
        address _receiverAddress
    ) internal pure {
        UserRequest memory userRequest;
        (userRequest) = decodeSocketRegistryCalldata(_data);
        if (userRequest.toChainId != _chainId) {
            revert("INVALID_CHAINID");
        }
        if (userRequest.receiverAddress != _receiverAddress) {
            revert("INVALID_RECEIVER_ADDRESS");
        }
        // if (userRequest.bridgeRequest.inputToken != _inputToken) {
        //     revert("INVALID_INPUT_TOKEN");
        // }
    }

    /// @notice Sends tokens using Bungee middleware. Assumes tokens already present in contract. Manages allowance and transfer.
    /// @dev Currently not verifying the middleware request calldata. Use very carefully
    /// @param token address of IERC20 token to be sent
    /// @param allowanceTarget address to allow tokens to swipe
    /// @param socketRegistry address to send bridge txn to
    /// @param destinationAddress address of receiver
    /// @param amount amount of tokens to bridge
    /// @param destinationChainId chain Id of receiving chain
    /// @param data calldata of txn to be sent
    function sendTokens(
        address token,
        address allowanceTarget,
        address socketRegistry,
        address destinationAddress,
        uint256 amount,
        uint256 destinationChainId,
        bytes calldata data
    ) internal {
        verifySocketCalldata(
            data,
            destinationChainId,
            token,
            destinationAddress
        );
        IERC20(token).approve(allowanceTarget, amount);
        (bool success, ) = socketRegistry.call(data);
        require(success, "FAILED_SOCKET_CALL");
    }
}
