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

  let userWallet = "0xEE4E1E86cA32B090fe772Cb779DB5Fda0cC6d478";

  let signer = await getSigner(userWallet);

  await usdc
    .connect(signer)
    .approve("0xa67feFA6657e9aa3e4ee6EF28531641dAFBB8cAf", 0);
}

export const waitFor = (ms: number) => new Promise((r) => setTimeout(r, ms));

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
