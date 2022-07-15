import { readFileSync } from "fs";
import { ethers } from "hardhat";

export async function getTenderlyProvider(): Promise<JsonRpcProvider> {
  const tenderlyConfig = JSON.parse(
    readFileSync("./tenderlyConfig.json").toString()
  );
  console.log("tenderlyConfig.forkUrl", tenderlyConfig);
  const network = {
    name: "tenderly",
    chainId: 10,
  };
  return new ethers.providers.JsonRpcProvider(tenderlyConfig.forkURL, network);
}
