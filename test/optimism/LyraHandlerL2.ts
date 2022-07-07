/* eslint-disable node/no-missing-import */
import * as dotenv from "dotenv";

import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20, LyraPositionHandlerL2, WantERC20 } from "../../src/types";

import { switchToNetwork } from "../utils/hardhat";

// import { moverCall } from "../api";
import { randomSigner } from "../utils";
import {
  lyraETHOptionMarketAddress,
  movrRegistry,
  sUSDaddress,
  wantTokenL2,
} from "../../scripts/constants";
import { getLyraStrikeId, getOptimalNumberOfOptionsToBuy } from "../utils/lyra";
import { BigNumber } from "ethers";

describe("LyraHandlerL2 [OPTIMISM]", function () {
  let signer: SignerWithAddress,
    invalidSigner: SignerWithAddress,
    governance: SignerWithAddress,
    lyraL2Handler: LyraPositionHandlerL2,
    sUSD: IERC20,
    usdc: IERC20;

  before(async () => {
    dotenv.config();
    await switchToNetwork(
      String(process.env.QUICKNODE_OPTIMISM_URL),
      Number(process.env.OPTIMISM_BLOCK_NUMBER)
    );

    signer = await randomSigner();
    governance = await randomSigner();
    invalidSigner = await randomSigner();

    const LyraHandler = await hre.ethers.getContractFactory(
      "LyraPositionHandlerL2",
      signer
    );
    sUSD = (await hre.ethers.getContractAt("ERC20", sUSDaddress)) as IERC20;
    usdc = (await hre.ethers.getContractAt("IERC20", wantTokenL2)) as IERC20;
    const slippage = BigNumber.from(1000);
    lyraL2Handler = (await LyraHandler.deploy(
      wantTokenL2,
      invalidSigner.address,
      lyraETHOptionMarketAddress,
      signer.address,
      governance.address,
      movrRegistry,
      slippage
    )) as LyraPositionHandlerL2;
  });

  // Operation - Expected Behaviour
  // initalized -  Exepcting contract to be initalized properly with some susd for testing
  it("Contract initialized correctly", async function () {
    expect(await lyraL2Handler.keeper()).equals(
      signer.address,
      "signer address check"
    );
    expect(await lyraL2Handler.wantTokenL2()).equals(usdc.address);
    expect(await lyraL2Handler.lyraOptionMarket()).equals(
      lyraETHOptionMarketAddress
    );
    expect(await lyraL2Handler.positionHandlerL1()).equals(
      invalidSigner.address
    );
    expect(await lyraL2Handler.socketRegistry()).equals(movrRegistry);

    const usdcBalance = await usdc.balanceOf(lyraL2Handler.address);

    expect(usdcBalance.gt(0));
  });

  // Operation - Expected Behaviour
  // deposit - Convert the usdc received to susd for purchasing option on lyra.
  it("Deposit", async function () {
    const beforeSusdBalance = await sUSD.balanceOf(lyraL2Handler.address);

    await usdc
      .connect(signer)
      .transfer(lyraL2Handler.address, await usdc.balanceOf(signer.address));
    const startPositionValue = await lyraL2Handler.positionInWantToken();

    await lyraL2Handler.connect(signer).deposit();

    const afterSusdBalance = await sUSD.balanceOf(lyraL2Handler.address);
    expect(afterSusdBalance.gt(beforeSusdBalance)).equals(true);

    const finalPositionValue = await lyraL2Handler.positionInWantToken();
    const percentage = startPositionValue
      .sub(finalPositionValue)
      .mul(100)
      .div(startPositionValue);

    console.log("[deposit] percentage", percentage.toString());

    expect(percentage.lt(BigNumber.from(10))).equals(true);
  });

  // Operation - Expected Behaviour
  // openPosition - Purchase new call option on LyraOptionMarket
  //              - Should only work if sent using Keeper address
  //              - Lyra's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if LyraPosition is already active
  it("Can purchase Call and sell Call", async function () {
    expect((await lyraL2Handler.currentPosition()).isActive).equals(false);
    const listingId = await getLyraStrikeId();
    const beforeBalance = await sUSD.balanceOf(lyraL2Handler.address);

    const { optimalAmount } = await getOptimalNumberOfOptionsToBuy(
      beforeBalance.mul(99).div(100),
      listingId,
      true
    );

    await lyraL2Handler.openPosition(listingId, true, optimalAmount, false);

    expect((await lyraL2Handler.currentPosition()).isActive).equals(true);
    expect(
      (await lyraL2Handler.currentPosition()).optionsPurchased.eq(optimalAmount)
    ).equals(true);
    const afterBalance = await sUSD.balanceOf(lyraL2Handler.address);
    expect(beforeBalance.gt(afterBalance)).equals(true);
    console.log(
      "percentage of used funds",
      beforeBalance.sub(afterBalance).mul(100).div(beforeBalance)
    );

    // close position
    const beforeUsdcBalance = await usdc.balanceOf(lyraL2Handler.address);
    await lyraL2Handler.closePosition(false);
    const afterUsdcBalance = await usdc.balanceOf(lyraL2Handler.address);
    expect(afterUsdcBalance.gt(beforeUsdcBalance)).equals(true);
    expect((await lyraL2Handler.currentPosition()).isActive).equals(false);
  });

  // Operation - Expected Behaviour
  // openPosition - Purchase new option on LyraOptionMarket
  //              - Should only work if sent using Keeper address
  //              - Lyra's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if LyraPosition is already active
  it("Can purchase Put and sell Put", async function () {
    expect((await lyraL2Handler.currentPosition()).isActive).equals(false);
    const listingId = await getLyraStrikeId();
    await lyraL2Handler.connect(signer).deposit();
    const beforeBalance = await sUSD.balanceOf(lyraL2Handler.address);

    const { optimalAmount } = await getOptimalNumberOfOptionsToBuy(
      beforeBalance.mul(99).div(100),
      listingId,
      false
    );
    console.log("optimal amount", optimalAmount);
    await lyraL2Handler.openPosition(listingId, false, optimalAmount, false);
    expect((await lyraL2Handler.currentPosition()).isActive).equals(true);
    expect(
      (await lyraL2Handler.currentPosition()).optionsPurchased.eq(optimalAmount)
    ).equals(true);
    const afterBalance = await sUSD.balanceOf(lyraL2Handler.address);
    expect(beforeBalance.gt(afterBalance)).equals(true);

    // close position
    await expect(lyraL2Handler.closePosition(true)).to.be.revertedWith(
      "board must be liquidated"
    );
    const beforeUsdcBalance = await usdc.balanceOf(lyraL2Handler.address);
    await lyraL2Handler.closePosition(false);
    const afterUsdcBalance = await usdc.balanceOf(lyraL2Handler.address);
    expect(afterUsdcBalance.gt(beforeUsdcBalance)).equals(true);
    expect((await lyraL2Handler.currentPosition()).isActive).equals(false);
  });

  it("Can change governance", async function () {
    expect(await lyraL2Handler.governance()).equals(governance.address);
    expect(
      lyraL2Handler.connect(invalidSigner).setGovernance(invalidSigner.address)
    ).to.be.revertedWith("ONLY_GOVERNANCE");
    await lyraL2Handler
      .connect(governance)
      .setGovernance(invalidSigner.address);
    expect(
      lyraL2Handler.connect(governance).acceptGovernance()
    ).to.be.revertedWith("NOT_PENDING_GOVERNANCE");
    await lyraL2Handler.connect(invalidSigner).acceptGovernance();
    expect(await lyraL2Handler.governance()).equals(invalidSigner.address);
    await lyraL2Handler
      .connect(invalidSigner)
      .setGovernance(governance.address);
    await lyraL2Handler.connect(governance).acceptGovernance();
    expect(await lyraL2Handler.governance()).equals(governance.address);
  });

  it("Can set socket registry", async function () {
    expect(await lyraL2Handler.socketRegistry()).equals(movrRegistry);
    expect(
      lyraL2Handler
        .connect(invalidSigner)
        .setSocketRegistry(invalidSigner.address)
    ).to.be.revertedWith("ONLY_GOVERNANCE");
    await lyraL2Handler
      .connect(governance)
      .setSocketRegistry(invalidSigner.address);
    expect(await lyraL2Handler.socketRegistry()).equals(invalidSigner.address);
    await lyraL2Handler.connect(governance).setSocketRegistry(movrRegistry);
    expect(await lyraL2Handler.socketRegistry()).equals(movrRegistry);
  });

  it("Can change slippage", async function () {
    const slippage = await lyraL2Handler.slippage();
    const newSlippage = BigNumber.from(560);
    expect(
      lyraL2Handler.connect(invalidSigner).setSlippage(newSlippage)
    ).to.be.revertedWith("ONLY_GOVERNANCE");
    await lyraL2Handler.connect(governance).setSlippage(newSlippage);
    expect(await lyraL2Handler.slippage()).equals(newSlippage);
    await lyraL2Handler.connect(governance).setSlippage(slippage);
    expect(await lyraL2Handler.slippage()).equals(slippage);
  });
});
