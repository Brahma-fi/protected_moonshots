import hre, { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import axios from "axios";
import {
  Batcher,
  IBatcherOld,
  Vault,
  IVaultOld,
  IOldConvexTE,
  IOldPerpTEL2,
  Migratooor,
  IERC20,
  PerpTradeExecutor,
} from "../src/types";
import { writeFileSync } from "fs";

async function main() {
  // const SIMULATE_API = `https://api.tenderly.co/api/v1/account/${process.env.TENDERLY_USER}/project/${process.env.TENDERLY_PROJECT}/simulate`
  // const TENDERLY_FORK_URL = `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`

  const { TENDERLY_USER, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY } = process.env;
  const TENDERLY_FORK_API = `http://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`;

  const opts = {
    headers: {
      "X-Access-Key": TENDERLY_ACCESS_KEY as string,
    },
  };
  const body = {
    network_id: "1",
  };

  const resp = await axios.post(TENDERLY_FORK_API, body, opts);
  let fork_id = resp.data.simulation_fork.id;

  let forkRPCUrl = `https://rpc.tenderly.co/fork/${fork_id}`;

  writeFileSync("tenderlyConfig.json", JSON.stringify({ forkRPCUrl }));

  process.env.TENDERLY_FORK_ID = fork_id;

  // console.log(forkRPCUrl)

  await waitFor(15000);

  // console.log(hre.network.provider)

  await hre.changeNetwork("tenderly");

  // console.log(ethers.provider.connection.url)

  const oldVaultAddress = "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e";
  const oldBatcherAddress = "0x1b6BF7Ab4163f9a7C1D4eCB36299525048083B5e";
  const oldConvexTEAddress = "0xEB032b7025E2064c6B7B99C9c64D999DC94c4c70";
  const oldPerpTEAddress = "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D";

  const usdc = (await ethers.getContractAt(
    "contracts/PerpL2/interfaces/IERC20.sol:IERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  )) as IERC20;

  const oldBatcher = (await hre.ethers.getContractAt(
    "IBatcherOld",
    oldBatcherAddress
  )) as IBatcherOld;
  const oldVault = (await hre.ethers.getContractAt(
    "IVaultOld",
    oldVaultAddress
  )) as IVaultOld;
  const oldPerpTE = (await hre.ethers.getContractAt(
    "PerpTradeExecutor",
    oldPerpTEAddress
  )) as PerpTradeExecutor;
  const oldConvexTE = (await hre.ethers.getContractAt(
    "IOldConvexTE",
    oldConvexTEAddress
  )) as IOldConvexTE;

  const keeper = (await ethers.getSigners())[0];

  console.log("Keeper address", keeper.address);

  let balance = (await oldConvexTE.positionInWantToken())[0];
  let paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[balance]]
  );
  await oldConvexTE.connect(keeper).initiateWithdraw(paramsInBytes);

  let usdcBalance = await usdc.balanceOf(oldConvexTE.address);

  await oldVault
    .connect(keeper)
    .withdrawFromExecutor(oldConvexTEAddress, usdcBalance);

  let newBalance = (await oldConvexTE.positionInWantToken())[0];
  paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[newBalance]]
  );

  await oldConvexTE.connect(keeper).initiateWithdraw(paramsInBytes);

  usdcBalance = await usdc.balanceOf(oldConvexTE.address);

  await oldVault
    .connect(keeper)
    .withdrawFromExecutor(oldConvexTEAddress, usdcBalance);

  newBalance = (await oldConvexTE.positionInWantToken())[0];

  console.log("position after withdraw", newBalance.toString());

  await oldPerpTE.connect(keeper).setPosValue(0);

  await oldVault.connect(keeper).removeExecutor(oldPerpTE.address);

  await oldVault.connect(keeper).removeExecutor(oldConvexTE.address);

  // const transaction = [{
  //     // network_id: '1',
  //     from: await oldVault.governance(),
  //     data: removalTxn.data,
  //     to: oldVault.address,
  //     // block_number: null,
  //     value: ethers.utils.hexValue(0),
  //     gasPrice: ethers.utils.hexValue(1),
  //     gas: ethers.utils.hexValue(3000000)
  //     // save: true
  // }]

  // console.log(transaction)
  // const opts = {
  //     headers: {
  //         'X-Access-Key': process.env.TENDERLY_ACCESS_KEY || "",
  //     }
  // }
  // let resp = await ethers.provider.send('eth_sendTransaction', transaction)
  // console.log(resp);

  const Vault = await ethers.getContractFactory("Vault");
  let vault = (await Vault.deploy(
    "Protected Moonshots",
    "PMUSDC",
    usdc.address,
    keeper.address,
    keeper.address
  )) as Vault;
  await vault.deployed();

  console.log("Vault V2", vault.address);

  const Batcher = await ethers.getContractFactory("Batcher");
  let batcher = (await Batcher.deploy(
    await oldBatcher.verificationAuthority(),
    vault.address,
    ethers.utils.hexValue(10000000)
  )) as Batcher;
  await batcher.deployed();

  await batcher.connect(keeper).setDepositSignatureCheck(false);

  console.log("Batcher V2", batcher.address);

  const Migrator = await ethers.getContractFactory("Migratooor");
  let migratooor = (await Migrator.deploy(batcher.address)) as Migratooor;
  await migratooor.deployed();

  console.log("Migrator", migratooor.address);
}

export const waitFor = (ms: number) => new Promise((r) => setTimeout(r, ms));

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
