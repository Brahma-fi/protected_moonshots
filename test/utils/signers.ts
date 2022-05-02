import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Wallet } from "ethers";

export async function getSigner(
  address: string,
  balance?: BigNumber
): Promise<SignerWithAddress> {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });

  const signer = await hre.ethers.getSigner(address);

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [
      address,
      balance ? balance.toHexString() : "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ],
  });

  return signer;
}

export async function randomSigner(
  balance?: BigNumber
): Promise<SignerWithAddress> {
  const privKey = hre.ethers.utils.randomBytes(32);
  const walletAddress = new hre.ethers.Wallet(privKey).address;

  const signer = getSigner(walletAddress, balance);

  return signer;
}

export async function randomWallet(): Promise<Wallet> {
  const privKey = hre.ethers.utils.randomBytes(32);
  const wallet = new hre.ethers.Wallet(privKey);

  return wallet;
}

export async function getSignature(
  addressToAuthorize: string,
  signer: Wallet | SignerWithAddress,
  verifyingContract: string
): Promise<string> {
  const domain = {
    name: "Batcher",
    version: "1",
    chainId: 1,
    verifyingContract: verifyingContract,
  };
  // The named list of all type definitions
  const types = {
    deposit: [{ name: "owner", type: "address" }],
  };

  // The data to sign
  const value = {
    owner: addressToAuthorize,
  };
  // console.log('signer:', signer.address);
  const signature = await signer._signTypedData(domain, types, value);
  // console.log("eip712 signature", signature);
  return hre.ethers.utils.hexlify(signature);
}
