// SPDX-License-Identifier: ISC
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface ILyraGlobals {
    function getSpotPriceForMarket(address _contractAddress)
        external
        view
        returns (uint256);
}
