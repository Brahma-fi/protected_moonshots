import hre from "hardhat";
import { PerpTradeExecutor, ERC20 } from "../src/types";
import { moverCall } from "../test/api";

async function main() {
  const perpTradeExecutor = (await hre.ethers.getContractAt(
    "PerpTradeExecutor",
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D"
  )) as PerpTradeExecutor;

  const usdc = (await hre.ethers.getContractAt(
    "ERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )) as ERC20;

  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();
  let usd_balance = await usdc.balanceOf(perpTradeExecutor.address);
  const output = await moverCall(
    perpTradeExecutor.address,
    "0x00fFC95A1A63dbd48A1E7397a3B051eA9E3F5Be9",
    usd_balance,
    true
  );

  const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256,address,address,bytes)"],
    [[usd_balance, output.target, output.registry, output.data]]
  );
  console.log(paramsInBytes);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
