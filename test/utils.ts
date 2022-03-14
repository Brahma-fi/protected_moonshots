import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MetaRouter,
  ERC20,
  ConvexTradeExecutor,
  PerpTradeExecutor,
} from "../src/types";
import {
  wantTokenL1,
  ust3Pool,
  baseRewardPool,
  curve3PoolZap,
} from "../scripts/constants";
import { Signer } from "ethers";
import { sign } from "crypto";

export async function getUSDCContract(): Promise<ERC20> {
  const USDC = (await hre.ethers.getContractAt(
    "ERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )) as ERC20;
  return USDC;
}

export async function setup(): Promise<
  [string, string, SignerWithAddress, SignerWithAddress]
> {
  let keeperAddress = "0x55FE002aefF02F77364de339a1292923A15844B8";
  let governanceAddress = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [keeperAddress],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governanceAddress],
  });
  let signer = await hre.ethers.getSigner(keeperAddress);
  let invalidSigner = (await hre.ethers.getSigners())[0];
  return [keeperAddress, governanceAddress, signer, invalidSigner];
}

export async function getSignature(
  addressToAuthorize: string,
  signer: SignerWithAddress,
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
  let signature = await signer._signTypedData(domain, types, value);
  // console.log("eip712 signature", signature);
  return hre.ethers.utils.hexlify(signature);
}

export async function getMetaRouterContract(): Promise<MetaRouter> {
  let token_name: string = "BUSDC";
  let token_symbol: string = "BUSDC";
  let token_decimals: number = 6;
  let [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
  const MetaRouter = await hre.ethers.getContractFactory("MetaRouter", signer);
  let metaRouter = (await MetaRouter.deploy(
    token_name,
    token_symbol,
    token_decimals,
    wantTokenL1,
    keeperAddress,
    governanceAddress
  )) as MetaRouter;
  await metaRouter.deployed();
  console.log("MetaRouter deployed at: ", metaRouter.address);
  return metaRouter;
}

export async function getConvexExecutorContract(
  metaRouterAddress: string
): Promise<ConvexTradeExecutor> {
  let _harvester = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
  const ConvexExecutor = await hre.ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  let convexTradeExecutor = (await ConvexExecutor.deploy(
    baseRewardPool,
    ust3Pool,
    curve3PoolZap,
    _harvester,
    metaRouterAddress
  )) as ConvexTradeExecutor;
  await convexTradeExecutor.deployed();
  return convexTradeExecutor;
}

export async function getPerpExecutorContract(
  metaRouterAddress: string,
  signer: SignerWithAddress
): Promise<PerpTradeExecutor> {
  const PerpTradeExecutor = await hre.ethers.getContractFactory(
    "PerpTradeExecutor",
    signer
  );
  let perpTradeExecutor = (await PerpTradeExecutor.deploy(
    metaRouterAddress
  )) as PerpTradeExecutor;
  await perpTradeExecutor.deployed();
  return perpTradeExecutor;
}

export async function mineBlocks(numberOfBlocks: number) {
  for (let i = 0; i < numberOfBlocks; i++) {
    await hre.network.provider.send("evm_mine", []);
  }
}