// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "./IConvexHandler.sol";

import "./IConvexRewards.sol";
import "./ICurvePool.sol";
import "../contracts/solmate/ERC20.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IVault is IConvexHandler {
  function token() external view returns (ERC20);

  function apiVersion() external view returns (string memory _apiVersion);

  function governance() external view returns (address);

  function batcher() external view returns (address);

  function managementFee() external view returns (uint256);

  function performanceFee() external view returns (uint256);

  function depositLimit() external view returns (uint256);

  function emergencyShutdown() external view returns (bool);

  function pendingGovernance() external view returns (address);

  function acceptGovernance() external;

  function setGovernance(address _governance) external;

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

  function withdraw(uint256 maxShares, address recepient)
    external
    returns (uint256);
}
