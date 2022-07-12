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

    function getPremiumForStrike(
        uint256 strikeId,
        bool isCall,
        uint256 amount
    ) external view returns (uint256) {
        OptionMarket.Strike memory strike = OptionMarket(
            0x1d42a98848e022908069c2c545aE44Cc78509Bc8
        ).getStrike(strikeId);

        (uint256 callPrice, uint256 putPrice) = LyraAdapter._optionPriceGWAV(
            strikeId,
            30
        );
        console.log("price:", callPrice);
        (uint256 callPremium, uint256 putPremium) = LyraAdapter
            ._getPurePremiumForStrike(strikeId);
        console.log("premium:", callPremium);

        uint256 iv = LyraAdapter._ivGWAV(strike.boardId, 30);
        uint256 vol = LyraAdapter._volGWAV(strikeId, 30);
        console.log("iv:", iv);
        console.log("vol:", vol);

        uint256 totalPremium = (
            isCall ? (callPremium + callPrice) : (putPremium + putPrice)
        ).multiplyDecimal(amount) + LyraAdapter._vegaGWAV(strikeId, 30);
        console.log("Total:", amount, totalPremium);

        return totalPremium;
    }
}
