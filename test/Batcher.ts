import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Batcher, Vault, ICurveDepositZapper, ICurvePool } from "../src/types";
import {
  setup,
  getSignature,
  getvaultContract,
  getUSDCContract
} from "./utils";
import { BigNumber, BigNumberish } from "ethers";
import { ust3Pool } from "../scripts/constants";

// Language: typescript
// Path: test/Batcher.ts
// Main access modifiers owner, governor.

describe("Batcher", function () {
  let batcher: Batcher;
  let keeperAddress: string;
  let governanceAddress: string;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let vault: Vault;
  before(async () => {
    [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
    vault = await getvaultContract();
  });

  it("Check address assingment Batcher", async function () {
    const Batcher = await hre.ethers.getContractFactory("Batcher", signer);
    batcher = (await Batcher.deploy(
      invalidSigner.address,
      governanceAddress
    )) as Batcher;
    await batcher.deployed();
    expect(await batcher.governance()).to.equal(governanceAddress);
    expect(await batcher.owner()).to.equal(signer.address);
    expect(await batcher.verificationAuthority()).to.equal(
      invalidSigner.address
    );
  });

  // Operation - Expected Behaviour
  // depositFunds -  increament in depositLedger mapping, batcher balance increament,
  //              -  decrease of USDC funds of user, message for user only verified
  //              - shouldn't breach maxDepositLimit of rotuer.
  // batchDeposit - onlyOwner should call this function

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
    await batcher.setVaultParams(
      vault.address,
      USDC.address,
      BigNumber.from(1000e6)
    );

    await batcher.depositFunds(amount, vault.address, signature);
    expect(await batcher.depositLedger(vault.address, signer.address)).to.equal(
      amount
    );
    await expect(
      batcher
        .connect(invalidSigner)
        .batchDeposit(vault.address, [signer.address])
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await batcher.batchDeposit(vault.address, [signer.address]);
    expect(await batcher.depositLedger(vault.address, signer.address)).to.equal(
      BigNumber.from(0)
    );
    expect(await vault.balanceOf(signer.address)).to.equal(amount);
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
    await batcher.withdrawFunds(amount, vault.address);
    await expect(
      batcher
        .connect(invalidSigner)
        .batchWithdraw(vault.address, [signer.address])
    ).to.be.revertedWith("Ownable: caller is not the owner");

    expect(
      await batcher.withdrawLedger(vault.address, signer.address)
    ).to.equal(amount);

    expect(await vault.balanceOf(batcher.address)).to.equal(amount);
    let balanceBefore = await USDC.balanceOf(signer.address);
    await batcher.batchWithdraw(vault.address, [signer.address]);
    let balanceAfter = await USDC.balanceOf(signer.address);
    expect(
      await batcher.withdrawLedger(vault.address, signer.address)
    ).to.equal(BigNumber.from(0));
    expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // depositFundsInCurveLpToken - increament in depositLedger mapping, batcher balance increament in usdc.
  it("Deposit verification for curve lp tokens", async function () {
    // get curve lp tokens
    const curve3PoolZap = (await hre.ethers.getContractAt(
      "ICurveDepositZapper",
      "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
    )) as ICurveDepositZapper;
    const curvePool = (await hre.ethers.getContractAt(
      "ICurvePool",
      ust3Pool
    )) as ICurvePool;
    let usdc_amount = BigNumber.from(100e6).mul(BigNumber.from(1e6));
    let liquidityAmounts: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ] = [BigNumber.from(0), BigNumber.from(0), usdc_amount, BigNumber.from(0)];
    const USDC = await getUSDCContract();
    await USDC.connect(signer).approve(curve3PoolZap.address, usdc_amount);
    console.log("before deposit", await USDC.balanceOf(signer.address));
    await curve3PoolZap
      .connect(signer)
      .add_liquidity(ust3Pool, liquidityAmounts, BigNumber.from(0));
    console.log("after deposit");
    let lpTokenBalance = await curvePool.balanceOf(signer.address);
    console.log("Curve lp token balance:", lpTokenBalance);
    expect(lpTokenBalance.gt(BigNumber.from(0))).to.equal(true);
    await curvePool.connect(signer).approve(batcher.address, lpTokenBalance);
    let signature = await getSignature(
      signer.address,
      invalidSigner,
      batcher.address
    );

    await batcher.setVaultParams(vault.address, USDC.address, usdc_amount);
    await batcher.setSlippage(BigNumber.from(10000));
    await batcher.depositFundsInCurveLpToken(
      lpTokenBalance,
      vault.address,
      signature
    );
    let ledgerBalance = await batcher.depositLedger(
      vault.address,
      signer.address
    );
    console.log("ledger balance", ledgerBalance.toString());
    console.log("batcher balance", await USDC.balanceOf(batcher.address));
    expect(ledgerBalance.gt(BigNumber.from(0))).to.equal(true);
    expect(ledgerBalance.lt(lpTokenBalance)).to.equal(true);
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
    await batcher.depositFunds(amount, vault.address, signature);
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await expect(
      batcher.connect(invalidSigner).sweep(USDC.address)
    ).to.be.revertedWith("Only governance can call this");

    let balanceBefore = await USDC.balanceOf(governanceAddress);
    let balanceOfBatcher = await USDC.balanceOf(batcher.address);
    await batcher.connect(governanceSigner).sweep(USDC.address);
    let balanceAfter = await USDC.balanceOf(governanceAddress);

    expect(balanceAfter.sub(balanceBefore)).to.equal(balanceOfBatcher);
  });
});
