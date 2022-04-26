import hre from "hardhat";
import { Vault } from "../../src/types";

const HarvesterConfig = {
  keeper: "0xAE75B29ADe678372D77A8B41225654138a7E6ff1",
  wantToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  governance: "0x6b29610D6c6a9E47812bE40F1335918bd63321bf",
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

  //   await new Promise((r) => setTimeout(r, 75000));

  //   await hre.run("verify:verify", {
  //     address: harvester.address,
  //     constructorArguments: [...Object.values(HarvesterConfig)]
  //   });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
