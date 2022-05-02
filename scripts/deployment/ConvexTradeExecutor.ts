import hre from "hardhat";
import { Vault } from "../../src/types";

const ConvexTradeExecutorConfig = {
  harvester: "0xF1D339D9456BC1e09b548E7946A78D9C4b5f1B68",
  vault: "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e",
};

async function main() {
  const ConvexTradeExecutor = await hre.ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const convexTradeExecutor = (await ConvexTradeExecutor.deploy(
    ...Object.values(ConvexTradeExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as Vault;

  await convexTradeExecutor.deployed();
  console.log("ConvexTradeExecutor deployed to:", convexTradeExecutor.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
