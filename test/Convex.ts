import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert } from "console";
import { ethers } from "hardhat";
import { wantTokenL1 } from "../scripts/constants";
import {
  ConvexTradeExecutor,
  Harvester,
  Hauler,
  IConvexRewards,
  IERC20
} from "../src/types";
import { getUSDCContract, setup } from "./utils";

const ConvexTradeExecutorConfig = {
  baseRewardPool: "0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A",
  ust3Pool: "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269",
  curve3PoolZap: "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
};

const HarvesterConfig = {
  wantToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  slippage: 50000
};

let convexTradeExecutor: ConvexTradeExecutor;
let harvester: Harvester;
let hauler: Hauler;
let USDC: IERC20;
let LP: IERC20;

let keeperAddress: string,
  governanceAddress: string,
  signer: SignerWithAddress,
  invalidSigner: SignerWithAddress;

const deploy = async () => {
  const convexTradeExecutorFactory = await ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  const HarvesterFactory = await ethers.getContractFactory("Harvester");
  const HaulerFactory = await ethers.getContractFactory("Hauler", signer);
  LP = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    ConvexTradeExecutorConfig.ust3Pool
  )) as IERC20;

  USDC = await getUSDCContract();

  hauler = (await HaulerFactory.deploy(
    "PMUSDC",
    "PMUSDC",
    6,
    wantTokenL1,
    keeperAddress,
    governanceAddress
  )) as Hauler;

  harvester = (await HarvesterFactory.deploy(
    keeperAddress,
    ...Object.values(HarvesterConfig),
    governanceAddress
  )) as Harvester;

  convexTradeExecutor = (await convexTradeExecutorFactory.deploy(
    ...Object.values(ConvexTradeExecutorConfig),
    harvester.address,
    hauler.address
  )) as ConvexTradeExecutor;
};

describe.only("Convex Trade Executor", function () {
  before(async () => {
    [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
    await deploy();
  });

  it("Should deploy Harvester correctly", async () => {
    expect(await harvester.governance()).equals(governanceAddress);
    expect(await harvester.wantToken()).equals(HarvesterConfig.wantToken);
    expect(await harvester.slippage()).equals(HarvesterConfig.slippage);
  });

  it("Should deploy ConvexTradeExecutor correctly", async () => {
    expect(await convexTradeExecutor.harvester()).equals(harvester.address);
    expect(await convexTradeExecutor.governance()).equals(governanceAddress);

    expect(await convexTradeExecutor.wantToken()).equals(wantTokenL1);
    expect(await convexTradeExecutor.lpToken()).equals(
      ConvexTradeExecutorConfig.ust3Pool
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

  it("Should deposit correctly", async () => {
    await USDC.connect(signer).approve(
      convexTradeExecutor.address,
      ethers.utils.parseEther("1")
    );
    const usdcBal = await USDC.balanceOf(signer.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[usdcBal]]
    );

    expect(await USDC.balanceOf(convexTradeExecutor.address)).equals(0);
    expect(await LP.balanceOf(convexTradeExecutor.address)).equals(0);

    await USDC.connect(signer).transfer(convexTradeExecutor.address, usdcBal);
    expect(await USDC.balanceOf(convexTradeExecutor.address)).equals(usdcBal);

    await convexTradeExecutor.connect(signer).initiateDeposit(paramsInBytes);

    console.log(
      "LP after deposit:",
      (await LP.balanceOf(convexTradeExecutor.address)).toString()
    );

    expect((await LP.balanceOf(convexTradeExecutor.address)).gt(0));
  });

  it("Should open position correctly", async () => {
    const convexUsdcBal = await LP.balanceOf(convexTradeExecutor.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[convexUsdcBal]]
    );
    const baseRewardPool = (await ethers.getContractAt(
      "IConvexRewards",
      ConvexTradeExecutorConfig.baseRewardPool
    )) as IConvexRewards;

    expect(await baseRewardPool.balanceOf(convexTradeExecutor.address)).equals(
      0
    );

    await convexTradeExecutor.connect(signer).openPosition(paramsInBytes);
    const convexStakedBal = await baseRewardPool.balanceOf(
      convexTradeExecutor.address
    );

    expect(convexStakedBal.gt(0));
  });
});
