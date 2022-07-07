import hre from "hardhat";
import { Vault, PerpTradeExecutor } from "../../src/types";

const PerpTradeExecutorConfig = {
  vault: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
  wantTokenL2: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  positionHandlerL2: "0x1b6BF7Ab4163f9a7C1D4eCB36299525048083B5e",
  L1CrossDomainMessenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
  socketRegistry: "0xc30141B657f4216252dc59Af2e7CdB9D8792e1B0",
};

async function main() {
  const PerpTradeExecutor = await hre.ethers.getContractFactory(
    "PerpTradeExecutor"
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const perpTradeExecutor = (await PerpTradeExecutor.deploy(
    ...Object.values(PerpTradeExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as PerpTradeExecutor;

  await perpTradeExecutor.deployed();
  console.log("PerpTradeExecutor deployed to:", perpTradeExecutor.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: perpTradeExecutor.address,
    constructorArguments: [...Object.values(PerpTradeExecutorConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
