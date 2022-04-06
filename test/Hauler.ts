import { expect } from "chai";
import hre from "hardhat";

import {
  Hauler,
  ConvexTradeExecutor,
  ERC20,
  PerpTradeExecutor,
} from "../src/types";
import { wantTokenL1 } from "../scripts/constants";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  setup,
  getConvexExecutorContract,
  getPerpExecutorContract,
  mineBlocks,
} from "./utils";

describe("Hauler", function () {
  let hauler: Hauler;
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
      invalidSigner,
    ] = await setup();
    USDC = (await hre.ethers.getContractAt("ERC20", wantTokenL1)) as ERC20;
  });

  // Operation - Expected Behaviour
  // deployment - check access modifiers are set properly.
  it("Check address assignment hauler", async function () {
    const Hauler = await hre.ethers.getContractFactory("Hauler", signer);
    hauler = (await Hauler.deploy(
      token_name,
      token_symbol,
      wantTokenL1,
      keeperAddress,
      governanceAddress
    )) as Hauler;
    await hauler.deployed();
    console.log("Hauler deployed at: ", hauler.address);
    // set performance fee
    await hauler
      .connect(governanceSigner)
      .setPerformanceFee(BigNumber.from(1000));

    expect(await hauler.decimals()).to.equals(await USDC.decimals());
    expect(await hauler.name()).to.equal(token_name);
    expect(await hauler.keeper()).to.equals(keeperAddress);
    expect(await hauler.governance()).to.equal(governanceAddress);
    expect(await hauler.performanceFee()).to.equal(BigNumber.from(1000));
  });

  // Operation - Expected Behaviour
  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  //         - deposit should fail when the trade executor funds aren't updated.

  it("Depositing funds into Hauler", async function () {
    depositAmount = BigNumber.from(10000e6);
    await USDC.connect(signer).approve(hauler.address, utils.parseEther("1"));
    await hauler.deposit(depositAmount, keeperAddress);

    perpTradeExecutor = await getPerpExecutorContract(hauler.address, signer);

    await hauler
      .connect(governanceSigner)
      .addExecutor(perpTradeExecutor.address);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    expect(await hauler.totalHaulerFunds()).to.equal(depositAmount);
    expect(await hauler.totalSupply()).to.equal(depositAmount);
    expect(await hauler.balanceOf(signer.address)).to.equal(depositAmount);

    // move time forward
    await mineBlocks(60);

    await expect(
      hauler.deposit(depositAmount, keeperAddress)
    ).to.be.revertedWith("FUNDS_NOT_UPDATED");
  });

  // Operation - Expected Behaviour
  // addExecutor - should be done by gvoernance, increase in number of executors if address is unique. Address added should match with index value in list.
  it("Adding an executor", async function () {
    let tempExecutor = await getConvexExecutorContract(hauler.address);
    convexTradeExecutor = await getConvexExecutorContract(hauler.address);

    await expect(
      hauler.connect(invalidSigner).addExecutor(tempExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    await hauler.connect(governanceSigner).addExecutor(tempExecutor.address);
    await hauler
      .connect(governanceSigner)
      .addExecutor(convexTradeExecutor.address);
    await hauler.connect(governanceSigner).addExecutor(tempExecutor.address);

    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(3));
    expect(await hauler.executorByIndex(1)).to.equal(tempExecutor.address);
    expect(await hauler.executorByIndex(2)).to.equal(
      convexTradeExecutor.address
    );
  });

  // Operation - Expected Behaviour
  // depositIntoExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Deposit funds into executor", async function () {
    let amount = depositAmount;
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      hauler
        .connect(invalidSigner)
        .depositIntoExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await hauler.depositIntoExecutor(convexTradeExecutor.address, amount);
    expect(await hauler.totalHaulerFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(amount);
    expect(await USDC.balanceOf(hauler.address)).to.equal(BigNumber.from(0));
  });

  // Operation - Expected Behaviour
  // withdrawFromExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Withdraw funds into executor", async function () {
    let amount = depositAmount;
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      hauler
        .connect(invalidSigner)
        .withdrawFromExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("ONLY_KEEPER");

    await hauler.withdrawFromExecutor(convexTradeExecutor.address, amount);
    expect(await hauler.totalHaulerFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(
      BigNumber.from(0)
    );
    expect(await USDC.balanceOf(hauler.address)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // removeExecutor - should be done by governance, decrease in number of executors if address is unique.
  it("Removing an executor", async function () {
    await expect(
      hauler.connect(invalidSigner).removeExecutor(convexTradeExecutor.address)
    ).to.be.revertedWith("ONLY_GOV");

    await hauler
      .connect(governanceSigner)
      .removeExecutor(convexTradeExecutor.address);
    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(2));

    await hauler
      .connect(governanceSigner)
      .removeExecutor(convexTradeExecutor.address);
    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(2));
  });

  // Operation - Expected Behaviour
  // withdraw - decrease in balance of pool, decrease in totalSupply, tokens should be more from depositer address.
  //         - withdraw should fail when the trade executor funds aren't updated.
  it("Withdrawing funds from Hauler", async function () {
    let amount = BigNumber.from(10e6);
    await mineBlocks(60);
    await expect(hauler.withdraw(amount, signer.address)).to.be.revertedWith(
      "FUNDS_NOT_UPDATED"
    );
    let remainingBalance = depositAmount.sub(amount);
    await perpTradeExecutor.setPosValue(0);
    await hauler.withdraw(amount, signer.address);
    let comparision = (await hauler.totalHaulerFunds()).gt(BigNumber.from(0));
    expect(comparision).to.equal(true);
    expect(await hauler.totalSupply()).to.equal(remainingBalance);
    expect(await hauler.balanceOf(signer.address)).to.equal(remainingBalance);
    // remove perp trade executor
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    await hauler
      .connect(governanceSigner)
      .removeExecutor(perpTradeExecutor.address);
  });

  // Operation - Expected Behaviour
  // collectFees - Gather any yield accumulated.
  it("Collecting fees", async function () {
    let tempExecutor = await hauler.executorByIndex(0);
    // Transfer funds to executor position
    USDC.connect(signer).transfer(tempExecutor, depositAmount.div(2));
    // withdraw funds from execturor.
    await hauler.withdrawFromExecutor(
      tempExecutor,
      await USDC.balanceOf(tempExecutor)
    );
    // withdraw funds from hauler.
    let amount = BigNumber.from(90e6);
    let balanceBefore  = await  USDC.balanceOf(governanceAddress);
    // collect fees.
    await hauler.withdraw(amount, signer.address);
    let balanceAfter = await USDC.balanceOf(governanceAddress);
    expect(balanceAfter.sub(balanceBefore).gt(BigNumber.from(0))).to.equal(true);
  });

  // Operation - Expected Behaviour
  // setBatcher - only governance can set the batcher. Onlybatcher can deposit after this.
  it("Setting batcher", async function () {
    let batcherAddress = invalidSigner.address;
    await expect(
      hauler.connect(invalidSigner).setBatcher(batcherAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setBatcher(batcherAddress);
    await hauler.connect(governanceSigner).setBatcherOnlyDeposit(true);

    expect(await hauler.batcher()).to.equal(batcherAddress);
    await USDC.connect(signer).transfer(
      invalidSigner.address,
      BigNumber.from(100e6)
    );
    let amount = await USDC.balanceOf(invalidSigner.address);
    await USDC.connect(invalidSigner).approve(
      hauler.address,
      utils.parseEther("1")
    );
    await hauler.connect(invalidSigner).deposit(amount, invalidSigner.address);
    let expected_balance = amount
      .mul(await hauler.totalSupply())
      .div(await hauler.totalHaulerFunds());
    expect(await hauler.balanceOf(invalidSigner.address)).to.equal(
      expected_balance
    );
    await expect(
      hauler.connect(signer).deposit(amount, signer.address)
    ).to.be.revertedWith("ONLY_BATCHER");
  });

  // Operation - Expected Behaviour
  // setKeeper - only governance can set the keeper.
  it("Setting keeper", async function () {
    await expect(
      hauler.connect(invalidSigner).setKeeper(governanceAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setKeeper(governanceAddress);
    expect(await hauler.keeper()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // changeGovernance - only governance can change the governance.
  it("Changing governance", async function () {
    await expect(
      hauler.connect(invalidSigner).setGovernance(keeperAddress)
    ).to.be.revertedWith("ONLY_GOV");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setGovernance(signer.address);
    await hauler.acceptGovernance();
    expect(await hauler.governance()).to.equal(signer.address);
  });
});
