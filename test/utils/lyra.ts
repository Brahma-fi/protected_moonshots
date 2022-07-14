/* eslint-disable node/no-missing-import */
import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { ethers } from "hardhat";
import {
  lyraETHOptionMarketAddress,
  synthetixAdapterAddress,
} from "../../scripts/constants";
import {
  ISynthetixAdapter,
  IOptionMarket,
  LyraPositionHandlerL2,
} from "../../src/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const getLyraStrikeId = async (): Promise<BigNumber> => {
  const lyraETHMarket = (await ethers.getContractAt(
    "IOptionMarket",
    lyraETHOptionMarketAddress
  )) as IOptionMarket;

  const synthetixAdapter = (await ethers.getContractAt(
    "ISynthetixAdapter",
    synthetixAdapterAddress
  )) as ISynthetixAdapter;

  // Get current ETH price
  const currentETHPrice = await synthetixAdapter.getSpotPriceForMarket(
    lyraETHOptionMarketAddress
  );

  // Get all boards data to find board expiring this week
  const boardsPromise = (await lyraETHMarket.getLiveBoards()).map((listing) =>
    lyraETHMarket.getOptionBoard(listing)
  );
  const boardsData = await Promise.all(boardsPromise);

  const boardExpiringThisWeek =
    boardsData
      .find(([, expiryUNIX, ,]) => {
        const expiryTime = new Date(expiryUNIX.toNumber() * 1000);

        if (dayjs(new Date()).isSame(expiryTime, "week")) return true;
        return false;
      })?.[0]
      ?.toNumber() || 0;

  // Get all strikes of the board to find a strike with price closest to current ETH price
  const boardStrikesPromise = (
    await lyraETHMarket.getBoardStrikes(boardExpiringThisWeek)
  ).map((strike) => lyraETHMarket.getStrike(strike));

  const boardListingStrikePrices = (await Promise.all(boardStrikesPromise)).map(
    ([id, strike, , , , , , ,]) => ({ id, strike })
  );

  const strikeWithClosestPrice = boardListingStrikePrices.reduce((prev, curr) =>
    curr.strike
      .sub(currentETHPrice)
      .abs()
      .lt(prev.strike.sub(currentETHPrice).abs())
      ? curr
      : prev
  );
  console.log(
    "strike data",
    strikeWithClosestPrice.strike,
    boardExpiringThisWeek
  );

  // Return strike with closest price
  return strikeWithClosestPrice.id;
};

export const getOptimalNumberOfOptionsToBuy = async (
  sUSDAmount: BigNumber,
  strikeId: BigNumber,
  isCall: boolean,
  lyraPH: LyraPositionHandlerL2,
  signer: SignerWithAddress
): Promise<{
  optimalAmount: BigNumber;
  price: BigNumber;
}> => {
  const getOptionPrice = async (amount: BigNumber): Promise<BigNumber> => {
    const result = await lyraPH
      .connect(signer)
      .callStatic.openPosition(strikeId, isCall, amount, false);
    const totalCost = (result?.totalCost || BigNumber.from("0")).add(
      result?.totalFee || 0
    );

    console.log(`[cost] ${amount}: ${totalCost.toString()}`);

    return totalCost;
  };

  const minPremium = await getOptionPrice(ethers.utils.parseEther("1"));

  const possibleNumOptions = sUSDAmount.gte(minPremium)
    ? sUSDAmount.div(minPremium)
    : BigNumber.from(1);
  const actualPriceOfPossibleNum = await getOptionPrice(
    ethers.utils.parseEther(possibleNumOptions.toString())
  );

  if (actualPriceOfPossibleNum.eq(sUSDAmount)) {
    return {
      optimalAmount: possibleNumOptions,
      price: actualPriceOfPossibleNum,
    };
  }
  const isActualPriceLesserThanAmt = actualPriceOfPossibleNum.lt(sUSDAmount);

  let optimalPriceToPay = actualPriceOfPossibleNum;
  let optimalNum = ethers.utils.parseEther(possibleNumOptions.toString());

  while (true) {
    const nextNum = isActualPriceLesserThanAmt
      ? optimalNum.add(ethers.utils.parseEther("0.5"))
      : optimalNum.sub(ethers.utils.parseEther("0.5"));
    const nextPrice = await getOptionPrice(nextNum);

    if (
      isActualPriceLesserThanAmt
        ? nextPrice.lte(sUSDAmount)
        : nextPrice.gte(sUSDAmount)
    ) {
      optimalNum = nextNum;
      optimalPriceToPay = nextPrice;
    } else {
      break;
    }
  }

  return {
    optimalAmount: optimalNum,
    price: optimalPriceToPay,
  };
};
