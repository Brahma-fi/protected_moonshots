/* eslint-disable node/no-missing-import */
import * as dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { wantTokenL1 } from "../../scripts/constants";
import {
  Harvester,
  Vault,
  IConvexRewards,
  IERC20,
  ConvexTradeExecutor,
} from "../../src/types";
import {
  getERC20ContractAt,
  getPreloadedSigners,
  mineBlocks,
  randomSigner,
  switchToNetwork,
} from "../utils";

const ConvexTradeExecutorConfig = {
  baseRewardPool: "0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e",
  convexBooster: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  fraxPool: "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B",
  curve3PoolZap: "0xA79828DF1850E8a3A3064576f380D90aECDD3359",
};

const MAX_INT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const CRV_ADDR = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const CVX_ADDR = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
const _3CRV_ADDR = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const CRVETH = "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511";
const CVXETH = "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4";
const _3CRVPOOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

let convexTradeExecutor: ConvexTradeExecutor;
let harvester: Harvester;
let vault: Vault;
let baseRewardPool: IConvexRewards;

let USDC: IERC20;
let LP: IERC20;
let CRV: IERC20;
let CVX: IERC20;
let _3CRV: IERC20;

let governance: SignerWithAddress,
  signer: SignerWithAddress,
  invalidSigner: SignerWithAddress,
  keeper: SignerWithAddress;

const deploy = async () => {
  const convexTradeExecutorFactory = await ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  const HarvesterFactory = await ethers.getContractFactory("Harvester");
  const vaultFactory = await ethers.getContractFactory("Vault", signer);
  LP = (await ethers.getContractAt(
    "ERC20",
    ConvexTradeExecutorConfig.fraxPool
  )) as IERC20;
  CRV = (await ethers.getContractAt("ERC20", CRV_ADDR)) as IERC20;
  CVX = (await ethers.getContractAt("ERC20", CVX_ADDR)) as IERC20;
  _3CRV = (await ethers.getContractAt("ERC20", _3CRV_ADDR)) as IERC20;

  baseRewardPool = (await ethers.getContractAt(
    "IConvexRewards",
    ConvexTradeExecutorConfig.baseRewardPool
  )) as IConvexRewards;

  USDC = await getERC20ContractAt(wantTokenL1);

  [signer, keeper, governance, invalidSigner] = await getPreloadedSigners();

  vault = (await vaultFactory
    .connect(keeper)
    .deploy(
      "PMUSDC",
      "PMUSDC",
      wantTokenL1,
      keeper.address,
      governance.address
    )) as Vault;

  const HarvesterConfig = {
    vaultAddress: vault.address,
  };
  harvester = (await HarvesterFactory.connect(keeper).deploy(
    ...Object.values(HarvesterConfig)
  )) as Harvester;

  convexTradeExecutor = (await convexTradeExecutorFactory
    .connect(keeper)
    .deploy(harvester.address, vault.address)) as ConvexTradeExecutor;
  // set slippage as 0.1%
  await convexTradeExecutor.connect(governance).setSlippage(BigNumber.from(10));
};

