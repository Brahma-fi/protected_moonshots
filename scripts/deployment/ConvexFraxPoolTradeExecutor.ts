import hre from "hardhat";
import { Vault } from "../../src/types";

const ConvexFraxPoolTradeExecutorConfig = {
  harvester: "0x2022C855CeefD7759dBbb5bB7A8F14C82688646A",
  vault: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
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

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: convexFraxPoolTradeExecutor.address,
    constructorArguments: [...Object.values(ConvexFraxPoolTradeExecutorConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
