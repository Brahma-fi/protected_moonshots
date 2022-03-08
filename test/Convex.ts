import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ConvexTradeExecutor, Harvester } from "../src/types";

const ConvexTradeExecutorConfig = {
  baseRewardPool: "0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A",
  ust3Pool: "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269",
  curve3PoolZap: "0xA79828DF1850E8a3A3064576f380D90aECDD3359",
  wantToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  lpToken: "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269"
};

const HarvesterConfig = {
  wantToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  slippage: 50000
};

let convexTradeExecutor: ConvexTradeExecutor;
let harvester: Harvester;
let signer: SignerWithAddress;

const deploy = async () => {
  const convexTradeExecutorFactory = await ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  const harvesterFactory = await ethers.getContractFactory("Harvester");

  harvester = (await harvesterFactory.deploy(
    signer.address,
    ...Object.values(HarvesterConfig),
    signer.address
  )) as Harvester;

  convexTradeExecutor = (await convexTradeExecutorFactory.deploy(
    ...Object.values(ConvexTradeExecutorConfig),
    harvester.address,
    signer.address,
    signer.address
  )) as ConvexTradeExecutor;
};

describe("Convex Trade Executor", function () {
  before(async () => {
    signer = (await ethers.getSigners())[0];
    await deploy();
  });

  it("Should deploy Harvester correctly", async () => {
    expect(await harvester.governance()).equals(signer.address);
    expect(await harvester.wantToken()).equals(HarvesterConfig.wantToken);
    expect(await harvester.slippage()).equals(HarvesterConfig.slippage);
  });

  it("Should deploy ConvexTradeExecutor correctly", async () => {
    expect(await convexTradeExecutor.harvester()).equals(harvester.address);
    expect(await convexTradeExecutor.governance()).equals(signer.address);

    expect(await convexTradeExecutor.wantToken()).equals(
      ConvexTradeExecutorConfig.wantToken
    );
    expect(await convexTradeExecutor.lpToken()).equals(
      ConvexTradeExecutorConfig.lpToken
    );
    expect(await convexTradeExecutor.lpToken()).equals(
      ConvexTradeExecutorConfig.lpToken
    );

    expect(await convexTradeExecutor.baseRewardPool()).equals(
      ConvexTradeExecutorConfig.baseRewardPool
    );
    expect(await convexTradeExecutor.ust3Pool()).equals(
      ConvexTradeExecutorConfig.ust3Pool
    );
    expect(await convexTradeExecutor.curve3PoolZap()).equals(
      ConvexTradeExecutorConfig.curve3PoolZap
    );
  });
});
