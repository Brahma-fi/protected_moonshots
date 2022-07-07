// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";
import {DecimalMath} from "@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol";

contract LyraController is LyraAdapter {
    using DecimalMath for uint256;

    function getPremiumForStrike(
        uint256 strikeId,
        bool isCall,
        uint256 amount
    ) external returns (uint256) {
        (uint256 callPremium, uint256 putPremium) = LyraAdapter
            ._getPurePremiumForStrike(strikeId);
        uint256 totalPremium = (isCall ? callPremium : putPremium)
            .multiplyDecimal(amount);

        return totalPremium;
    }
}
