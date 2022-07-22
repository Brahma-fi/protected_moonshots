import hre from "hardhat";
import { PerpTradeExecutor, ERC20 } from "../src/types";
import { moverCall } from "../test/api";

async function main() {
  const perpTradeExecutor = (await hre.ethers.getContractAt(
    "PerpTradeExecutor",
    "0xC31587a61179FFe6D0D87130B2E704927c7A48e2"
  )) as PerpTradeExecutor;

  const usdc = (await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )) as ERC20;

  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();
  let usd_balance = await usdc.balanceOf(perpTradeExecutor.address);
  const output = await moverCall(
    perpTradeExecutor.address,
    "0x1b6BF7Ab4163f9a7C1D4eCB36299525048083B5e",
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
