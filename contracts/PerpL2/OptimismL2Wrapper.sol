//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./interfaces/CrossDomainMessenger.interface.sol";

contract OptimismL2Wrapper {
    /// @notice Address of Optimism L2CrossDomainMessenger
    /// @dev Address is hardcoded, stays same on L2 mainnet and L2 testnet
    address public L2CrossDomainMessenger =
        0x4200000000000000000000000000000000000007;

    ICrossDomainMessenger public optimismMessenger =
        ICrossDomainMessenger(L2CrossDomainMessenger);

    /// @notice Returns the true sender of transaction sent from Optimism L1CrossDomainMessenger
    /// @return address of sender
    function messageSender() public view returns (address) {
        return optimismMessenger.xDomainMessageSender();
    }
}
