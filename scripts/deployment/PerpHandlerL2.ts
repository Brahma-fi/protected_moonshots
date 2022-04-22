import hre from "hardhat";
import { PerpPositionHandlerL2 } from "../../src/types";
import {
  wantTokenL1,
  wantTokenL2,
  perpVault,
  clearingHouse,
  clearingHouseConfig,
  accountBalance,
  orderBook,
  exchange,
  baseToken,
  quoteTokenvUSDC,
  movrRegistry,
} from "../constants";

import { moverCall } from "../../test/api";

async function main() {
  const keeper = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";

  const PerpPositionHandlerL2 = await hre.ethers.getContractFactory(
    "PerpPositionHandlerL2"
  );
  const httpsProvider = hre.ethers.provider;
  let feeData = await httpsProvider.getFeeData();

  const output = await moverCall(
    keeper,
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D",
    hre.ethers.BigNumber.from(1e9),
    false
  );

  // console.log(output);

  const perpPositionHandlerL2 = (await PerpPositionHandlerL2.deploy(
    wantTokenL1,
    wantTokenL2,
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D", // PerpTradeExecutorL1 address
    perpVault,
    clearingHouse,
    clearingHouseConfig,
    accountBalance,
    orderBook,
    exchange,
    baseToken,
    quoteTokenvUSDC,
    keeper,
    output.registry,
    {
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"], // Recommended maxPriorityFeePerGas
      maxFeePerGas: feeData["maxFeePerGas"], // Recommended maxFeePerGas
    }
  )) as PerpPositionHandlerL2;

  await perpPositionHandlerL2.deployed();
  console.log(
    "PerpPositionHandlerL2 deployed to:",
    perpPositionHandlerL2.address
  );

  /// Dont Verify Perp Handler before audit
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
