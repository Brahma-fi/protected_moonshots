import hre from "hardhat";
import { LyraPositionHandlerL2 } from "../../src/types";
import {
  lyraETHOptionMarketAddress,
  lyraTradeExecutorAddress,
  movrRegistry,
  wantTokenL2,
} from "../constants";

const LyraHandlerL2ExecutorConfig = {
  wantTokenL2: wantTokenL2,
  positionHandlerL1: lyraTradeExecutorAddress,
  lyraOptionMarket: lyraETHOptionMarketAddress,
  keeper: "0xAE75B29ADe678372D77A8B41225654138a7E6ff1",
  governance: "0x6b29610d6c6a9e47812be40f1335918bd63321bf",
  socketRegistry: movrRegistry,
  slippage: 100,
};

async function main() {
  const LyraHandlerL2 = await hre.ethers.getContractFactory(
    "LyraPositionHandlerL2",
    {
      libraries: {
        "@lyrafinance/protocol/contracts/libraries/BlackScholes.sol:BlackScholes":
          "0xE97831964bF41C564EDF6629f818Ed36C85fD520",
      },
    }
  );
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const lyraHandlerL2 = (await LyraHandlerL2.deploy(
    ...Object.values(LyraHandlerL2ExecutorConfig),
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as LyraPositionHandlerL2;

  await lyraHandlerL2.deployed();
  console.log("LyraL2PositionManager deployed to:", lyraHandlerL2.address);

  await new Promise((r) => setTimeout(r, 75000));

  await hre.run("verify:verify", {
    address: lyraHandlerL2.address,
    constructorArguments: [...Object.values(LyraHandlerL2ExecutorConfig)],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