describe("Convex Trade Executor Frax [MAINNET]", function () {
  before(async () => {
    dotenv.config();
    await switchToNetwork(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      Number(process.env.BLOCK_NUMBER)
    );
    await deploy();
  });

  it("Should deploy Harvester correctly", async () => {
    expect(await harvester.vault()).equals(vault.address);
  });

  it("Should deploy ConvexTradeExecutor correctly", async () => {
    expect(await convexTradeExecutor.harvester()).equals(harvester.address);
    expect(await convexTradeExecutor.governance()).equals(governance.address);

    expect(await convexTradeExecutor.wantToken()).equals(wantTokenL1);
    expect(await convexTradeExecutor.lpToken()).equals(
      ConvexTradeExecutorConfig.fraxPool
    );

    expect(await convexTradeExecutor.baseRewardPool()).equals(
      ConvexTradeExecutorConfig.baseRewardPool
    );
    expect(await convexTradeExecutor.fraxPool()).equals(
      ConvexTradeExecutorConfig.fraxPool
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
    const usdcBal = BigNumber.from(1e12);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[usdcBal]]
    );

    expect(await USDC.balanceOf(convexTradeExecutor.address)).equals(0);
    expect(await LP.balanceOf(convexTradeExecutor.address)).equals(0);

    await USDC.connect(signer).transfer(convexTradeExecutor.address, usdcBal);
    expect(await USDC.balanceOf(convexTradeExecutor.address)).equals(usdcBal);

    await convexTradeExecutor.connect(signer).initiateDeposit(paramsInBytes, {
      gasLimit: 5e6,
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
      gasLimit: 5e6,
    });
    const convexStakedBal = await baseRewardPool.balanceOf(
      convexTradeExecutor.address
    );
    console.log("Convex staked bal:", convexStakedBal.toString());

    expect(convexStakedBal).equals(convexLpBal);
  });

  it("Should setup harvester correctly and initialize on handler", async () => {
    expect((await CRV.allowance(harvester.address, CRVETH)).toString()).equals(
      MAX_INT
    );
    expect((await CVX.allowance(harvester.address, CVXETH)).toString()).equals(
      MAX_INT
    );
    expect(
      (await _3CRV.allowance(harvester.address, _3CRVPOOL)).toString()
    ).equals(MAX_INT);
  });

  it("Should get rewards correctly and harvest to USDC", async () => {
    let beforeReward = await baseRewardPool.earned(convexTradeExecutor.address);
    await mineBlocks(1);
    let afterReard = await baseRewardPool.earned(convexTradeExecutor.address);
    console.log("Before reward:", beforeReward.toString());
    console.log("After reward:", afterReard.toString());
    const initialUSDC = await USDC.balanceOf(convexTradeExecutor.address);
    await convexTradeExecutor.connect(signer).claimRewards("0x00", {
      gasLimit: 5e6,
    });

    const finalUSDC = await USDC.balanceOf(convexTradeExecutor.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[finalUSDC]]
    );

    await convexTradeExecutor.connect(signer).initiateDeposit(paramsInBytes, {
      gasLimit: 5e6,
    });
    console.log("USDC rewards obtained:", finalUSDC.toString());

    expect(finalUSDC.gt(initialUSDC));
  });

  it("Should close position correctly", async () => {
    const initialLpBal = await LP.balanceOf(convexTradeExecutor.address);

    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[(await baseRewardPool.balanceOf(convexTradeExecutor.address)).div(2)]]
    );

    await convexTradeExecutor.connect(signer).closePosition(paramsInBytes);

    const finalLpBal = await LP.balanceOf(convexTradeExecutor.address);
    console.log("Lp after close:", finalLpBal.toString());

    expect(finalLpBal.gt(initialLpBal));
    const completeCloseParamsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[BigNumber.from(0)]]
    );
    // test closing all amount
    await convexTradeExecutor
      .connect(signer)
      .closePosition(completeCloseParamsInBytes);

    expect(finalLpBal.gt(initialLpBal));

    // invest back some funds
    await convexTradeExecutor.connect(signer).openPosition(paramsInBytes, {
      gasLimit: 5e6,
    });
  });

  it("Should withdraw correctly", async () => {
    const totalFund = (await convexTradeExecutor.positionInWantToken())[0];
    console.log("Position in want:", totalFund.toString());

    const initialUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);
    const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[totalFund.div(2)]]
    );

    await convexTradeExecutor.connect(signer).initateWithdraw(paramsInBytes);

    const finalUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);

    console.log(
      "Final fund:",
      (await convexTradeExecutor.positionInWantToken())[0].toString()
    );

    expect(finalUsdcBal.gt(initialUsdcBal));
    let completeParamsInBytes = ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256)"],
      [[MAX_INT]]
    );

    await convexTradeExecutor
      .connect(signer)
      .initateWithdraw(completeParamsInBytes);
  });
});
