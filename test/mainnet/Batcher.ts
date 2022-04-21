import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Batcher, Vault, ICurveDepositZapper, ICurvePool } from "../../src/types";
import {
  setup,
  getSignature,
  getVaultContract,
  getUSDCContract
} from "../utils";
import { BigNumber, BigNumberish } from "ethers";
import { ust3Pool } from "../../scripts/constants";

// Language: typescript
// Path: test/Batcher.ts
// Main access modifiers owner, governor.

describe("Batcher [MAINNET]", function () {
  let batcher: Batcher;
  let keeperAddress: string;
  let governanceAddress: string;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let keeperSigner: SignerWithAddress;
  let vault: Vault;
  before(async () => {
    [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
    invalidSigner = (await hre.ethers.getSigners())[0];
    vault = await getVaultContract();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [keeperAddress]
    });
    console.log('verifying address', invalidSigner.address);
    keeperSigner = await hre.ethers.getSigner(keeperAddress);
  });

  it("Check address assingment Batcher", async function () {
    const Batcher = await hre.ethers.getContractFactory("Batcher", signer);
    batcher = (await Batcher.deploy(
      invalidSigner.address,
      governanceAddress,
      vault.address,
      BigNumber.from(1000e6)
    )) as Batcher;
    await batcher.deployed();
    expect(await batcher.governance()).to.equal(governanceAddress);
    expect(await batcher.keeper()).to.equal(signer.address);
    expect(await batcher.verificationAuthority()).to.equal(
      invalidSigner.address
    );
  });

  // Operation - Expected Behaviour
  // depositFunds -  increament in depositLedger mapping, batcher balance increament,
  //              -  decrease of USDC funds of user, message for user only verified
  //              - shouldn't breach maxDepositLimit of rotuer.
  // eposit - onlyOwner should call this function

  it("Deposit verification", async function () {
    let signature = await getSignature(
      signer.address,
      invalidSigner,
      batcher.address
    );
    console.log("signature:", signature);
    let amount = BigNumber.from(100e6);
    const USDC = await getUSDCContract();
    await USDC.connect(signer).approve(batcher.address, amount);
    // await batcher.setVaultParams(vault.address, USDC.address, BigNumber.from(1000e6));

    await batcher.depositFunds(amount, signature);
    expect(await batcher.depositLedger(signer.address)).to.equal(amount);
    await expect(
      batcher.connect(invalidSigner).batchDeposit([signer.address])
    ).to.be.revertedWith("ONLY_KEEPER");
    // checking for duplicated user deposit and invalide user deposit
    await batcher.connect(keeperSigner).batchDeposit([signer.address, signer.address, invalidSigner.address]);
    expect(await batcher.depositLedger(signer.address)).to.equal(
      BigNumber.from(0)
    );
    expect(await batcher.userLPTokens(signer.address)).to.equal(amount);
  });

  it("Claim tokens", async function () {
    const tokenBalance = await batcher.userLPTokens(signer.address);
    await batcher
      .connect(signer)
      .claimTokens(tokenBalance.div(2), signer.address);
    expect(await vault.balanceOf(signer.address)).to.equal(tokenBalance.div(2));
    expect(await batcher.userLPTokens(signer.address)).to.equal(
      tokenBalance.div(2)
    );
  });

  // Operation - Expected Behaviour
  // withdrawFunds -  increament in withdrawLedger mapping, batcher balance increament in vault tokens.
  //              -  increase of USDC funds of user.
  // batchWithdraw - onlyOwner should call this function, with decrease in vault tokens.

  it("Withdraw verification", async function () {
    let amount = BigNumber.from(100e6);
    const USDC = await getUSDCContract();
    await USDC.connect(signer).approve(vault.address, amount);
    await vault.deposit(amount, signer.address);
    await vault.connect(signer).approve(batcher.address, amount);
    await batcher.withdrawFunds(amount);
    await expect(
      batcher.connect(invalidSigner).batchWithdraw([signer.address])
    ).to.be.revertedWith("ONLY_KEEPER");

    expect(await batcher.withdrawLedger(signer.address)).to.equal(amount);

    expect(await vault.balanceOf(batcher.address)).to.equal(amount);
    let balanceBefore = await USDC.balanceOf(signer.address);
    // checking for duplicated user withdraw and invalide user withdraw
    await batcher.connect(keeperSigner).batchWithdraw([signer.address, signer.address, invalidSigner.address]);
    let balanceAfter = await USDC.balanceOf(signer.address);
    expect(await batcher.withdrawLedger(signer.address)).to.equal(
      BigNumber.from(0)
    );
    expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
  });


  // Operation - Expected Behaviour
  // sweep - sweeps erc20 from batcher to governance.
  it("Sweep verification", async function () {
    let amount = BigNumber.from(100e6);
    const USDC = await getUSDCContract();
    let signature = await getSignature(
      signer.address,
      invalidSigner,
      batcher.address
    );
    console.log("signature:", signature);
    await USDC.connect(signer).approve(batcher.address, amount);
    await batcher.depositFunds(amount, signature);
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await expect(
      batcher.connect(invalidSigner).sweep(USDC.address)
    ).to.be.revertedWith("ONLY_GOV");

    let balanceBefore = await USDC.balanceOf(governanceAddress);
    let balanceOfBatcher = await USDC.balanceOf(batcher.address);
    await batcher.connect(governanceSigner).sweep(USDC.address);
    let balanceAfter = await USDC.balanceOf(governanceAddress);

    expect(balanceAfter.sub(balanceBefore)).to.equal(balanceOfBatcher);
  });
});
