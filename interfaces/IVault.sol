// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IVault {
    function token() external view returns (IERC20Metadata);

    function apiVersion() external view returns (string memory _apiVersion);

    function batcher() external view returns (address);

    function pendingGovernance() external view returns (address);

    function setGovernance(address _governance) external;

    function acceptGovernance() external;

    function setDepositLimit(uint256 _depositLimit) external;

    function setPerformanceFee(uint256 _performanceFee) external;

    function setManagementFee(uint256 _managementFee) external;

    function setBatcher(address _batcher) external;

    function setEmergencyShutdown(bool _active) external;

    function totalAssets() external view returns (uint256);

    function deposit(uint256 _amount, address recepient)
        external
        returns (uint256 sharesOut);

    function maxAvailableShares()
        external
        view
        returns (uint256 _maxAvailableShares);

    function withdraw(
        uint256 maxShares,
        address recepient,
        uint256 maxLoss
    ) external returns (uint256);

    function pricePerShare() external view returns (uint256);

    function sweep(address token, uint256 amount) external;
}