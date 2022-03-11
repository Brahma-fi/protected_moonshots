import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export async function setup() :Promise<[string, string, SignerWithAddress, SignerWithAddress]> {
    let keeperAddress = "0x1B7BAa734C00298b9429b518D621753Bb0f6efF2";
    let governanceAddress = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [keeperAddress],
    });
    let signer = await hre.ethers.getSigner(keeperAddress);
    let invalidSigner = (await hre.ethers.getSigners())[0];
    return [keeperAddress, governanceAddress, signer, invalidSigner];
}