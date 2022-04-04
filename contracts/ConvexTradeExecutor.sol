//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./BaseTradeExecutor.sol";
import { ConvexPositionHandler } from "./ConvexExecutor/ConvexPositionHandler.sol";

/// @title ConvexTradeExecutor
/// @author PradeepSelva
/// @notice A contract to execute the long side of the strategy's trade, on Convex
contract ConvexTradeExecutor is BaseTradeExecutor, ConvexPositionHandler {
  /**
   @notice Creates a new ConvexTradeExecutor
   @param _baseRewardPool address of convex UST3 base reward pool
   @param _convexBooster address of convex booster
   @param _ust3Pool address of curve's UST3 Pool
   @param _curve3PoolZap address of curve 3 pool zap
   @param _harvester address of reward harvester contract
   @param _hauler address of the Hauler
   */
  constructor(
    address _baseRewardPool,
    address _convexBooster,
    address _ust3Pool,
    address _curve3PoolZap,
    address _harvester,
    address _hauler
  ) BaseTradeExecutor(_hauler) {
    ConvexPositionHandler._configHandler(
      _baseRewardPool,
      _convexBooster,
      _ust3Pool,
      _curve3PoolZap,
      haulerWantToken(),
      _harvester
    );
  }

  /*///////////////////////////////////////////////////////////////
                         VIEW FUNCTONS
  //////////////////////////////////////////////////////////////*/
  /** 
   @notice This gives the total funds in the contract in terms of want token
   @return totalBalance Total balance of contract in want token
   @return blockNumber Current block number
   */
  function totalFunds() public view override returns (uint256, uint256) {
    return positionInWantToken();
  }

  /*///////////////////////////////////////////////////////////////
                    STATE MODIFICATION FUNCTIONS
  //////////////////////////////////////////////////////////////*/
  /**
   @notice Keeper function to set max accepted slippage of swaps
   @param _slippage Max accepted slippage during harvesting
   */
  function setSlippage(uint256 _slippage) external onlyKeeper {
    ConvexPositionHandler._setSlippage(_slippage);
  }

  /**
   @notice Governance function to modify the contract's state
   @param _baseRewardPool address of convex UST3 base reward pool
   @param _convexBooster address of convex booster
   @param _ust3Pool address of curve's UST3 Pool
   @param _curve3PoolZap address of curve 3 pool zap
   @param _harvester address of reward harvester contract
   */
  function setHandler(
    address _baseRewardPool,
    address _convexBooster,
    address _ust3Pool,
    address _curve3PoolZap,
    address _harvester
  ) external onlyGovernance {
    ConvexPositionHandler._configHandler(
      _baseRewardPool,
      _convexBooster,
      _ust3Pool,
      _curve3PoolZap,
      haulerWantToken(),
      _harvester
    );
  }

  /*///////////////////////////////////////////////////////////////
                    DEPOSIT / WITHDRAW FUNCTIONS
  //////////////////////////////////////////////////////////////*/
  /**
   @notice To deposit into the Curve Pool
   @dev Converts USDC to lp tokens via Curve
   @param _data Encoded AmountParams as _data with USDC amount
   */
  function _initateDeposit(bytes calldata _data) internal override {
    ConvexPositionHandler._deposit(_data);
    BaseTradeExecutor.confirmDeposit();
  }

  /**
   @notice To withdraw from ConvexHandler
   @dev  Converts Curve Lp Tokens  back to USDC.
   @param _data Encoded WithdrawParams as _data with USDC token amount
   */
  function _initiateWithdraw(bytes calldata _data) internal override {
    ConvexPositionHandler._withdraw(_data);
    BaseTradeExecutor.confirmWithdraw();
  }

  /**
   @notice Functionlity to execute after deposit is completed
   @dev This is not required in ConvexTradeExecutor, hence empty. This follows the BaseTradeExecutor interface
   */
  function _confirmDeposit() internal override {}

  /**
   @notice Functionlity to execute after withdraw is completed
   @dev This is not required in ConvexTradeExecutor, hence empty. This follows the BaseTradeExecutor interface
   */
  function _confirmWithdraw() internal override {}

  /*///////////////////////////////////////////////////////////////
                    OPEN / CLOSE FUNCTIONS
  //////////////////////////////////////////////////////////////*/
  /**
   @notice To open staking position in Convex
   @dev stakes the specified Curve Lp Tokens into Convex's UST3-Wormhole pool
   @param _data Encoded AmountParams as _data with LP Token amount
   */
  function openPosition(bytes calldata _data) public onlyKeeper {
    ConvexPositionHandler._openPosition(_data);
  }

  /**
   @notice To close Convex Staking Position
   @dev Unstakes from Convex position and gives back them as Curve Lp Tokens along with rewards like CRV, CVX.
   @param _data Encoded AmountParams as _data with LP token amount
   */
  function closePosition(bytes calldata _data) public onlyKeeper {
    ConvexPositionHandler._closePosition(_data);
  }

  /*///////////////////////////////////////////////////////////////
                    REWARDS FUNCTION
  //////////////////////////////////////////////////////////////*/
  /**
   @notice To claim rewards from Convex Staking position
   @dev Claims Convex Staking position rewards, and converts them to wantToken i.e., USDC.
   @param _data is not needed here (empty param, to satisfy interface)
   */
  function claimRewards(bytes calldata _data) public onlyKeeper {
    ConvexPositionHandler._claimRewards(_data);
  }
}
