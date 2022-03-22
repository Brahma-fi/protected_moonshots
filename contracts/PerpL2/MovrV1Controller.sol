//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
// import "hardhat/console.sol";
import "./interfaces/IERC20.sol";


/// @title MoveV1Controller
/// @author 0xAd1
/// @notice Used to bridge ERC20 tokens cross chain
contract MovrV1Controller {
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

    /// @notice Decode the movr request calldata 
    /// @dev Currently not in use due to undertainity in movr api response
    /// @param _data FundMovr txn calldata
    /// @return userRequest parsed calldata
    function decodeMovrRegistryCalldata(bytes calldata _data)
        internal
        pure
        returns (UserRequest memory userRequest)
    {
        (userRequest) = abi.decode(_data[4:], (UserRequest));
    }

    function verifyMovrCalldata(bytes calldata _data, uint256 _chainId, address _inputToken, address _receiverAddress) internal pure {
        UserRequest memory userRequest;
        (userRequest) = decodeMovrRegistryCalldata(_data);
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

    /// @notice Sends tokens using FundMovr middleware. Assumes tokens already present in contract. Manages allowance and transfer.
    /// @dev Currently not verifying the middleware request calldata. Use very carefully
    /// @param token address of IERC20 token to be sent
    /// @param allowanceTarget address to allow tokens to swipe
    /// @param movrRegistry address to send bridge txn to
    /// @param amount amount of tokens to bridge
    /// @param data calldata of txn to be sent
    function sendTokens(
        address token,
        address allowanceTarget,
        address movrRegistry,
        address destinationAddress,
        uint256 amount,
        uint256 destinationChainId,
        bytes calldata data
    ) internal {
        verifyMovrCalldata(data, destinationChainId, token, destinationAddress);
        IERC20(token).approve(allowanceTarget, amount);
        (bool success,) = movrRegistry.call(data);
        require(success, "Failed to call movrRegistry");
    }
}
