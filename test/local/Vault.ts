/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  Vault,
  MockTradeExecutor,
  WantERC20,
  MockAsyncTradeExecutor,
} from "../../src/types";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { randomSigner } from "../utils/signers";
import {
  getWantToken,
  getVault,
  getMockTradeExecutor,
  getMockAsyncTradeExecutor,
} from "../utils/contracts";

import { mineBlocks } from "../utils/hardhat";
import { randomBN } from "../utils/helper";

describe("Vault [LOCAL]", function () {
  let wantToken: WantERC20;
  let vault: Vault;
  let tradeExecutor: MockTradeExecutor;
  let asyncTradeExecutor: MockAsyncTradeExecutor;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let keeper: SignerWithAddress;
  let governance: SignerWithAddress;

  const vaultName = "Brahma Vault";
  const vaultSymbol = "BRAH_MAN";
  const BLOCK_LIMIT = BigNumber.from(50);

  beforeEach(async () => {
    signer = await randomSigner();
    invalidSigner = await randomSigner();
    keeper = await randomSigner();
    governance = await randomSigner();
    wantToken = await getWantToken(
      "magic internet dollars",
      "USDC",
      BigNumber.from(6)
    );

    vault = await getVault(
      wantToken.address,
      keeper.address,
      governance.address,
      vaultName,
      vaultSymbol
    );

    tradeExecutor = await getMockTradeExecutor(vault.address);
    asyncTradeExecutor = await getMockAsyncTradeExecutor(vault.address);

    const signerBalance = await ethers.provider.getBalance(signer.address);

    await wantToken.connect(signer).mint(randomBN(signerBalance));

    await wantToken.connect(signer).approve(vault.address, signerBalance);

    await vault.connect(governance).setBatcherOnlyDeposit(false);

    await vault.connect(governance).setPerformanceFee(BigNumber.from(1000));
  });

  // deployment - check access modifiers are set properly.
  it("Check address assignment vault", async function () {
    expect(await vault.decimals()).to.equals(await wantToken.decimals());
    expect(await vault.name()).to.equal(vaultName);
    expect(await vault.symbol()).to.equal(vaultSymbol);
    expect(await vault.keeper()).to.equals(keeper.address);
    expect(await vault.governance()).to.equal(governance.address);
    expect(await vault.performanceFee()).to.equal(BigNumber.from(1000));
  });

  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  it("Depositing funds into vault - without TE", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));

    await expect(
      vault.connect(signer).deposit(BigNumber.from(0), signer.address)
    ).to.be.revertedWith("ZERO_AMOUNT");
    await vault.connect(signer).deposit(depositAmount, signer.address);

    expect(await vault.totalVaultFunds()).to.equal(depositAmount);
    expect(await vault.totalSupply()).to.equal(depositAmount);
    expect(await vault.balanceOf(signer.address)).to.equal(depositAmount);
  });

  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  it("Depositing funds into vault - with sync TE", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));

    await vault.connect(governance).addExecutor(tradeExecutor.address);

    await vault.connect(signer).deposit(depositAmount, signer.address);

    expect(await vault.totalVaultFunds()).to.equal(depositAmount);
    expect(await vault.totalSupply()).to.equal(depositAmount);
    expect(await vault.balanceOf(signer.address)).to.equal(depositAmount);
  });

  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  //         - deposit should fail when the trade executor funds aren't updated.
  it("Depositing funds into vault - with async TE", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));

    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);

    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);

    expect(await vault.totalVaultFunds()).to.equal(depositAmount);
    expect(await vault.totalSupply()).to.equal(depositAmount);
    expect(await vault.balanceOf(signer.address)).to.equal(depositAmount);

    await mineBlocks(BLOCK_LIMIT);

    await expect(vault.totalVaultFunds()).to.be.revertedWith(
      "FUNDS_NOT_UPDATED"
    );
  });

  // addExecutor - should be done by gvoernance, increase in number of executors if address is unique. Address added should match with index value in list.
  it("Adding an executor", async function () {
    await expect(
      vault.connect(invalidSigner).addExecutor(tradeExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    const invalidVault = await getVault(
      wantToken.address,
      keeper.address,
      governance.address
    );

    const invalidExecutor = await getMockTradeExecutor(invalidVault.address);
    await expect(
      vault.connect(governance).addExecutor(invalidExecutor.address)
    ).to.be.revertedWith("INVALID_VAULT");

    await expect(
      vault
        .connect(governance)
        .addExecutor("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("NULL_ADDRESS");

    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await vault.connect(governance).addExecutor(tradeExecutor.address);

    expect(await vault.totalExecutors()).to.equal(BigNumber.from(2));
    expect(await vault.executorByIndex(0)).to.equal(tradeExecutor.address);
    expect(await vault.executorByIndex(1)).to.equal(asyncTradeExecutor.address);

    await expect(vault.executorByIndex(2)).to.be.revertedWith("INVALID_INDEX");
  });

  // depositIntoExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Deposit funds into executor", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);

    const executorDepositAmount = randomBN(depositAmount);

    await expect(
      vault
        .connect(invalidSigner)
        .depositIntoExecutor(tradeExecutor.address, executorDepositAmount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await expect(
      vault.connect(keeper).depositIntoExecutor(tradeExecutor.address, "0")
    ).to.be.revertedWith("ZERO_AMOUNT");

    await expect(
      vault
        .connect(keeper)
        .depositIntoExecutor(invalidSigner.address, executorDepositAmount)
    ).to.be.revertedWith("INVALID_EXECUTOR");

    await vault
      .connect(keeper)
      .depositIntoExecutor(tradeExecutor.address, executorDepositAmount);

    expect(await vault.totalVaultFunds()).to.equal(depositAmount);
    expect((await tradeExecutor.totalFunds())[0]).to.equal(
      executorDepositAmount
    );
    expect(await wantToken.balanceOf(vault.address)).to.equal(
      depositAmount.sub(executorDepositAmount)
    );
    expect(await wantToken.balanceOf(tradeExecutor.address)).to.equal(
      executorDepositAmount
    );
  });

  // withdrawFromExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Withdraw funds from executor", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);
    const executorDepositAmount = randomBN(depositAmount);
    await vault
      .connect(keeper)
      .depositIntoExecutor(tradeExecutor.address, executorDepositAmount);

    const executorWithdrawAmount = randomBN(executorDepositAmount);

    await expect(
      vault
        .connect(invalidSigner)
        .withdrawFromExecutor(tradeExecutor.address, executorWithdrawAmount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await expect(
      vault.connect(keeper).withdrawFromExecutor(tradeExecutor.address, "0")
    ).to.be.revertedWith("ZERO_AMOUNT");

    await expect(
      vault
        .connect(keeper)
        .withdrawFromExecutor(invalidSigner.address, executorWithdrawAmount)
    ).to.be.revertedWith("INVALID_EXECUTOR");

    await vault
      .connect(keeper)
      .withdrawFromExecutor(tradeExecutor.address, executorWithdrawAmount);
    expect(await vault.totalVaultFunds()).to.equal(depositAmount);
    expect((await tradeExecutor.totalFunds())[0]).to.equal(
      executorDepositAmount.sub(executorWithdrawAmount)
    );
    expect(await wantToken.balanceOf(vault.address)).to.equal(
      depositAmount.sub(executorDepositAmount).add(executorWithdrawAmount)
    );
  });

  // removeExecutor - should be done by governance, decrease in number of executors if address is unique.
  it("Removing an executor", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);
    const executorDepositAmount = randomBN(depositAmount);
    await vault
      .connect(keeper)
      .depositIntoExecutor(tradeExecutor.address, executorDepositAmount);

    await expect(
      vault.connect(invalidSigner).removeExecutor(tradeExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    // wantToken.connect(signer).transfer(tradeExecutor.address, depositAmount);
    await expect(
      vault.connect(governance).removeExecutor(tradeExecutor.address)
    ).to.be.revertedWith("FUNDS_TOO_HIGH");

    await vault
      .connect(keeper)
      .withdrawFromExecutor(tradeExecutor.address, executorDepositAmount);

    await vault.connect(governance).removeExecutor(tradeExecutor.address);
    expect(await vault.totalExecutors()).to.equal(BigNumber.from(1));

    await expect(
      vault.connect(governance).removeExecutor(tradeExecutor.address)
    ).to.be.revertedWith("INVALID_EXECUTOR");
    expect(await vault.totalExecutors()).to.equal(BigNumber.from(1));
  });

  // Operation - Expected Behaviour
  // withdraw - decrease in balance of pool, decrease in totalSupply, tokens should be more from receiver address.
  //         - withdraw should fail when the trade executor funds aren't updated.
  it("Withdrawing funds from vault", async function () {
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);

    await mineBlocks(BLOCK_LIMIT);

    const withdrawAmount = randomBN(depositAmount);
    await expect(
      vault.connect(keeper).withdraw(withdrawAmount, signer.address)
    ).to.be.revertedWith("FUNDS_NOT_UPDATED");

    const remainingBalance = depositAmount.sub(withdrawAmount);
    await asyncTradeExecutor.connect(keeper).setPosValue(0);

    await expect(vault.withdraw(0, signer.address)).to.be.revertedWith(
      "ZERO_SHARES"
    );

    const balanceBefore = await wantToken.balanceOf(signer.address);
    await vault.connect(signer).withdraw(withdrawAmount, signer.address);
    const balanceAfter = await wantToken.balanceOf(signer.address);
    expect(balanceAfter.sub(balanceBefore).gt(BigNumber.from(0))).to.equal(
      true
    );

    expect(await vault.totalVaultFunds()).to.be.gt(BigNumber.from(0));
    expect(await vault.totalSupply()).to.equal(remainingBalance);
    expect(await vault.balanceOf(signer.address)).to.equal(remainingBalance);
  });

  // collectFees - Gather any yield accumulated. Tested during deposit on vault
  it("Collecting fees during deposit", async function () {
    const depositAmount = randomBN(
      (await wantToken.balanceOf(signer.address)).div(2)
    );
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);
    const executorDepositAmount = randomBN(depositAmount);
    await vault
      .connect(keeper)
      .depositIntoExecutor(tradeExecutor.address, executorDepositAmount);

    const executorProfit = randomBN(executorDepositAmount);
    await wantToken
      .connect(signer)
      .transfer(tradeExecutor.address, executorProfit);

    await vault
      .connect(keeper)
      .withdrawFromExecutor(
        tradeExecutor.address,
        await wantToken.balanceOf(tradeExecutor.address)
      );

    const prevGovBalance = await wantToken.balanceOf(governance.address);

    await vault
      .connect(signer)
      .deposit(await wantToken.balanceOf(signer.address), signer.address);

    const newGovBalance = await wantToken.balanceOf(governance.address);
    const performanceFee = await vault.performanceFee();
    const yieldEarned = executorProfit.mul(performanceFee).div(10000);
    expect(newGovBalance.sub(prevGovBalance)).equal(yieldEarned);
  });

  // collectFees - Gather any yield accumulated. Tested during withdraw on vault
  it("Collecting fees during withdrawl", async function () {
    const depositAmount = randomBN(
      (await wantToken.balanceOf(signer.address)).div(2)
    );
    await vault.connect(governance).addExecutor(tradeExecutor.address);
    await vault.connect(governance).addExecutor(asyncTradeExecutor.address);
    await asyncTradeExecutor.connect(keeper).setPosValue(BigNumber.from(0));
    await vault.connect(signer).deposit(depositAmount, signer.address);
    const executorDepositAmount = randomBN(depositAmount);
    await vault
      .connect(keeper)
      .depositIntoExecutor(tradeExecutor.address, executorDepositAmount);

    const executorProfit = randomBN(executorDepositAmount);
    await wantToken
      .connect(signer)
      .transfer(tradeExecutor.address, executorProfit);

    await vault
      .connect(keeper)
      .withdrawFromExecutor(
        tradeExecutor.address,
        await wantToken.balanceOf(tradeExecutor.address)
      );

    const prevGovBalance = await wantToken.balanceOf(governance.address);

    await vault
      .connect(signer)
      .withdraw(await vault.balanceOf(signer.address), signer.address);

    const newGovBalance = await wantToken.balanceOf(governance.address);

    const performanceFee = await vault.performanceFee();
    const yieldEarned = executorProfit.mul(performanceFee).div(10000);
    expect(newGovBalance.sub(prevGovBalance)).equal(yieldEarned);
  });

  // setBatcher - only governance can set the batcher. Onlybatcher can deposit after this.
  it("Setting batcher", async function () {
    const batcherAddress = invalidSigner.address;
    await expect(
      vault.connect(invalidSigner).setBatcher(batcherAddress)
    ).to.be.revertedWith("ONLY_GOV");

    await vault.connect(governance).setBatcher(batcherAddress);
    await vault.connect(governance).setBatcherOnlyDeposit(true);

    expect(await vault.batcher()).to.equal(batcherAddress);
    await wantToken
      .connect(signer)
      .transfer(invalidSigner.address, BigNumber.from(100e6));
    const amount = await wantToken.balanceOf(invalidSigner.address);
    await wantToken
      .connect(invalidSigner)
      .approve(vault.address, utils.parseEther("1"));
    await vault.connect(invalidSigner).deposit(amount, invalidSigner.address);
    const expectedBalance = amount
      .mul(await vault.totalSupply())
      .div(await vault.totalVaultFunds());
    expect(await vault.balanceOf(invalidSigner.address)).to.equal(
      expectedBalance
    );
    await expect(
      vault.connect(signer).deposit(amount, signer.address)
    ).to.be.revertedWith("ONLY_BATCHER");
  });

  // setKeeper - only governance can set the keeper.
  it("Setting keeper", async function () {
    await expect(
      vault.connect(invalidSigner).setKeeper(governance.address)
    ).to.be.revertedWith("ONLY_GOV");

    await vault.connect(governance).setKeeper(governance.address);
    expect(await vault.keeper()).to.equal(governance.address);
  });

  // sweep and emergencyMode - sweep function can only work during emergency mode.
  //       - in emergency mode deposit/withdraw shouldn't be working.
  it("Sweeping funds", async function () {
    const randomFunds = randomBN(await wantToken.balanceOf(signer.address));
    await wantToken.connect(signer).transfer(vault.address, randomFunds);

    await expect(vault.sweep(wantToken.address)).to.be.revertedWith(
      "EMERGENCY_MODE"
    );

    await expect(
      vault.connect(signer).setEmergencyMode(true)
    ).to.be.revertedWith("ONLY_GOV");

    await vault.connect(governance).setEmergencyMode(true);
    const balanceBefore = await wantToken.balanceOf(governance.address);
    await vault.sweep(wantToken.address);
    const balanceAfter = await wantToken.balanceOf(governance.address);
    expect(balanceAfter.sub(balanceBefore).gt(BigNumber.from(0))).to.equal(
      true
    );

    expect(await vault.batcherOnlyDeposit()).to.equal(true);
    expect(await vault.emergencyMode()).to.equal(true);
    expect(await vault.batcher()).to.equal(
      "0x0000000000000000000000000000000000000000"
    );

    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await expect(
      vault.connect(signer).deposit(depositAmount, keeper.address)
    ).to.be.revertedWith("ONLY_BATCHER");
    await expect(
      vault.connect(signer).withdraw(depositAmount, keeper.address)
    ).to.be.revertedWith("ONLY_BATCHER");
  });

  //  setEmergencyMode - only governance can set the emergency mode.
  it("Unwinding Emergency Mode", async function () {
    await expect(
      vault.connect(invalidSigner).setEmergencyMode(false)
    ).to.be.revertedWith("ONLY_GOV");
    await vault.connect(governance).setEmergencyMode(false);
    expect(await vault.emergencyMode()).to.equal(false);
    expect(await vault.batcherOnlyDeposit()).to.equal(true);
    await vault.connect(governance).setBatcher(signer.address);
    expect(await vault.batcher()).to.equal(signer.address);
    const balanceBefore = await wantToken.balanceOf(signer.address);
    // transfer funds as they are sweeped before
    const depositAmount = randomBN(await wantToken.balanceOf(signer.address));
    await wantToken.connect(signer).transfer(vault.address, depositAmount);
    const balanceAfter = await wantToken.balanceOf(signer.address);
    expect(balanceBefore.sub(balanceAfter).gt(BigNumber.from(0))).to.equal(
      true
    );
  });

  // changeGovernance - only governance can change the governance.
  it("Changing governance", async function () {
    await expect(
      vault.connect(invalidSigner).setGovernance(keeper.address)
    ).to.be.revertedWith("ONLY_GOV");
    await vault.connect(governance).setGovernance(signer.address);
    await expect(
      vault.connect(invalidSigner).acceptGovernance()
    ).to.be.revertedWith("INVALID_ADDRESS");
    await vault.connect(signer).acceptGovernance();
    expect(await vault.governance()).to.equal(signer.address);
  });

  // setPerformanceFee - only governance can set performance fee. fee cannot exceed MAX_BPS/2
  it("Changing performance fee", async function () {
    await expect(
      vault.connect(invalidSigner).setPerformanceFee(BigNumber.from(1500))
    ).to.be.revertedWith("ONLY_GOV");

    await expect(
      vault.connect(governance).setPerformanceFee(BigNumber.from(5001))
    ).to.be.revertedWith("FEE_TOO_HIGH");

    const newPerformanceFee = randomBN(BigNumber.from(5000));

    await vault.connect(governance).setPerformanceFee(newPerformanceFee);

    expect(await vault.performanceFee()).equal(newPerformanceFee);
  });
});
