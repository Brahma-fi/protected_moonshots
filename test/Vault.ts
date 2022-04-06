import { expect } from "chai";
import hre from "hardhat";

import {
  Vault,
  ConvexTradeExecutor,
  ERC20,
  PerpTradeExecutor
} from "../src/types";
import { wantTokenL1 } from "../scripts/constants";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  setup,
  getConvexExecutorContract,
  getPerpExecutorContract,
  mineBlocks
} from "./utils";

describe("Vault", function () {
  let vault: Vault;
  let convexTradeExecutor: ConvexTradeExecutor;
  let perpTradeExecutor: PerpTradeExecutor;
  let token_name: string = "BUSDC";
  let token_symbol: string = "BUSDC";
  let keeperAddress: string;
  let governanceAddress: string;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let governanceSigner: SignerWithAddress;
  let USDC: ERC20;
  let depositAmount: BigNumber;
  before(async () => {
    [
      keeperAddress,
      governanceAddress,
      signer,
      governanceSigner,
      invalidSigner
    ] = await setup();
    USDC = (await hre.ethers.getContractAt("ERC20", wantTokenL1)) as ERC20;
  });

  // Operation - Expected Behaviour
  // deployment - check access modifiers are set properly.
  it("Check address assignment vault", async function () {
    const vaultFactory = await hre.ethers.getContractFactory("Vault", signer);
    vault = (await vaultFactory.deploy(
      token_name,
      token_symbol,
      wantTokenL1,
      keeperAddress,
      governanceAddress
    )) as Vault;
    await vault.deployed();
    console.log("Vault deployed at: ", vault.address);
    // set performance fee
    await vault
      .connect(governanceSigner)
      .setPerformanceFee(BigNumber.from(1000));

    expect(await vault.decimals()).to.equals(await USDC.decimals());
    expect(await vault.name()).to.equal(token_name);
    expect(await vault.keeper()).to.equals(keeperAddress);
    expect(await vault.governance()).to.equal(governanceAddress);
    expect(await vault.performanceFee()).to.equal(BigNumber.from(1000));
  });

  // Operation - Expected Behaviour
  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  //         - deposit should fail when the trade executor funds aren't updated.

  it("Depositing funds into vault", async function () {
    depositAmount = BigNumber.from(10000e6);
    await USDC.connect(signer).approve(vault.address, utils.parseEther("1"));
    await vault.deposit(depositAmount, keeperAddress);

    perpTradeExecutor = await getPerpExecutorContract(vault.address, signer);

    await vault
      .connect(governanceSigner)
      .addExecutor(perpTradeExecutor.address);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    expect(await vault.totalvaultFunds()).to.equal(depositAmount);
    expect(await vault.totalSupply()).to.equal(depositAmount);
    expect(await vault.balanceOf(signer.address)).to.equal(depositAmount);

    // move time forward
    await mineBlocks(60);

    await expect(
      vault.deposit(depositAmount, keeperAddress)
    ).to.be.revertedWith("FUNDS_NOT_UPDATED");
  });

  // Operation - Expected Behaviour
  // addExecutor - should be done by gvoernance, increase in number of executors if address is unique. Address added should match with index value in list.
  it("Adding an executor", async function () {
    let tempExecutor = await getConvexExecutorContract(vault.address);
    convexTradeExecutor = await getConvexExecutorContract(vault.address);

    await expect(
      vault.connect(invalidSigner).addExecutor(tempExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    await vault.connect(governanceSigner).addExecutor(tempExecutor.address);
    await vault
      .connect(governanceSigner)
      .addExecutor(convexTradeExecutor.address);
    await vault.connect(governanceSigner).addExecutor(tempExecutor.address);

    expect(await vault.totalExecutors()).to.equal(BigNumber.from(3));
    expect(await vault.executorByIndex(1)).to.equal(tempExecutor.address);
    expect(await vault.executorByIndex(2)).to.equal(
      convexTradeExecutor.address
    );
  });

  // Operation - Expected Behaviour
  // depositIntoExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Deposit funds into executor", async function () {
    let amount = depositAmount;
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      vault
        .connect(invalidSigner)
        .depositIntoExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await vault.depositIntoExecutor(convexTradeExecutor.address, amount);
    expect(await vault.totalvaultFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(amount);
    expect(await USDC.balanceOf(vault.address)).to.equal(BigNumber.from(0));
  });

  // Operation - Expected Behaviour
  // withdrawFromExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Withdraw funds into executor", async function () {
    let amount = depositAmount;
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      vault
        .connect(invalidSigner)
        .withdrawFromExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await vault.withdrawFromExecutor(convexTradeExecutor.address, amount);
    expect(await vault.totalvaultFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(
      BigNumber.from(0)
    );
    expect(await USDC.balanceOf(vault.address)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // removeExecutor - should be done by governance, decrease in number of executors if address is unique.
  it("Removing an executor", async function () {
    await expect(
      vault.connect(invalidSigner).removeExecutor(convexTradeExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    await vault
      .connect(governanceSigner)
      .removeExecutor(convexTradeExecutor.address);
    expect(await vault.totalExecutors()).to.equal(BigNumber.from(2));

    await vault
      .connect(governanceSigner)
      .removeExecutor(convexTradeExecutor.address);
    expect(await vault.totalExecutors()).to.equal(BigNumber.from(2));
  });

  // Operation - Expected Behaviour
  // withdraw - decrease in balance of pool, decrease in totalSupply, tokens should be more from depositer address.
  //         - withdraw should fail when the trade executor funds aren't updated.
  it("Withdrawing funds from vault", async function () {
    let amount = BigNumber.from(10e6);
    await mineBlocks(60);
    await expect(vault.withdraw(amount, signer.address)).to.be.revertedWith(
      "FUNDS_NOT_UPDATED"
    );
    let remainingBalance = depositAmount.sub(amount);
    await perpTradeExecutor.setPosValue(0);
    await vault.withdraw(amount, signer.address);
    let comparision = (await vault.totalvaultFunds()).gt(BigNumber.from(0));
    expect(comparision).to.equal(true);
    expect(await vault.totalSupply()).to.equal(remainingBalance);
    expect(await vault.balanceOf(signer.address)).to.equal(remainingBalance);
    // remove perp trade executor
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    await vault
      .connect(governanceSigner)
      .removeExecutor(perpTradeExecutor.address);
  });

  // Operation - Expected Behaviour
  // collectFees - Gather any yield accumulated.
  it("Collecting fees", async function () {
    let tempExecutor = await vault.executorByIndex(0);
    // Transfer funds to executor position
    USDC.connect(signer).transfer(tempExecutor, depositAmount.div(2));
    // withdraw funds from execturor.
    await vault.withdrawFromExecutor(
      tempExecutor,
      await USDC.balanceOf(tempExecutor)
    );
    // withdraw funds from vault.
    let amount = BigNumber.from(90e6);
    let balanceBefore = await USDC.balanceOf(governanceAddress);
    // collect fees.
    await vault.withdraw(amount, signer.address);
    let balanceAfter = await USDC.balanceOf(governanceAddress);
    expect(balanceAfter.sub(balanceBefore).gt(BigNumber.from(0))).to.equal(
      true
    );
  });

  // Operation - Expected Behaviour
  // setBatcher - only governance can set the batcher. Onlybatcher can deposit after this.
  it("Setting batcher", async function () {
    let batcherAddress = invalidSigner.address;
    await expect(
      vault.connect(invalidSigner).setBatcher(batcherAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await vault.connect(governanceSigner).setBatcher(batcherAddress);
    await vault.connect(governanceSigner).setBatcherOnlyDeposit(true);

    expect(await vault.batcher()).to.equal(batcherAddress);
    await USDC.connect(signer).transfer(
      invalidSigner.address,
      BigNumber.from(100e6)
    );
    let amount = await USDC.balanceOf(invalidSigner.address);
    await USDC.connect(invalidSigner).approve(
      vault.address,
      utils.parseEther("1")
    );
    await vault.connect(invalidSigner).deposit(amount, invalidSigner.address);
    let expected_balance = amount
      .mul(await vault.totalSupply())
      .div(await vault.totalvaultFunds());
    expect(await vault.balanceOf(invalidSigner.address)).to.equal(
      expected_balance
    );
    await expect(
      vault.connect(signer).deposit(amount, signer.address)
    ).to.be.revertedWith("ONLY_BATCHER");
  });

  // Operation - Expected Behaviour
  // setKeeper - only governance can set the keeper.
  it("Setting keeper", async function () {
    await expect(
      vault.connect(invalidSigner).setKeeper(governanceAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await vault.connect(governanceSigner).setKeeper(governanceAddress);
    expect(await vault.keeper()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // changeGovernance - only governance can change the governance.
  it("Changing governance", async function () {
    await expect(
      vault.connect(invalidSigner).setGovernance(keeperAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await vault.connect(governanceSigner).setGovernance(signer.address);
    await vault.acceptGovernance();
    expect(await vault.governance()).to.equal(signer.address);
  });
});
