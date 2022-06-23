import hre from "hardhat";
import { Vault } from "../../src/types";

const HarvesterConfig = {
  vault: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
};

async function main() {
  const Harvester = await hre.ethers.getContractFactory("Harvester");
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const harvester = (await Harvester.deploy(...Object.values(HarvesterConfig), {
    maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
    maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
  })) as Vault;

  await harvester.deployed();
  console.log("Harvester deployed to:", harvester.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: harvester.address,
    constructorArguments: [...Object.values(HarvesterConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
