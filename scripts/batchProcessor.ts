import { ethers } from "hardhat";
import {
  Batcher,
  ConvexTradeExecutor,
  vault,
  IERC20,
  PerpTradeExecutor
} from "../src/types";
import {
  convexTradeExecutorAddress,
  vaultAddress,
  wantTokenL1,
  perpTradeExecutorAddress,
  batcherAddress
} from "./constants";

let depositers = [
  "0xfCb5A922877683128cc8B52CD7883CAb12D21229",
  "0xe92D559F99857114c610aBeF473c31bE38E4A08B",
  "0xc3d9Cad1B5233cb4261B27DFCd68BD9af8ff0191",
  "0x0CE567bd9E1C9C3141Be185219FB4DDF346C9D95",
  "0x404F4C126df0127E5bc3ECf2D566099fd29509E1",
  "0xe94B0E9fde531AD1d4EAF533feD7B3276c063637",
  "0x420498ff325F225f8d25CF86FbA19Cd046C1C73C",
  "0x8526A1962C498aA32aF5771515335CE1Be976678",
  "0x5a756d9C7cAA740E0342f755fa8Ad32e6F83726b",
  "0x1684C382352FA8992E2d12264b08CBFd8E06b7b1",
  "0xb6C86DF56D0a5C574658BF2831D8dda94E6Fee58",
  "0x059B254553BB97Ca61a99C2bBDBEfB594aa94365"
];
let withdrawers = [
  "0x7D8a7aA46C3FfdAca562fb03fA58Df4B5D16Cd99",
  "0xD3DcF92f755aEDd240AD130c0689DEe95A6Bc4eE",
  "0x69CE349De7af51c003B481fB26132fD85162ab50",
  "0xF1813be6Bad156bFc8071b246152b19497C6170d",
  "0x77D4D7ed546b19077720EDA2Be8C847A1C358125",
  "0xD270B09eCAc678943d96bA3198A733ba3E11e926",
  "0x4FA4167b3C94A80416bBc768fB919BF3AcE9F8C2",
  "0x540Cb04ebAB67E05a620B97Bb367AC5E4Ed68F09"
];

const main = async () => {
  const pmusdc = (await ethers.getContractAt("ERC20", vaultAddress)) as IERC20;
  const usdc = (await ethers.getContractAt("ERC20", wantTokenL1)) as IERC20;

  const perpTE = (await ethers.getContractAt(
    "PerpTradeExecutor",
    perpTradeExecutorAddress
  )) as PerpTradeExecutor;
  const convexTE = (await ethers.getContractAt(
    "ConvexTradeExecutor",
    convexTradeExecutorAddress
  )) as ConvexTradeExecutor;
  const vault = (await ethers.getContractAt("Vault", vaultAddress)) as vault;

  const batcher = (await ethers.getContractAt(
    "Batcher",
    batcherAddress
  )) as Batcher;

  // set PerpTradeExecutor posValue
  const lastDeposit = (await perpTE.depositStats())[0];
  await perpTE.setPosValue(lastDeposit, { gasLimit: 1000000 });

  // do the batch Deposit on batcher
  batcher.batchDeposit(
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e",
    depositers
  );

  // based on pmusdc balance withdraw funds from convex te.
  const pmusdcBalance = await pmusdc.balanceOf(
    "0x9eBBccCcBfe01047dab8Ef07fAc3e4dBaD444dAC"
  );

  const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[pmusdcBalance]]
  );
  await convexTE.initateWithdraw(paramsInBytes);

  await vault.withdrawFromExecutor(
    convexTradeExecutorAddress,
    await usdc.balanceOf(convexTradeExecutorAddress)
  );

  // do the batch withdraw on batcher.
  await batcher.batchWithdraw(
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e",
    withdrawers
  );
};

main()
  .then(() => console.log("Deposited"))
  .catch((e) => console.error(e));
