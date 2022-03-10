import { expect } from "chai";
import hre from "hardhat";

import {MetaRouter, ConvexTradeExecutor, ERC20} from "../src/types";
import {wantTokenL1, ust3Pool, baseRewardPool, curve3PoolZap} from "../scripts/constants";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


let metaRouter: MetaRouter;
let convexTradeExecutor: ConvexTradeExecutor;
let token_name: string = "BUSDC";
let token_symbol: string = "BUSDC";
let token_decimals: number = 6;
let keeperAddress: string;
let governanceAddress: string;
let signer: SignerWithAddress;

describe("Metarouter",  function () {


    before(async () => {
      keeperAddress = "0x1B7BAa734C00298b9429b518D621753Bb0f6efF2";
      governanceAddress = keeperAddress;
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [keeperAddress],
      });    
      signer = await hre.ethers.getSigner(keeperAddress);

    });

    it("Check address assignment meta router", async function () {
      const MetaRouter = await hre.ethers.getContractFactory("MetaRouter",signer);
      metaRouter = await MetaRouter.deploy(token_name, token_symbol, token_decimals, wantTokenL1, keeperAddress, governanceAddress) as MetaRouter;
      await metaRouter.deployed();
      console.log("MetaRouter deployed at: ", metaRouter.address);
      expect(await metaRouter.decimals()).to.equals(token_decimals);
      expect(await metaRouter.name()).to.equal(token_name);
      expect(await metaRouter.keeper()).to.equals(keeperAddress);
      expect(await metaRouter.governance()).to.equal(governanceAddress);
    });



    it("Check address assignment in convex trade executor", async function () {
      let _harvester = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
      const ConvexExecutor = await hre.ethers.getContractFactory("ConvexTradeExecutor");
      convexTradeExecutor = await ConvexExecutor.deploy(baseRewardPool, ust3Pool, curve3PoolZap, _harvester, metaRouter.address) as ConvexTradeExecutor;
      await convexTradeExecutor.deployed();

      expect(await convexTradeExecutor.harvester()).to.equals(_harvester);
      expect(await convexTradeExecutor.keeper()).to.equals(keeperAddress);
      expect(await convexTradeExecutor.governance()).to.equals(governanceAddress);
      expect(await convexTradeExecutor.router()).to.equals(metaRouter.address);
    });

    it("Adding and removing an executor", async function () {
      await metaRouter.addExecutor(convexTradeExecutor.address);
      expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(1));

      await metaRouter.removeExecutor(convexTradeExecutor.address);
      expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(0));
    });

    it("Depositing funds into Metarouter", async function () {
      let amount = BigNumber.from(100e6);
      const USDC = (await hre.ethers.getContractAt(
        "ERC20",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      )) as ERC20;
      await USDC.connect(signer).approve(metaRouter.address, amount);
      await metaRouter.deposit(amount, keeperAddress);
      expect(await metaRouter.totalRouterFunds()).to.equal(amount);
      expect(await metaRouter.totalSupply()).to.equal(amount);
      expect(await metaRouter.balanceOf(signer.address)).to.equal(amount);
    });

    it("Withdrawing funds from Metarouter", async function () {
    });

  });