/* eslint-disable node/no-missing-import */
import * as dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { wantTokenL1 } from "../../scripts/constants";
import {
  Harvester,
  Vault,
  IConvexRewards,
  IERC20,
  FraxConvexFraxPoolTradeExecutor,
  IConvexStaking,
} from "../../src/types";
import {
  getERC20ContractAt,
  getPreloadedSigners,
  mineBlocks,
  switchToNetwork,
} from "../utils";

const ConvexTradeExecutorConfig = {
  fraxPool: "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2",
  lpToken: "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC",
};

const MAX_INT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const CRV_ADDR = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const CVX_ADDR = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
const _3CRV_ADDR = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const CRVETH = "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511";
const CVXETH = "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4";
const _3CRVPOOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

let convexTradeExecutor: FraxConvexFraxPoolTradeExecutor;
let harvester: Harvester;
let vault: Vault;

let USDC: IERC20;
let LP: IERC20;
let CRV: IERC20;
let CVX: IERC20;
let _3CRV: IERC20;

let governance: SignerWithAddress,
  signer: SignerWithAddress,
  keeper: SignerWithAddress,
  convexStaking: IConvexStaking;

const deploy = async () => {
  const convexTradeExecutorFactory = await ethers.getContractFactory(
    "FraxConvexFraxPoolTradeExecutor"
  );
  const HarvesterFactory = await ethers.getContractFactory("Harvester");
  const vaultFactory = await ethers.getContractFactory("Vault", signer);
  LP = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    ConvexTradeExecutorConfig.lpToken
  )) as IERC20;
  CRV = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    CRV_ADDR
  )) as IERC20;
  CVX = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    CVX_ADDR
  )) as IERC20;
  _3CRV = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    _3CRV_ADDR
  )) as IERC20;

  USDC = await getERC20ContractAt(wantTokenL1);

  [signer, keeper, governance] = await getPreloadedSigners();

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
    .deploy(
      harvester.address,
      vault.address
    )) as FraxConvexFraxPoolTradeExecutor;
  // set slippage as 0.1%
  await convexTradeExecutor.connect(governance).setSlippage(BigNumber.from(10));

  convexStaking = (await ethers.getContractAt(
    "IConvexStaking",
    await convexTradeExecutor.convexStaking()
  )) as IConvexStaking;
};

describe("Convex FRAX-USDC Trade Executor [MAINNET]", function () {
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
      ConvexTradeExecutorConfig.lpToken
    );
    expect(await convexTradeExecutor.fraxPool()).equals(
      ConvexTradeExecutorConfig.fraxPool
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

    expect(
      await convexStaking.lockedLiquidityOf(
        await convexTradeExecutor.convexVault()
      )
    ).equals(0);

    await convexTradeExecutor.connect(signer).openPosition(paramsInBytes, {
      gasLimit: 5e6,
    });
    const convexStakedBal = await convexStaking.lockedLiquidityOf(
      await convexTradeExecutor.convexVault()
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
    let beforeReward = await convexStaking.earned(
      await convexTradeExecutor.convexVault()
    );
    await mineBlocks(2500);
    let afterReward = await convexStaking.earned(
      await convexTradeExecutor.convexVault()
    );
    console.log("Before reward:", beforeReward.toString());
    console.log("After reward:", afterReward.toString());
    const initialUSDC = await USDC.balanceOf(convexTradeExecutor.address);
    await harvester.connect(signer).setSlippage(1000);
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
    await network.provider.send("evm_increaseTime", [605000]);
    await network.provider.send("evm_mine");

    const initialLpBal = await LP.balanceOf(convexTradeExecutor.address);
    await convexTradeExecutor.connect(signer).closePosition("0x00");

    const finalLpBal = await LP.balanceOf(convexTradeExecutor.address);
    console.log("Lp after close:", finalLpBal.toString());

    expect(finalLpBal.gt(initialLpBal));
  });

  it("Should withdraw correctly", async () => {
    const totalFund = (await convexTradeExecutor.positionInWantToken())[0];
    console.log("Position in want:", totalFund.toString());

    const initialUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);
    await convexTradeExecutor.connect(signer).initiateWithdraw("0x00");

    const finalUsdcBal = await USDC.balanceOf(convexTradeExecutor.address);

    console.log(
      "Final fund:",
      (await convexTradeExecutor.positionInWantToken())[0].toString()
    );

    expect(finalUsdcBal.gt(initialUsdcBal));
  });
});
