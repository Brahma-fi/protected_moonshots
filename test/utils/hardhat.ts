import { BigNumber, BigNumberish } from "ethers";
import hre, { network } from "hardhat";

export async function mineBlocks(numberOfBlocks: BigNumberish) {
  numberOfBlocks = BigNumber.from(numberOfBlocks);
  for (let i = 0; numberOfBlocks.gt(i); i++) {
    await hre.network.provider.send("evm_mine", []);
  }
}

export async function switchToNetwork(
  jsonRpcUrl: string,
  blockNumber?: number
) {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl,
          blockNumber,
        },
      },
    ],
  });
}
