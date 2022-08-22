import hre from "hardhat";
import { Vault } from "../../src/types";

const ConvexSUSDPoolTradeExecutorConfig = {
  harvester: "0x079d4c4179f0018EE5587f416560A94261a9F72F",
  vault: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
};

async function main() {
  const ConvexSUSDPoolTradeExecutor = await hre.ethers.getContractFactory(
    "ConvexSUSDPoolTradeExecutor"
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const convexSUSDPoolTradeExecutor = (await ConvexSUSDPoolTradeExecutor.deploy(
    ...Object.values(ConvexSUSDPoolTradeExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as Vault;

  await convexSUSDPoolTradeExecutor.deployed();
  console.log(
    "ConvexSUSDPoolTradeExecutor deployed to:",
    convexSUSDPoolTradeExecutor.address
  );

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: convexSUSDPoolTradeExecutor.address,
    constructorArguments: [...Object.values(ConvexSUSDPoolTradeExecutorConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
