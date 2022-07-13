// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";
import {OptionMarket} from "@lyrafinance/protocol/contracts/OptionMarket.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";

import "hardhat/console.sol";

contract MockLyraAdapter is LyraAdapter {
    using DecimalMath for uint256;

    constructor() {
        setLyraAddresses(
            0xF5A0442D4753cA1Ea36427ec071aa5E786dA5916,
            0x1d42a98848e022908069c2c545aE44Cc78509Bc8,
            0xA5407eAE9Ba41422680e2e00537571bcC53efBfD,
            0xA5407eAE9Ba41422680e2e00537571bcC53efBfD
        );
    }

    // function getPremiumForStrike(
    //   uint256 strikeId,
    //   bool isCall,
    //   uint256 amount
    // ) external view returns (uint256) {
    //   openPositionParams = _getTradeInputParams(
    //     strikeId,
    //     0,
    //     isCall
    //       ? LyraAdapter.OptionType.LONG_CALL
    //       : LyraAdapter.OptionType.LONG_PUT,
    //     amount
    //   );

    //   LyraAdapter.TradeResult memory tradeResult = address(this).call();
    // }

    // function _getTradeInputParams(
    //   uint256 strikeId,
    //   uint256 positionId,
    //   LyraAdapter.OptionType optionType,
    //   uint256 amount
    // ) internal returns (LyraAdapter.TradeInputParameters memory) {
    //   return
    //     LyraAdapter.TradeInputParameters({
    //       strikeId: strikeId,
    //       positionId: positionId,
    //       iterations: 3,
    //       optionType: optionType,
    //       amount: amount,
    //       setCollateralTo: 0,
    //       minTotalCost: 0,
    //       maxTotalCost: sUSD.balanceOf(address(this)),
    //       rewardRecipient: address(this)
    //     });
    // }
}
