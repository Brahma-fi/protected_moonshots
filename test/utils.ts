import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Vault,
  ERC20,
  ConvexTradeExecutor,
  PerpTradeExecutor,
} from "../src/types";
import {
  wantTokenL1,
  wantTokenL2,
  ust3Pool,
  baseRewardPool,
  curve3PoolZap,
  governance,
  keeper,
  perpPositionHandlerL2Address,
  optimismL1CrossDomainMessenger,
  convexBooster,
} from "../scripts/constants";

export async function getUSDCContract(): Promise<ERC20> {
  const USDC = (await hre.ethers.getContractAt("ERC20", wantTokenL1)) as ERC20;
  return USDC;
}

export async function setup(): Promise<
  [string, string, SignerWithAddress, SignerWithAddress, SignerWithAddress]
> {
  let keeperAddress = keeper;
  let governanceAddress = governance;

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
  let governanceSigner = await hre.ethers.getSigner(governanceAddress);
  return [
    keeperAddress,
    governanceAddress,
    signer,
    governanceSigner,
    invalidSigner,
  ];
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

export async function getVaultContract(): Promise<Vault> {
  console.log("here1");
  let token_name: string = "BUSDC";
  let token_symbol: string = "BUSDC";
  let token_decimals: number = 6;
  let [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
  const vaultFactory = await hre.ethers.getContractFactory("Vault", signer);
  let vault = (await vaultFactory.deploy(
    token_name,
    token_symbol,
    wantTokenL1,
    keeperAddress,
    governanceAddress
  )) as Vault;
  await vault.deployed();
  console.log("Vault deployed at: ", vault.address);
  console.log("here2");
  return vault;
}

export async function getConvexExecutorContract(
  vaultAddress: string
): Promise<ConvexTradeExecutor> {
  let _harvester = "0xAE75B29ADe678372D77A8B41225654138a7E6ff1";
  const ConvexExecutor = await hre.ethers.getContractFactory(
    "ConvexTradeExecutor"
  );
  let convexTradeExecutor = (await ConvexExecutor.deploy(
    baseRewardPool,
    convexBooster,
    ust3Pool,
    curve3PoolZap,
    _harvester,
    vaultAddress
  )) as ConvexTradeExecutor;
  await convexTradeExecutor.deployed();
  return convexTradeExecutor;
}

export async function getPerpExecutorContract(
  vaultAddress: string,
  signer: SignerWithAddress
): Promise<PerpTradeExecutor> {
  const PerpTradeExecutor = await hre.ethers.getContractFactory(
    "PerpTradeExecutor",
    signer
  );

  let perpTradeExecutor = (await PerpTradeExecutor.deploy(
    vaultAddress,
    wantTokenL2,
    perpPositionHandlerL2Address,
    optimismL1CrossDomainMessenger,
    optimismL1CrossDomainMessenger
  )) as PerpTradeExecutor;
  await perpTradeExecutor.deployed();
  return perpTradeExecutor;
}

export async function mineBlocks(numberOfBlocks: number) {
  for (let i = 0; i < numberOfBlocks; i++) {
    await hre.network.provider.send("evm_mine", []);
  }
}
