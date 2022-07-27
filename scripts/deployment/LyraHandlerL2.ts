import { getGlobalDeploys } from "@lyrafinance/protocol";
import { LyraRegistry } from "@lyrafinance/protocol/dist/typechain-types";
import { BigNumber } from "ethers";
import hre from "hardhat";
import {
  BlackScholes,
  BlackScholes__factory,
  LyraPositionHandlerL2,
} from "../../src/types";
import {
  lyraETHOptionMarketAddress,
  lyraTradeExecutorAddress,
  movrRegistry,
  wantTokenL2,
} from "../constants";

const LyraHandlerL2ExecutorConfig = {
  wantTokenL2: "0xf5C8a8D853BA1d0C45379f353fd361c0d438Dcb1",
  positionHandlerL1: lyraTradeExecutorAddress,
  lyraOptionMarket: "0xDc06D81A68948544A6B453Df55CcD172061c6d6e",
  keeper: "0xAE75B29ADe678372D77A8B41225654138a7E6ff1",
  governance: "0xAE75B29ADe678372D77A8B41225654138a7E6ff1",
  socketRegistry: movrRegistry,
  slippage: 100,
};

async function main() {
  const httpsProvider = await hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  console.log("fee data", feeData);

  // const BlackScholesFactory = (await hre.ethers.getContractFactory(
  //   "@lyrafinance/protocol/contracts/libraries/BlackScholes.sol:BlackScholes"
  // )) as BlackScholes__factory;
  // const blackScholes = (await BlackScholesFactory.deploy()) as BlackScholes;

  // console.log("bs", blackScholes.address);

  const LyraHandlerL2 = await hre.ethers.getContractFactory(
    "LyraPositionHandlerL2",
    {
      libraries: {
        "@lyrafinance/protocol/contracts/libraries/BlackScholes.sol:BlackScholes":
          "0xD5c3Ca205D115441F93252Bfe07A956f8aF2c452",
      },
    }
  );

  const lyraHandlerL2 = (await LyraHandlerL2.deploy(
    ...Object.values(LyraHandlerL2ExecutorConfig),
    {
      gasLimit: BigNumber.from(10e6),
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
