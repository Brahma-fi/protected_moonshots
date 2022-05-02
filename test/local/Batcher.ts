/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Batcher, Vault, WantERC20 } from "../../src/types";
import { getWantToken, getVault, getBatcher } from "../utils/contracts";
import { randomSigner, randomWallet, getSignature } from "../utils/signers";
import { randomBN } from "../utils/helper";
import { BigNumber, Wallet } from "ethers";

let wantToken: WantERC20;
let batcher: Batcher;
let vault: Vault;
let signer: SignerWithAddress;
let invalidSigner: SignerWithAddress;
let keeper: SignerWithAddress;
let governance: SignerWithAddress;
let verificationAuthority: Wallet;
let maxBatcherDepositLimit: BigNumber;

// Language: typescript
// Path: test/Batcher.ts
// Main access modifiers keeper, governor.

describe("Batcher [LOCAL]", function () {
  beforeEach(async () => {
    signer = await randomSigner();
    invalidSigner = await randomSigner();
    keeper = await randomSigner();
    governance = await randomSigner();
    verificationAuthority = await randomWallet();

    wantToken = await getWantToken(
      "pnzi US magic dollars",
      "USDC",
      BigNumber.from(6)
    );
    vault = await getVault(
      wantToken.address,
      keeper.address,
      governance.address
    );

    maxBatcherDepositLimit = hre.ethers.utils.parseEther("333");

    batcher = await getBatcher(
      verificationAuthority.address,
      vault.address,
      maxBatcherDepositLimit
    );

    await vault.connect(governance).setBatcher(batcher.address);

    await wantToken.connect(signer).mint(ethers.utils.parseEther("420"));

    await wantToken
      .connect(signer)
      .approve(batcher.address, ethers.utils.parseEther("420"));
  });

  it("Batcher deployed correctly", async function () {
    expect(await batcher.governance()).to.equal(governance.address);
    expect(await batcher.keeper()).to.equal(keeper.address);
    expect(await batcher.verificationAuthority()).to.equal(
      verificationAuthority.address
    );
    expect((await batcher.vaultInfo()).vaultAddress).to.equal(vault.address);
    expect((await batcher.vaultInfo()).tokenAddress).to.equal(
      wantToken.address
    );
    expect((await batcher.vaultInfo()).maxAmount).to.equal(
      maxBatcherDepositLimit
    );
  });

  // depositFunds -  increament in depositLedger mapping, batcher balance increament,
  //              -  decrease of WantToken funds of user, message for user only verified
  //              - shouldn't breach maxDepositLimit of rotuer.
  //              - Can be called by any contract, signature verified for recipient
  it("Want Deposit", async function () {
    const sampleRecipient = await randomWallet();

    const prevDepositLedger = await batcher.depositLedger(
      sampleRecipient.address
    );
    const prevPendingDeposit = await batcher.pendingDeposit();
    const prevWantBalance = await wantToken.balanceOf(batcher.address);

    const amount = randomBN((await batcher.vaultInfo()).maxAmount);

    const invalidAmount = (await batcher.vaultInfo()).maxAmount.add(1);

    await wantToken.connect(signer).approve(batcher.address, invalidAmount);

    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );

    const invalidSignature = await getSignature(
      signer.address,
      verificationAuthority,
      batcher.address
    );

    await expect(
      batcher
        .connect(signer)
        .depositFunds(amount, invalidSignature, sampleRecipient.address)
    ).to.be.revertedWith("ECDSA");

    await expect(
      batcher
        .connect(signer)
        .depositFunds(invalidAmount, validSignature, sampleRecipient.address)
    ).to.be.revertedWith("MAX_LIMIT_EXCEEDED");

    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);

    const newDepositLedger = await batcher.depositLedger(
      sampleRecipient.address
    );
    const newPendingDeposit = await batcher.pendingDeposit();
    const newWantBalance = await wantToken.balanceOf(batcher.address);

    expect(newDepositLedger.sub(prevDepositLedger)).equal(amount);
    expect(newPendingDeposit.sub(prevPendingDeposit)).equal(amount);
    expect(newWantBalance.sub(prevWantBalance)).equal(amount);
  });

  // batchDeposit - onlyKeeper should call this function
  it("Batch Deposit", async function () {
    await expect(
      batcher.connect(keeper).batchDeposit([signer.address])
    ).to.be.revertedWith("NO_DEPOSITS");

    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomWallet();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);

    const prevDepositLedger = await batcher.depositLedger(
      sampleRecipient.address
    );
    const prevPendingDeposit = await batcher.pendingDeposit();
    const prevWantBalance = await wantToken.balanceOf(batcher.address);

    await expect(
      batcher.connect(signer).batchDeposit([sampleRecipient.address])
    ).to.be.revertedWith("ONLY_KEEPER");

    await batcher
      .connect(keeper)
      .batchDeposit([
        sampleRecipient.address,
        invalidSigner.address,
        sampleRecipient.address,
      ]);

    const newDepositLedger = await batcher.depositLedger(
      sampleRecipient.address
    );
    const newPendingDeposit = await batcher.pendingDeposit();
    const newWantBalance = await wantToken.balanceOf(batcher.address);

    expect(prevDepositLedger.sub(newDepositLedger)).equal(amount);
    expect(prevPendingDeposit.sub(newPendingDeposit)).equal(amount);
    expect(prevWantBalance.sub(newWantBalance)).equal(amount);
  });

  // claimTokens -  decrement userLPTokens, send LP tokens to recipient address
  //              - Can be called by any contract, signature verified for recipient
  it("Claim Tokens", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomWallet();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);
    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);

    const claimAmount = randomBN(amount);
    const invalidClaimAmount = amount.add(1);

    const prevUserLPTokens = await batcher.userLPTokens(
      sampleRecipient.address
    );
    const prevERC20LPTokens = await vault.balanceOf(sampleRecipient.address);

    await expect(
      batcher
        .connect(signer)
        .claimTokens(invalidClaimAmount, sampleRecipient.address)
    ).to.be.revertedWith("NO_FUNDS");

    await batcher
      .connect(signer)
      .claimTokens(claimAmount, sampleRecipient.address);

    const newUserLPTokens = await batcher.userLPTokens(sampleRecipient.address);
    const newERC20LPTokens = await vault.balanceOf(sampleRecipient.address);

    expect(prevUserLPTokens.sub(newUserLPTokens)).equal(claimAmount);
    expect(newERC20LPTokens.sub(prevERC20LPTokens)).equal(claimAmount);
  });

  // initiateWithdrawal -  increament in withdrawLedger mapping, batcher balance increament in vault tokens.
  //              -  increase of WantToken funds of user.
  it("Withdraw Initiate - only userLPTokens", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);

    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(amount)
    ).to.be.revertedWith("DEPOSIT_PENDING");

    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);
    const claimAmount = randomBN(amount);
    await batcher
      .connect(signer)
      .claimTokens(claimAmount, sampleRecipient.address);

    const prevUserLPTokens = await batcher.userLPTokens(
      sampleRecipient.address
    );
    const prevERC20LPTokens = await vault.balanceOf(sampleRecipient.address);
    const prevWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const prevPendingWithdrawl = await batcher.pendingWithdrawal();

    const withdrawAmount = randomBN(prevUserLPTokens);
    const invalidWithdrawAmount = prevUserLPTokens.add(1);

    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(invalidWithdrawAmount)
    ).to.be.reverted;
    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(0)
    ).to.be.revertedWith("AMOUNT_IN_ZERO");
    await batcher.connect(sampleRecipient).initiateWithdrawal(withdrawAmount);

    const newUserLPTokens = await batcher.userLPTokens(sampleRecipient.address);
    const newERC20LPTokens = await vault.balanceOf(sampleRecipient.address);
    const newWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const newPendingWithdrawl = await batcher.pendingWithdrawal();

    expect(prevUserLPTokens.sub(newUserLPTokens)).equal(withdrawAmount);
    expect(newERC20LPTokens.sub(prevERC20LPTokens)).equal(0);
    expect(newWithdrawLedger.sub(prevWithdrawLedger)).equal(withdrawAmount);
    expect(newPendingWithdrawl.sub(prevPendingWithdrawl)).equal(withdrawAmount);
  });

  // initiateWithdrawal -  increament in withdrawLedger mapping, batcher balance increament in vault tokens.
  //              -  increase of WantToken funds of user.
  it("Withdraw Initiate - both tokens", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);

    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(amount)
    ).to.be.revertedWith("DEPOSIT_PENDING");

    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);
    const claimAmount = randomBN(amount);
    await batcher
      .connect(signer)
      .claimTokens(claimAmount, sampleRecipient.address);

    const prevUserLPTokens = await batcher.userLPTokens(
      sampleRecipient.address
    );
    const prevERC20LPTokens = await vault.balanceOf(sampleRecipient.address);
    const prevWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const prevPendingWithdrawl = await batcher.pendingWithdrawal();

    const withdrawAmount = prevUserLPTokens.add(randomBN(prevERC20LPTokens));
    const invalidWithdrawAmount = prevUserLPTokens
      .add(prevERC20LPTokens)
      .add(1);

    await vault
      .connect(sampleRecipient)
      .approve(batcher.address, invalidWithdrawAmount);

    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(invalidWithdrawAmount)
    ).to.be.reverted;
    await expect(
      batcher.connect(sampleRecipient).initiateWithdrawal(0)
    ).to.be.revertedWith("AMOUNT_IN_ZERO");
    await batcher.connect(sampleRecipient).initiateWithdrawal(withdrawAmount);

    const newUserLPTokens = await batcher.userLPTokens(sampleRecipient.address);
    const newERC20LPTokens = await vault.balanceOf(sampleRecipient.address);
    const newWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const newPendingWithdrawl = await batcher.pendingWithdrawal();

    expect(prevUserLPTokens.sub(newUserLPTokens)).equal(prevUserLPTokens);
    expect(prevERC20LPTokens.sub(newERC20LPTokens)).equal(
      withdrawAmount.sub(prevUserLPTokens)
    );
    expect(newWithdrawLedger.sub(prevWithdrawLedger)).equal(withdrawAmount);
    expect(newPendingWithdrawl.sub(prevPendingWithdrawl)).equal(withdrawAmount);
  });

  // batchWithdraw - onlyKeeper should call this function, with decrease in vault tokens.
  it("Batch Withdraw", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);
    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);

    const withdrawAmount = randomBN(amount);
    await batcher.connect(sampleRecipient).initiateWithdrawal(withdrawAmount);

    await expect(
      batcher
        .connect(sampleRecipient)
        .depositFunds(amount, validSignature, sampleRecipient.address)
    ).to.be.revertedWith("WITHDRAW_PENDING");

    const prevWantERC20Tokens = await wantToken.balanceOf(
      sampleRecipient.address
    );
    const prevWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const prevPendingWithdrawl = await batcher.pendingWithdrawal();
    const prevUserWantTokens = await batcher.userWantTokens(
      sampleRecipient.address
    );

    await expect(
      batcher.connect(signer).batchWithdraw([sampleRecipient.address])
    ).to.be.revertedWith("ONLY_KEEPER");
    await expect(
      batcher.connect(keeper).batchWithdraw([signer.address])
    ).to.be.revertedWith("NO_WITHDRAWS");

    await batcher
      .connect(keeper)
      .batchWithdraw([
        sampleRecipient.address,
        signer.address,
        sampleRecipient.address,
      ]);

    const newWantERC20Tokens = await wantToken.balanceOf(
      sampleRecipient.address
    );
    const newWithdrawLedger = await batcher.withdrawLedger(
      sampleRecipient.address
    );
    const newPendingWithdrawl = await batcher.pendingWithdrawal();
    const newUserWantTokens = await batcher.userWantTokens(
      sampleRecipient.address
    );

    expect(newWantERC20Tokens.sub(prevWantERC20Tokens)).equal(0);
    expect(prevWithdrawLedger.sub(newWithdrawLedger)).equal(withdrawAmount);
    expect(prevPendingWithdrawl.sub(newPendingWithdrawl)).equal(withdrawAmount);
    expect(newUserWantTokens.sub(prevUserWantTokens)).equal(withdrawAmount);
  });

  // completeWithdrawal - user should finally call this to claim want tokens back
  it("Complete Withdraw", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);
    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);

    const withdrawAmount = randomBN(amount);
    await batcher.connect(sampleRecipient).initiateWithdrawal(withdrawAmount);
    await batcher.connect(keeper).batchWithdraw([sampleRecipient.address]);

    const amountOut = randomBN(withdrawAmount);
    const invalidAmountOut = withdrawAmount.add(1);

    const prevWantERC20Tokens = await wantToken.balanceOf(
      sampleRecipient.address
    );
    const prevUserWantTokens = await batcher.userWantTokens(
      sampleRecipient.address
    );

    await expect(
      batcher.connect(signer).completeWithdrawal(0, sampleRecipient.address)
    ).to.be.revertedWith("INVALID_AMOUNTOUT");
    await expect(
      batcher
        .connect(signer)
        .completeWithdrawal(invalidAmountOut, sampleRecipient.address)
    ).to.be.reverted;
    await batcher
      .connect(signer)
      .completeWithdrawal(amountOut, sampleRecipient.address);

    const newWantERC20Tokens = await wantToken.balanceOf(
      sampleRecipient.address
    );
    const newUserWantTokens = await batcher.userWantTokens(
      sampleRecipient.address
    );

    expect(newWantERC20Tokens.sub(prevWantERC20Tokens)).equal(amountOut);
    expect(prevUserWantTokens.sub(newUserWantTokens)).equal(amountOut);
  });

  // setAuthority - update verification authority
  it("Set Authority", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();

    const oldSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );

    const randomVerificationAuthority = await randomWallet();

    const randomAuthoritySignature = await getSignature(
      sampleRecipient.address,
      randomVerificationAuthority,
      batcher.address
    );

    await expect(
      batcher
        .connect(signer)
        .depositFunds(amount, randomAuthoritySignature, sampleRecipient.address)
    ).to.be.revertedWith("ECDSA");

    await expect(
      batcher.connect(keeper).setAuthority(randomVerificationAuthority.address)
    ).to.be.revertedWith("ONLY_GOV");

    await batcher
      .connect(governance)
      .setAuthority(randomVerificationAuthority.address);

    await expect(
      batcher
        .connect(signer)
        .depositFunds(amount, oldSignature, sampleRecipient.address)
    ).to.be.revertedWith("ECDSA");

    await batcher
      .connect(signer)
      .depositFunds(amount, randomAuthoritySignature, sampleRecipient.address);
  });

  // setVaultLimit - update the vault limit
  it("Set Vault Limit", async function () {
    const newLimit = randomBN(ethers.utils.parseEther("500"));

    await expect(
      batcher.connect(keeper).setVaultLimit(newLimit)
    ).to.be.revertedWith("ONLY_GOV");

    await batcher.connect(governance).setVaultLimit(newLimit);

    const newVaultLimit = (await batcher.vaultInfo()).maxAmount;

    expect(newVaultLimit).equal(newLimit);
  });

  // setDepositSignatureCheck - update signature verification boolean
  it("Set Deposit Signature Check", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();

    const randomVerificationAuthority = await randomWallet();

    const randomAuthoritySignature = await getSignature(
      sampleRecipient.address,
      randomVerificationAuthority,
      batcher.address
    );

    await expect(
      batcher
        .connect(signer)
        .depositFunds(amount, randomAuthoritySignature, sampleRecipient.address)
    ).to.be.revertedWith("ECDSA");

    await expect(
      batcher.connect(keeper).setDepositSignatureCheck(false)
    ).to.be.revertedWith("ONLY_GOV");

    await batcher.connect(governance).setDepositSignatureCheck(false);

    await batcher
      .connect(signer)
      .depositFunds(amount, randomAuthoritySignature, sampleRecipient.address);
  });

  // sweep - sweeps erc20 from batcher to governance.
  it("Sweep", async function () {
    const amount = randomBN((await batcher.vaultInfo()).maxAmount);
    const sampleRecipient = await randomSigner();
    const validSignature = await getSignature(
      sampleRecipient.address,
      verificationAuthority,
      batcher.address
    );
    await batcher
      .connect(signer)
      .depositFunds(amount, validSignature, sampleRecipient.address);
    await batcher.connect(keeper).batchDeposit([sampleRecipient.address]);

    const withdrawAmount = randomBN(amount);
    await batcher.connect(sampleRecipient).initiateWithdrawal(withdrawAmount);
    await batcher.connect(keeper).batchWithdraw([sampleRecipient.address]);

    const prevWantERC20Tokens = await wantToken.balanceOf(batcher.address);
    const prevLPERC20Tokens = await vault.balanceOf(batcher.address);
    const prevGovWantBalance = await wantToken.balanceOf(governance.address);
    const prevGovLPBalance = await vault.balanceOf(governance.address);

    await expect(
      batcher.connect(keeper).sweep(wantToken.address)
    ).to.be.revertedWith("ONLY_GOV");
    await expect(
      batcher.connect(keeper).sweep(vault.address)
    ).to.be.revertedWith("ONLY_GOV");
    await batcher.connect(governance).sweep(wantToken.address);
    await batcher.connect(governance).sweep(vault.address);

    const newWantERC20Tokens = await wantToken.balanceOf(batcher.address);
    const newLPERC20Tokens = await vault.balanceOf(batcher.address);
    const newGovWantBalance = await wantToken.balanceOf(governance.address);
    const newGovLPBalance = await vault.balanceOf(governance.address);

    expect(newWantERC20Tokens).equal(0);
    expect(newLPERC20Tokens).equal(0);
    expect(newGovLPBalance.sub(prevGovLPBalance)).equal(prevLPERC20Tokens);
    expect(newGovWantBalance.sub(prevGovWantBalance)).equal(
      prevWantERC20Tokens
    );
  });
});
