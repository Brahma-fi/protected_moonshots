import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
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
  convexBooster: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  ust3Pool: "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269",
  curve3PoolZap: "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
};

const HarvesterConfig = {
  wantToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  slippage: 50000
};

const MAX_INT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const CRV_ADDR = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const CVX_ADDR = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";

let convexTradeExecutor: ConvexTradeExecutor;
let harvester: Harvester;
let hauler: Hauler;
let baseRewardPool: IConvexRewards;

let USDC: IERC20;
let LP: IERC20;
let CRV: IERC20;
let CVX: IERC20;

let keeperAddress: string,
  governanceAddress: string,
  governance: SignerWithAddress,
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
  CRV = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    CRV_ADDR
  )) as IERC20;
  CVX = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    CVX_ADDR
  )) as IERC20;

  baseRewardPool = (await ethers.getContractAt(
    "IConvexRewards",
    ConvexTradeExecutorConfig.baseRewardPool
  )) as IConvexRewards;

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
    governance = await ethers.getSigner(governanceAddress);
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

    await convexTradeExecutor.connect(signer).initiateDeposit(paramsInBytes, {
      gasLimit: 5e6
    });

    console.log(
      "LP after deposit:",
      (await LP.balanceOf(convexTradeExecutor.address)).toString()
    );

    expect((await LP.balanceOf(convexTradeExecutor.address)).gt(0));
  });

  it("Should open position correctly", async () => {
    const convexLpBal = await LP.balanceOf(convexTradeExecutor.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[convexLpBal]]
    );

    expect(await baseRewardPool.balanceOf(convexTradeExecutor.address)).equals(
      0
    );

    await convexTradeExecutor.connect(signer).openPosition(paramsInBytes, {
      gasLimit: 5e6
    });
    const convexStakedBal = await baseRewardPool.balanceOf(
      convexTradeExecutor.address
    );
    console.log("Convex staked bal:", convexStakedBal.toString());

    expect(convexStakedBal).equals(convexLpBal);
  });

  it("Should setup harvester correctly and initialize on handler", async () => {
    await expect(harvester.swapTokens(0)).to.be.reverted;
    // await expect(harvester.swapTokens(1)).to.be.reverted;

    await harvester.connect(signer).addSwapToken(CRV_ADDR);
    // await harvester.connect(signer).addSwapToken(CVX_ADDR);

    expect(await harvester.swapTokens(0)).equals(CRV_ADDR);
    // expect(await harvester.swapTokens(1)).equals(CVX_ADDR);

    expect(
      await CRV.allowance(convexTradeExecutor.address, harvester.address)
    ).equals(0);
    // expect(
    //   await CVX.allowance(convexTradeExecutor.address, harvester.address)
    // ).equals(0);

    await convexTradeExecutor
      .connect(governance)
      .approveRewardTokensToHarvester([CRV_ADDR]);

    expect(
      (
        await CRV.allowance(convexTradeExecutor.address, harvester.address)
      ).toString()
    ).equals(MAX_INT);
    // expect(
    //   (
    //     await CVX.allowance(convexTradeExecutor.address, harvester.address)
    //   ).toString()
    // ).equals(MAX_INT);
  });

  it("Should get rewards correctly and harvest to USDC", async () => {
    await hre.network.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await hre.network.provider.send("evm_mine");

    const initialUSDC = await USDC.balanceOf(convexTradeExecutor.address);
    await convexTradeExecutor.connect(signer).claimRewards("0x00", {
      gasLimit: 5e6
    });

    const finalUSDC = await USDC.balanceOf(convexTradeExecutor.address);
    console.log("USDC rewards obtained:", finalUSDC.toString());

    expect(finalUSDC.gt(initialUSDC));
  });

  it("Should close position correctly", async () => {
    await hre.network.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
    await hre.network.provider.send("evm_mine");

    const initialLpBal = await LP.balanceOf(convexTradeExecutor.address);

    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[(await baseRewardPool.balanceOf(convexTradeExecutor.address)).div(2)]]
    );

    await convexTradeExecutor.connect(signer).closePosition(paramsInBytes);

    const finalLpBal = await LP.balanceOf(convexTradeExecutor.address);
    console.log("Lp after close:", finalLpBal.toString());

    expect(finalLpBal.gt(initialLpBal));
  });

  it("Should withdraw correctly", async () => {
    const totalFund = (await convexTradeExecutor.positionInWantToken())[0];
    console.log("Position in want:", totalFund.toString());

    const initialUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[totalFund]]
    );

    await convexTradeExecutor.initateWithdraw(paramsInBytes);

    const finalUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);

    console.log(
      "Final fund:",
      (await convexTradeExecutor.positionInWantToken())[0].toString()
    );

    expect(finalUsdcBal.gt(initialUsdcBal));
  });
});
