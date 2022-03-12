import { expect } from "chai";
import hre from "hardhat";

import { MetaRouter, ConvexTradeExecutor, ERC20 } from "../src/types";
import {
  wantTokenL1,
  ust3Pool,
  baseRewardPool,
  curve3PoolZap,
} from "../scripts/constants";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setup } from "./utils";

let metaRouter: MetaRouter;
let convexTradeExecutor: ConvexTradeExecutor;
let token_name: string = "BUSDC";
let token_symbol: string = "BUSDC";
let token_decimals: number = 6;
let keeperAddress: string;
let governanceAddress: string;
let signer: SignerWithAddress;
let invalidSigner: SignerWithAddress;

describe("Metarouter", function () {
  before(async () => {
     [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
  });

  it("Check address assignment meta router", async function () {
    const MetaRouter = await hre.ethers.getContractFactory(
      "MetaRouter",
      signer
    );
    metaRouter = (await MetaRouter.deploy(
      token_name,
      token_symbol,
      token_decimals,
      wantTokenL1,
      keeperAddress,
      governanceAddress
    )) as MetaRouter;
    await metaRouter.deployed();
    console.log("MetaRouter deployed at: ", metaRouter.address);
    expect(await metaRouter.decimals()).to.equals(token_decimals);
    expect(await metaRouter.name()).to.equal(token_name);
    expect(await metaRouter.keeper()).to.equals(keeperAddress);
    expect(await metaRouter.governance()).to.equal(governanceAddress);
  });

  it("Check address assignment in convex trade executor", async function () {
    let _harvester = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
    const ConvexExecutor = await hre.ethers.getContractFactory(
      "ConvexTradeExecutor"
    );
    convexTradeExecutor = (await ConvexExecutor.deploy(
      baseRewardPool,
      ust3Pool,
      curve3PoolZap,
      _harvester,
      metaRouter.address
    )) as ConvexTradeExecutor;
    await convexTradeExecutor.deployed();

    expect(await convexTradeExecutor.harvester()).to.equals(_harvester);
    expect(await convexTradeExecutor.keeper()).to.equals(keeperAddress);
    expect(await convexTradeExecutor.governance()).to.equals(governanceAddress);
    expect(await convexTradeExecutor.router()).to.equals(metaRouter.address);
  });

  it("Adding and removing an executor", async function () {
    async function getExecutor() {
      const ConvexExecutor = await hre.ethers.getContractFactory(
        "ConvexTradeExecutor"
      );
      let TradeExecutor = (await ConvexExecutor.deploy(
        baseRewardPool,
        ust3Pool,
        curve3PoolZap,
        "0xAE75B29ADe678372D77A8B41225654138a7E6ff1",
        metaRouter.address
      )) as ConvexTradeExecutor;
      await TradeExecutor.deployed();
      return TradeExecutor;
    }

    let tempExecutor = await getExecutor();

    await metaRouter.addExecutor(convexTradeExecutor.address);
    expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(1));

    await expect(
      metaRouter.connect(invalidSigner).removeExecutor(tempExecutor.address)
    ).to.be.revertedWith("Only keeper call");
    console.log("temp executor address: ", tempExecutor.address);
    console.log("convex executor address: ", convexTradeExecutor.address);

    await metaRouter.removeExecutor(tempExecutor.address);
    await metaRouter.addExecutor(tempExecutor.address);
    await metaRouter.addExecutor(tempExecutor.address);
    console.log(
      "executors",
      await metaRouter.executorByIndex(BigNumber.from(0)),
      await metaRouter.executorByIndex(BigNumber.from(1))
    );

    await metaRouter.removeExecutor(convexTradeExecutor.address);
    expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(1));
  });

  it("Depositing funds into Metarouter", async function () {
    let amount = BigNumber.from(100e6);
    const USDC = (await hre.ethers.getContractAt(
      "ERC20",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    )) as ERC20;
    await USDC.connect(signer).approve(metaRouter.address, amount);
    await metaRouter.deposit(amount, keeperAddress);
    expect(await metaRouter.totalRouterFunds()).to.equal(amount);
    expect(await metaRouter.totalSupply()).to.equal(amount);
    expect(await metaRouter.balanceOf(signer.address)).to.equal(amount);
  });

  it("Withdrawing funds from Metarouter", async function () {
    let amount = BigNumber.from(100e6);
    await metaRouter.withdraw(amount, signer.address);
    expect(await metaRouter.totalRouterFunds()).to.equal(BigNumber.from(0));
    expect(await metaRouter.totalSupply()).to.equal(BigNumber.from(0));
    expect(await metaRouter.balanceOf(signer.address)).to.equal(
      BigNumber.from(0)
    );
  });

});
