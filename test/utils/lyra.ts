/* eslint-disable node/no-missing-import */
import dayjs from "dayjs";
import { BigNumber } from "ethers";

import { ethers } from "hardhat";
import {
  lyraETHOptionMarketAddress,
  movrRegistry,
  sUSDaddress,
  synthetixAdapterAddress,
  wantTokenL2,
} from "../../scripts/constants";
import {
  ISynthetixAdapter,
  IOptionMarket,
  LyraPositionHandlerL2,
} from "../../src/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getSigner } from "./signers";
import { IERC20 } from "@lyrafinance/protocol/dist/typechain-types";
import { switchToNetwork } from "./hardhat";

import * as dotenv from "dotenv";

let lyraPH: LyraPositionHandlerL2;
let signer: SignerWithAddress;

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
  isCall: boolean
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

(async () => {
  dotenv.config();

  switchToNetwork(
    `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );

  const keeper = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
  const LyraPH = await ethers.getContractFactory("LyraPositionHandlerL2", {
    libraries: {
      "@lyrafinance/protocol/contracts/libraries/BlackScholes.sol:BlackScholes":
        "0xE97831964bF41C564EDF6629f818Ed36C85fD520",
    },
  });
  lyraPH = (await LyraPH.deploy(
    wantTokenL2,
    keeper,
    lyraETHOptionMarketAddress,
    keeper,
    keeper,
    movrRegistry,
    1000
  )) as LyraPositionHandlerL2;

  signer = await getSigner(keeper);

  const usdc = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    wantTokenL2
  )) as IERC20;
  const sUSD = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    sUSDaddress
  )) as IERC20;

  console.log(
    "keeper usdc bal:",
    (await usdc.balanceOf(signer.address)).toString()
  );

  await usdc
    .connect(signer)
    .transfer(lyraPH.address, await usdc.balanceOf(signer.address));
  console.log(
    "lyra usdc bal:",
    (await usdc.balanceOf(lyraPH.address)).toString()
  );

  await lyraPH.connect(signer).deposit();
  console.log(
    "lyra usdc bal after deposit:",
    (await usdc.balanceOf(lyraPH.address)).toString()
  );

  console.log(
    "lyra pos value:",
    (await lyraPH.positionInWantToken()).toString()
  );
  console.log(
    "l2 susd bal:",
    (await sUSD.balanceOf(lyraPH.address)).toString()
  );

  const strike = await getLyraStrikeId();
  console.log("strike:", strike.toString());

  const optimalAmount = await getOptimalNumberOfOptionsToBuy(
    BigNumber.from(1500).mul(1e9).mul(1e9),
    strike,
    true
  );
  console.log("optimal amount:", optimalAmount);
})();
