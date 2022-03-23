//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;
// import "hardhat/console.sol";
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

    /// @notice Decode the socket request calldata 
    /// @dev Currently not in use due to undertainity in bungee api response
    /// @param _data Bungee txn calldata
    /// @return userRequest parsed calldata
    function decodeSocketRegistryCalldata(bytes memory _data)
        internal
        pure
        returns (UserRequest memory userRequest)
    {
        (, userRequest) = abi.decode(_data, (bytes4, UserRequest));
    }

    function verifySocketCalldata(bytes memory _data, uint256 _chainId, address _inputToken, address _receiverAddress) internal pure {
        UserRequest memory userRequest;
        (userRequest) = decodeSocketRegistryCalldata(_data);
        if (userRequest.toChainId != _chainId) {
            revert("Invalid chainId");
        }
        if (userRequest.receiverAddress != _receiverAddress) {
            revert("Invalid receiver address");
        }
        if (userRequest.bridgeRequest.inputToken != _inputToken) {
            revert("Invalid input token");
        }
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
        bytes memory data
    ) internal {
        verifySocketCalldata(data, destinationChainId, token, destinationAddress);
        IERC20(token).approve(allowanceTarget, amount);
        (bool success,) = socketRegistry.call(data);
        require(success, "Failed to call socketRegistry");
    }
}
