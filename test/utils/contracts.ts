/* eslint-disable node/no-missing-import */
import hre from "hardhat";
import {
  WantERC20,
  Vault,
  Batcher,
  MockTradeExecutor,
  MockAsyncTradeExecutor,
  ERC20,
  ConvexTradeExecutor,
  Harvester,
  IConvexRewards,
} from "../../src/types";
import { BigNumber } from "ethers";
import { wantTokenL1 } from "./constants";

export async function getWantToken(
  name: string,
  symbol: string,
  decimals: BigNumber
): Promise<WantERC20> {
  const wantTokenFactory = await hre.ethers.getContractFactory("WantERC20");
  const wantToken = (await wantTokenFactory.deploy(
    name,
    symbol,
    decimals
  )) as WantERC20;
  await wantToken.deployed();
  return wantToken;
}

export async function getERC20ContractAt(address: string): Promise<ERC20> {
  return (await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
    address
  )) as ERC20;
}

export async function getBaseRewardPoolAt(
  address: string
): Promise<IConvexRewards> {
  return (await hre.ethers.getContractAt(
    "IConvexRewards",
    address
  )) as IConvexRewards;
}

export async function getVault(
  wantTokenAddress: string,
  keeperAddress: string,
  governanceAddress: string,
  name?: string,
  symbol?: string
): Promise<Vault> {
  const vaultFactory = await hre.ethers.getContractFactory("Vault");
  const vault = (await vaultFactory.deploy(
    name || "ETH_MAXI",
    symbol || "ETH_MAXI",
    wantTokenAddress,
    keeperAddress,
    governanceAddress
  )) as Vault;
  await vault.deployed();
  return vault;
}

export async function getBatcher(
  verificationAuthority: string,
  vaultAddress: string,
  maxLimit: BigNumber
): Promise<Batcher> {
  const batcherFactory = await hre.ethers.getContractFactory("Batcher");
  const batcher = (await batcherFactory.deploy(
    verificationAuthority,
    vaultAddress,
    maxLimit
  )) as Batcher;
  await batcher.deployed();
  return batcher;
}

export async function getHarvester(vault: string): Promise<Harvester> {
  const HarvesterFactory = await hre.ethers.getContractFactory("Harvester");

  return (await HarvesterFactory.deploy(vault)) as Harvester;
}

export async function getConvexTradeExecutor(
  harvester: string,
  vault: string
): Promise<ConvexTradeExecutor> {
  const ConvexTradeExecutorFactory = await hre.ethers.getContractFactory(
    "ConvexTradeExecutor"
  );

  return (await ConvexTradeExecutorFactory.deploy(
    harvester,
    vault
  )) as ConvexTradeExecutor;
}

export async function getMockTradeExecutor(
  vaultAddress: string
): Promise<MockTradeExecutor> {
  const teFactory = await hre.ethers.getContractFactory("MockTradeExecutor");
  const tradeExecutor = (await teFactory.deploy(
    vaultAddress
  )) as MockTradeExecutor;
  await tradeExecutor.deployed();
  return tradeExecutor;
}

export async function getMockAsyncTradeExecutor(
  vaultAddress: string
): Promise<MockAsyncTradeExecutor> {
  const teFactory = await hre.ethers.getContractFactory(
    "MockAsyncTradeExecutor"
  );
  const tradeExecutor = (await teFactory.deploy(
    vaultAddress
  )) as MockAsyncTradeExecutor;
  await tradeExecutor.deployed();
  return tradeExecutor;
}
