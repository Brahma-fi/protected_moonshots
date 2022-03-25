import { ethers } from "hardhat";
import {
  Batcher,
  ConvexTradeExecutor,
  Hauler,
  IERC20,
  PerpTradeExecutor
} from "../src/types";
import {
  convexTradeExecutorAddress,
  haulerAddress,
  wantTokenL1
} from "./constants";

const main = async () => {
  const pmusdc = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e"
  )) as IERC20;
  const usdc = (await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    wantTokenL1
  )) as IERC20;

  const perpTE = (await ethers.getContractAt(
    "PerpTradeExecutor",
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D"
  )) as PerpTradeExecutor;
  const convexTE = (await ethers.getContractAt(
    "ConvexTradeExecutor",
    "0x3167b932336b029bBFE1964E435889FA8e595738"
  )) as ConvexTradeExecutor;
  const hauler = (await ethers.getContractAt(
    "Hauler",
    haulerAddress
  )) as Hauler;

  const batcher = (await ethers.getContractAt(
    "Batcher",
    "0x9eBBccCcBfe01047dab8Ef07fAc3e4dBaD444dAC"
  )) as Batcher;

  // set PerpTradeExecutor posValue
  const totalDeposit = (await perpTE.depositStats())[1];
  await perpTE.setPosValue(totalDeposit);

  // do the batch Deposit on batcher
  batcher.batchDeposit("0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e", []);

  // based on pmusdc balance withdraw funds from convex te.
  const pmusdcBalance = await pmusdc.balanceOf(
    "0x9eBBccCcBfe01047dab8Ef07fAc3e4dBaD444dAC"
  );
  const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[pmusdcBalance.div(1e12)]]
  );
  await convexTE.initateWithdraw(paramsInBytes);

  await hauler.withdrawFromExecutor(
    convexTradeExecutorAddress,
    await usdc.balanceOf(convexTradeExecutorAddress)
  );

  // do the batch withdraw on batcher.
  await batcher.batchWithdraw("0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e", []);
};

main()
  .then(() => console.log("Deposited"))
  .catch((e) => console.error(e));
