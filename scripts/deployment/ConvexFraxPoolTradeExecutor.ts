import hre from "hardhat";
import { Vault } from "../../src/types";

const ConvexFraxPoolTradeExecutorConfig = {
  harvester: "0xF1D339D9456BC1e09b548E7946A78D9C4b5f1B68",
  vault: "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e",
};

async function main() {
  const ConvexFraxPoolTradeExecutor = await hre.ethers.getContractFactory(
    "ConvexFraxPoolTradeExecutor"
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const convexFraxPoolTradeExecutor = (await ConvexFraxPoolTradeExecutor.deploy(
    ...Object.values(ConvexFraxPoolTradeExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as Vault;

  await convexFraxPoolTradeExecutor.deployed();
  console.log(
    "ConvexFraxPoolTradeExecutor deployed to:",
    convexFraxPoolTradeExecutor.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
