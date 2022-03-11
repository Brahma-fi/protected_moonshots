import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Bytes } from "ethers";

export async function setup() :Promise<[string, string, SignerWithAddress, SignerWithAddress]> {
    let keeperAddress = "0x55FE002aefF02F77364de339a1292923A15844B8";
    let governanceAddress = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [keeperAddress],
    });
    let signer = await hre.ethers.getSigner(keeperAddress);
    let invalidSigner = (await hre.ethers.getSigners())[0];
    return [keeperAddress, governanceAddress, signer, invalidSigner];
}


export async function getSignature(addressToAuthorize: string, signer: SignerWithAddress, verifyingContract: string) :Promise<string> {
  const domain = {
    name: "Batcher",
    version: "1",
    chainId: 1,
    verifyingContract: verifyingContract,
  };

  // The named list of all type definitions
  const types = {
    deposit: [{name: "owner", type: "address"}],
  };

  // The data to sign
  const value = {
    owner: addressToAuthorize,
  };
  // console.log('signer:', signer.address);
  let signature = await signer._signTypedData(domain, types, value);
  // console.log("eip712 signature", signature);
  return  hre.ethers.utils.hexlify(signature);
}