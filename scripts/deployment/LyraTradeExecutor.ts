import Lyra from "@lyrafinance/lyra-js";
import hre from "hardhat";
import { LyraTradeExecutor } from "../../src/types";

const LyraTradeExecutorConfig = {
  vault: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
  wantTokenL2: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  positionHandlerL2: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
  L1CrossDomainMessenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
  socketRegistry: "0xc30141B657f4216252dc59Af2e7CdB9D8792e1B0",
};

async function main() {
  const LyraTradeExecutor = await hre.ethers.getContractFactory(
    "LyraTradeExecutor"
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const lyraTradeExecutor = (await LyraTradeExecutor.deploy(
    ...Object.values(LyraTradeExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as LyraTradeExecutor;

  await lyraTradeExecutor.deployed();
  console.log("LyraTradeExecutor deployed to:", lyraTradeExecutor.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: lyraTradeExecutor.address,
    constructorArguments: [...Object.values(LyraTradeExecutorConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
