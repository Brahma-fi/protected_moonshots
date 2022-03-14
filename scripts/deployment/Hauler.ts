import hre from "hardhat";
import { Hauler } from "../../src/types";


async function main(){

    const name = "Protected Moonshots USDC";
    const symbol = "⚛PMUSDC";
    const tokenDecimals = 6;
    const wantToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const keeper = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
    const governance = "0x6b29610D6c6a9E47812bE40F1335918bd63321bf";
    const Hauler = await hre.ethers.getContractFactory("Hauler");
    const httpsProvider = await hre.ethers.provider;
    let feeData = await httpsProvider.getFeeData();

    const hauler = await Hauler.deploy(name, symbol, tokenDecimals, wantToken, keeper, governance, {
        maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
        maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
        }) as Hauler;



    await hauler.deployed();
    console.log("Hauler deployed to:", hauler.address);
    
    await new Promise(r => setTimeout(r, 75000));


    await hre.run("verify:verify", {
        address: hauler.address,
        constructorArguments: [
            name, 
            symbol,
            tokenDecimals,
            wantToken,
            keeper,
            governance
        ],
      });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  