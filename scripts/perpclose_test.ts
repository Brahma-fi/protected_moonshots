import { BigNumber } from "ethers";
import hre from "hardhat";
import { PerpPositionHandlerL2, ERC20 } from "../src/types";
import { perpPositionHandlerL2Address, wantTokenL2 } from "./constants";

async function main() {
    let keeperAddress = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1"; 
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [keeperAddress]
      });
      let signer = await hre.ethers.getSigner(keeperAddress);

    const perpHandler = await hre.ethers.getContractAt(
        "PerpPositionHandlerL2",
        perpPositionHandlerL2Address
    ) as PerpPositionHandlerL2;

    const usdc_contract = await hre.ethers.getContractAt(
        "ERC20",
        wantTokenL2
    ) as ERC20;
    const beforeBalance = await usdc_contract.balanceOf(perpHandler.address);
    console.log("beforeBalance", beforeBalance.mul(1e12).toString());
    await perpHandler.connect(signer).openPosition(true, beforeBalance.mul(8).mul(1e12), BigNumber.from(1000));
    console.log("usdc balance after", await usdc_contract.balanceOf(perpHandler.address));
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  