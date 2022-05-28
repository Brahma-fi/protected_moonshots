import hardhat, { ethers } from "hardhat";
import {
  randomSigner,
  getSigner,
  randomWallet,
} from "../../test/utils/signers";
import {
  Migratooor,
  IHauler,
  IBatcherOld,
  ConvexTradeExecutor,
  IperpTE,
  IERC20,
  PerpTradeExecutor,
} from "../../src/types";
import { BigNumber } from "ethers";
import { BatchWithdrawSuccessfulEvent } from "../../src/types/Batcher";
import { hrtime } from "process";

async function main() {
  // let convexLptokenAddress = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269") as IERC20;
  // let lpHolder = await getSigner("0xCEAF7747579696A2F0bb206a14210e3c9e6fB269");

  // let lpBal = await convexLptokenAddress.balanceOf(lpHolder.address)
  // console.log('lpBal', lpBal);
  // convexLptokenAddress.connect(lpHolder).transfer("0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D", lpBal);

  let testingWallet = await randomWallet();
  let testingSigner = await getSigner(testingWallet.address);

  let pmusdcHolder = await getSigner(
    "0xc0a227a440aA6432aFeC59423Fd68BD00cAbB529"
  );

  let oldHauler = (await ethers.getContractAt(
    "IHauler",
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e"
  )) as IHauler;
  // let oldBatcher = await ethers.getContractAt("IBatcherOld", "0x1b6BF7Ab4163f9a7C1D4eCB36299525048083B5e") as IBatcherOld;

  await oldHauler
    .connect(pmusdcHolder)
    .transfer(
      testingSigner.address,
      await oldHauler.balanceOf(pmusdcHolder.address)
    );

  let governanceAddress = await oldHauler.governance();
  console.log(governanceAddress);
  let keeperAddress = await oldHauler.keeper();

  let governance = await getSigner(governanceAddress);
  let keeper = await getSigner(keeperAddress);

  let perpTE = (await ethers.getContractAt(
    "PerpTradeExecutor",
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D"
  )) as PerpTradeExecutor;

  await perpTE.connect(keeper).setPosValue(0);

  // // let closePosParam = ethers.utils.AbiCoder.prototype.encode(["tuple(uint256)"], [[perpPosition[0]]]);

  // // await perpTE.connect(keeper).closePosition(closePosParam);

  let Vault = await ethers.getContractFactory("Vault");
  let vault = await Vault.deploy(
    "who cares",
    "noa",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    keeperAddress,
    keeperAddress
  );
  await vault.deployed();

  let Batcher = await ethers.getContractFactory("Batcher");
  let batcher = await Batcher.deploy(
    vault.address,
    vault.address,
    BigNumber.from(1e9).mul(1e9)
  );
  await batcher.deployed();
  console.log("governance", keeper.address);
  await batcher.connect(keeper).setDepositSignatureCheck(false);

  // We get the contract to deploy
  const Migratooor = await ethers.getContractFactory("Migratooor");
  const migratooor = (await Migratooor.deploy(batcher.address)) as Migratooor;

  await migratooor.deployed();

  console.log("Migratooor deployed to:", migratooor.address);

  let typedPermitData = {
    types: {
      Permit: [
        {
          name: "owner",
          type: "address",
        },
        {
          name: "spender",
          type: "address",
        },
        {
          name: "value",
          type: "uint256",
        },
        {
          name: "nonce",
          type: "uint256",
        },
        {
          name: "deadline",
          type: "uint256",
        },
      ],
    },
    primaryType: "Permit",
    domain: {
      name: "USD Coin",
      version: "2",
      //   chainId: hardhat.network.config.chainId,
      chainId: 1,
      verifyingContract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    message: {
      owner: testingWallet.address,
      spender: migratooor.address,
      value: ethers.constants.MaxInt256,
      nonce: await ethers.provider.getTransactionCount(testingWallet.address),
      deadline: Math.floor(Date.now() / 1000) + 360000, // valid for now + 60 mins
    },
  };

  console.log(
    "old pmusdc balance of signer",
    await oldHauler.balanceOf(testingSigner.address)
  );

  let permitSignature = await testingWallet._signTypedData(
    typedPermitData.domain,
    typedPermitData.types,
    typedPermitData.message
  );

  const v = "0x" + permitSignature.slice(130, 132);
  const r = permitSignature.slice(0, 66);
  const s = "0x" + permitSignature.slice(66, 130);

  await migratooor
    .connect(testingSigner)
    .migrateToV2(
      await oldHauler.balanceOf(testingSigner.address),
      ethers.constants.MaxInt256,
      typedPermitData.message.deadline,
      v,
      r,
      s,
      ethers.utils.randomBytes(32)
    );

  console.log(
    "new pmusdc balance of signer",
    await oldHauler.balanceOf(testingSigner.address)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
