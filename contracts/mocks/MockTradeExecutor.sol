//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "../BaseTradeExecutor.sol";

contract MockTradeExecutor is BaseTradeExecutor {
    /// @notice creates a new MockTradeExecutor with required state
    /// @param _vault address of vault
    constructor(address _vault) BaseTradeExecutor(_vault) {}

    /*///////////////////////////////////////////////////////////////
                         VIEW FUNCTONS
    //////////////////////////////////////////////////////////////*/
    /// @notice This gives the total funds in the contract in terms of ETH
    /// @return totalBalance Total balance of contract in ETH
    /// @return blockNumber Current block number
    function totalFunds() public view override returns (uint256, uint256) {
        return (
            IERC20(vaultWantToken()).balanceOf(address(this)),
            block.number
        );
    }

    /*///////////////////////////////////////////////////////////////
                    DEPOSIT / WITHDRAW FUNCTIONS
     //////////////////////////////////////////////////////////////*/
    /// @notice To deposit into the Curve Pool
    /// @dev Converts WETH to lp tokens via Curve
    /// @param _data Encoded AmountParams as _data with WETH amount
    function _initateDeposit(bytes calldata _data) internal override {
        BaseTradeExecutor.confirmDeposit();
    }

    /// @notice To withdraw from ConvexHandler
    /// @dev  Converts Curve Lp Tokens  back to WETH.
    /// @param _data Encoded WithdrawParams as _data with WETH token amount
    function _initiateWithdraw(bytes calldata _data) internal override {
        BaseTradeExecutor.confirmWithdraw();
    }

    /// @notice Functionlity to execute after deposit is completed
    /// @dev This is not required in ConvexTradeExecutor, hence empty. This follows the BaseTradeExecutor interface
    function _confirmDeposit() internal override {}

    /// @notice Functionlity to execute after withdraw is completed
    /// @dev This is not required in ConvexTradeExecutor, hence empty. This follows the BaseTradeExecutor interface
    function _confirmWithdraw() internal override {}

    /*///////////////////////////////////////////////////////////////
                    OPEN / CLOSE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    ///@notice To open staking position in Convex by staking on the steth pool
    ///@param _data Encoded AmountParams as _data with LP Token amount
    function openPosition(bytes calldata _data) public onlyKeeper {}

    /// @notice To close Convex Staking Position
    /// @param _data Encoded AmountParams as _data with LP token amount
    function closePosition(bytes calldata _data) public onlyKeeper {}

    /*///////////////////////////////////////////////////////////////
                    REWARDS FUNCTION
    //////////////////////////////////////////////////////////////*/
    /// @notice To claim rewards from Convex Staking position
    /// @param _data is not needed here (empty param)
    function claimRewards(bytes calldata _data) public onlyKeeper {}
}
