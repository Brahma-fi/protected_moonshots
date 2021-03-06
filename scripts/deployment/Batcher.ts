import hre from "hardhat";
import { BigNumber } from "ethers";
import { Batcher } from "../../src/types";

async function main() {
  const verificationAuthority = "0x687f4304Df62449dBc6C95FE9A8cb1153d40D42e";
  const vaultAddress = "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08";

  const maxDepositLimit = BigNumber.from(2005000).mul(1e6);
  const Batcher = await hre.ethers.getContractFactory("Batcher");
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const batcher = (await Batcher.deploy(
    verificationAuthority,
    vaultAddress,
    maxDepositLimit, // In want token with apt decimals
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
    constructorArguments: [
      verificationAuthority,
      vaultAddress,
      maxDepositLimit,
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
