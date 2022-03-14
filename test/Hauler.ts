import { expect } from "chai";
import hre from "hardhat";

import {
  Hauler,
  ConvexTradeExecutor,
  ERC20,
  PerpPositionHandler,
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
  getUSDCContract,
} from "./utils";

describe("Hauler", function () {
  let hauler: Hauler;
  let convexTradeExecutor: ConvexTradeExecutor;
  let perpTradeExecutor: PerpTradeExecutor;
  let token_name: string = "BUSDC";
  let token_symbol: string = "BUSDC";
  let token_decimals: number = 6;
  let keeperAddress: string;
  let governanceAddress: string;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let USDC: ERC20;

  before(async () => {
    [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
    USDC = (await hre.ethers.getContractAt(
      "ERC20",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    )) as ERC20;
  });

  // Operation - Expected Behaviour
  // deployment - check access modifiers are set properly.
  it("Check address assignment hauler", async function () {
    const Hauler = await hre.ethers.getContractFactory(
      "Hauler",
      signer
    );
    hauler = (await Hauler.deploy(
      token_name,
      token_symbol,
      token_decimals,
      wantTokenL1,
      keeperAddress,
      governanceAddress
    )) as Hauler;
    await hauler.deployed();
    console.log("Hauler deployed at: ", hauler.address);
    expect(await hauler.decimals()).to.equals(token_decimals);
    expect(await hauler.name()).to.equal(token_name);
    expect(await hauler.keeper()).to.equals(keeperAddress);
    expect(await hauler.governance()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  //         - deposit should fail when the trade executor funds aren't updated.

  it("Depositing funds into Hauler", async function () {
    let amount = BigNumber.from(100e6);
    await USDC.connect(signer).approve(
      hauler.address,
      utils.parseEther("1")
    );
    await hauler.deposit(amount, keeperAddress);

    perpTradeExecutor = await getPerpExecutorContract(
      hauler.address,
      signer
    );

    await hauler.addExecutor(perpTradeExecutor.address);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    expect(await hauler.totalHaulerFunds()).to.equal(amount);
    expect(await hauler.totalSupply()).to.equal(amount);
    expect(await hauler.balanceOf(signer.address)).to.equal(amount);

    const start = new Date();

    // move time forward
    // await ethers.provider.send("evm_setNextBlockTimestamp", [start.getTime()+(7*24*60*60)]);
    await mineBlocks(60);

    await expect(hauler.deposit(amount, keeperAddress)).to.be.revertedWith(
      "Executor funds are not up to date"
    );
  });

  // Operation - Expected Behaviour
  // addExecutor - should be done by keeper, increase in number of executors if address is unique. Address added should match with index value in list.
  it("Adding an executor", async function () {
    let tempExecutor = await getConvexExecutorContract(hauler.address);
    convexTradeExecutor = await getConvexExecutorContract(hauler.address);

    await expect(
      hauler.connect(invalidSigner).addExecutor(tempExecutor.address)
    ).to.be.revertedWith("Only keeper call");

    await hauler.addExecutor(tempExecutor.address);
    await hauler.addExecutor(convexTradeExecutor.address);
    await hauler.addExecutor(tempExecutor.address);

    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(3));
    expect(await hauler.executorByIndex(1)).to.equal(tempExecutor.address);
    expect(await hauler.executorByIndex(2)).to.equal(
      convexTradeExecutor.address
    );
  });

  // Operation - Expected Behaviour
  // depositIntoExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Deposit funds into executor", async function () {
    let amount = BigNumber.from(100e6);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      hauler
        .connect(invalidSigner)
        .depositIntoExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("Only keeper call");

    await hauler.depositIntoExecutor(convexTradeExecutor.address, amount);
    expect(await hauler.totalHaulerFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(amount);
    expect(await USDC.balanceOf(hauler.address)).to.equal(
      BigNumber.from(0)
    );
  });

  // Operation - Expected Behaviour
  // withdrawFromExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Withdraw funds into executor", async function () {
    let amount = BigNumber.from(100e6);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      hauler
        .connect(invalidSigner)
        .withdrawFromExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("Only keeper call");

    await hauler.withdrawFromExecutor(convexTradeExecutor.address, amount);
    expect(await hauler.totalHaulerFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(
      BigNumber.from(0)
    );
    expect(await USDC.balanceOf(hauler.address)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // removeExecutor - should be done by keeper, decrease in number of executors if address is unique.
  it("Removing an executor", async function () {
    await expect(
      hauler
        .connect(invalidSigner)
        .removeExecutor(convexTradeExecutor.address)
    ).to.be.revertedWith("Only keeper call");

    await hauler.removeExecutor(convexTradeExecutor.address);
    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(2));

    await hauler.removeExecutor(convexTradeExecutor.address);
    expect(await hauler.totalExecutors()).to.equal(BigNumber.from(2));
  });

  // Operation - Expected Behaviour
  // withdraw - decrease in balance of pool, decrease in totalSupply, tokens should be more from depositer address.
  //         - withdraw should fail when the trade executor funds aren't updated.
  it("Withdrawing funds from Hauler", async function () {
    let amount = BigNumber.from(100e6);
    await mineBlocks(60);
    await expect(
      hauler.withdraw(amount, signer.address)
    ).to.be.revertedWith("Executor funds are not up to date");
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    await hauler.withdraw(amount, signer.address);
    expect(await hauler.totalHaulerFunds()).to.equal(BigNumber.from(0));
    expect(await hauler.totalSupply()).to.equal(BigNumber.from(0));
    expect(await hauler.balanceOf(signer.address)).to.equal(
      BigNumber.from(0)
    );
  });

  // Operation - Expected Behaviour
  // setBatcher - only governance can set the batcher. Onlybatcher can deposit after this.
  it("Setting batcher", async function () {
    let batcherAddress = invalidSigner.address;
    await expect(
      hauler.connect(invalidSigner).setBatcher(batcherAddress)
    ).to.be.revertedWith("Only governance call");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setBatcher(batcherAddress);
    expect(await hauler.batcher()).to.equal(batcherAddress);
    await USDC.connect(signer).transfer(invalidSigner.address, BigNumber.from(100e6));
    let amount = await USDC.balanceOf(invalidSigner.address);
    await USDC.connect(invalidSigner).approve(
      hauler.address,
      utils.parseEther("1")
    );
    await hauler.connect(invalidSigner).deposit(amount, invalidSigner.address);
    expect(await hauler.balanceOf(invalidSigner.address)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // setKeeper - only governance can set the keeper.
  it("Setting keeper", async function () {
    await expect(
      hauler.connect(invalidSigner).setKeeper(governanceAddress)
    ).to.be.revertedWith("Only governance call");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setKeeper(governanceAddress);
    expect(await hauler.keeper()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // changeGovernance - only governance can change the governance.
  it("Changing governance", async function () {
    await expect(
      hauler.connect(invalidSigner).setGovernance(keeperAddress)
    ).to.be.revertedWith("Only governance call");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await hauler.connect(governanceSigner).setGovernance(signer.address);
    await hauler.acceptGovernance();
    expect(await hauler.governance()).to.equal(signer.address);
  });
});
