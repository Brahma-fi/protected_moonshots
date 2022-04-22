import hre from "hardhat";
import { Batcher } from "../../src/types";

async function main() {
  const verificationAuthority = "0x687f4304Df62449dBc6C95FE9A8cb1153d40D42e";
  const governanceAddress = "0x6b29610D6c6a9E47812bE40F1335918bd63321bf";
  const Batcher = await hre.ethers.getContractFactory("Batcher");
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const batcher = (await Batcher.deploy(
    verificationAuthority,
    governanceAddress,
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as Batcher;

  await batcher.deployed();
  console.log("Batcher deployed to:", batcher.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: batcher.address,
    constructorArguments: [verificationAuthority, governanceAddress],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
