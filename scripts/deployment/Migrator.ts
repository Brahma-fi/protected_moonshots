import hre from "hardhat";

import { Migratooor } from "../../src/types";

async function main() {
  const batcherAddress = "0xa67feFA6657e9aa3e4ee6EF28531641dAFBB8cAf";

  const Migrator = await hre.ethers.getContractFactory("Migratooor");
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const migrator = (await Migrator.deploy(batcherAddress, {
    maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
    maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
  })) as Migratooor;

  await migrator.deployed();
  console.log("Migrator deployed to:", migrator.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: migrator.address,
    constructorArguments: [batcherAddress],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
