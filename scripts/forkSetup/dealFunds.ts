import hre, { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import {
  Batcher,
  IBatcherOld,
  Vault,
  IVaultOld,
  IOldConvexTE,
  Migratooor,
  IERC20,
  PerpTradeExecutor,
} from "../../src/types";

import { getSigner } from "../../test/utils/signers";

async function main() {
  const usdc = (await ethers.getContractAt(
    "contracts/PerpL2/interfaces/IERC20.sol:IERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )) as IERC20;

  const pmusdc = (await ethers.getContractAt(
    "contracts/PerpL2/interfaces/IERC20.sol:IERC20",
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e"
  )) as IERC20;

  let addressesToTest = [
    // "0x830BD1aa9F39c280E2bd0CE6Ae81b57159A73100",
    // "0xc0a227a440aA6432aFeC59423Fd68BD00cAbB529",
    // "0x45af3Bd5A2c60B7410f33C313c247c439b633446",
    // "0xEE4E1E86cA32B090fe772Cb779DB5Fda0cC6d478",
    // "0xa5fdbf8c7ba6fcc546d4e20715efc346fbcec9f7",
    // "0xE9F47d5EE5b73326e1EB9361630105e8Ca386874",
    // "0x1fb013BDf89c9E61B3c16A81B9D384f7D8493dBF",
    "0xFDD644749a1e16EA383A3d4268E4FA960D0E1F40",
  ];

  let usdcwhaleaddress = "0xae2d4617c862309a3d75a0ffb358c7a5009c673f";

  let whaleSigner = await getSigner(usdcwhaleaddress);

  let PMUSDCHolder = "0x6a04941de896e4215eeb8e6eb1b72ad2904d2402";

  let pmusdcwhaleSigner = await getSigner(PMUSDCHolder);

  for (let address of addressesToTest) {
    console.log("getting funds for", address);
    await getSigner(address);
    await pmusdc
      .connect(pmusdcwhaleSigner)
      .transfer(address, BigNumber.from("1000000000"));

    await usdc
      .connect(whaleSigner)
      .transfer(address, BigNumber.from("1000000000000"));
  }
}

export const waitFor = (ms: number) => new Promise((r) => setTimeout(r, ms));

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
