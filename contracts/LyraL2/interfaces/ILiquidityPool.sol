//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

interface ILiquidityPool {
    /// @dev These are all in quoteAsset amounts.
    struct Liquidity {
        uint256 freeCollatLiquidity;
        uint256 usedCollatLiquidity;
        uint256 freeDeltaLiquidity;
        uint256 usedDeltaLiquidity;
    }

    function deposit(address beneficiary, uint256 amount)
        external
        returns (uint256);

    function withdraw(address beneficiary, uint256 certificateId)
        external
        returns (uint256 value);
}
