// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IHarvester {
  function crv() external view returns (IERC20);

  function cvx() external view returns (IERC20);

  function _3crv() external view returns (IERC20);

  function keeper() external view returns (address);

  function governance() external view returns (address);

  function slippage() external view returns (uint256);

  function setWantToken(address _addr) external;

  function setKeeper(address _keeper) external;

  function setGovernance(address _governance) external;

  function setSlippage(uint256 _slippage) external;

  // Swap tokens to wantToken
  function harvest() external;

  function sweep(address _token) external;

  function approve() external;
}
