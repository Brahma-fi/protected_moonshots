import { expect } from "chai";
import hre from "hardhat";

import {
  MetaRouter,
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

describe("Metarouter", function () {
  let metaRouter: MetaRouter;
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
  it("Check address assignment meta router", async function () {
    const MetaRouter = await hre.ethers.getContractFactory(
      "MetaRouter",
      signer
    );
    metaRouter = (await MetaRouter.deploy(
      token_name,
      token_symbol,
      token_decimals,
      wantTokenL1,
      keeperAddress,
      governanceAddress
    )) as MetaRouter;
    await metaRouter.deployed();
    console.log("MetaRouter deployed at: ", metaRouter.address);
    expect(await metaRouter.decimals()).to.equals(token_decimals);
    expect(await metaRouter.name()).to.equal(token_name);
    expect(await metaRouter.keeper()).to.equals(keeperAddress);
    expect(await metaRouter.governance()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // deposit - increase in balance of pool, increase in totalSupply, tokens should be supplied to depositer address.
  //         - deposit should fail when the trade executor funds aren't updated.

  it("Depositing funds into Metarouter", async function () {
    let amount = BigNumber.from(100e6);
    await USDC.connect(signer).approve(
      metaRouter.address,
      utils.parseEther("1")
    );
    await metaRouter.deposit(amount, keeperAddress);

    perpTradeExecutor = await getPerpExecutorContract(
      metaRouter.address,
      signer
    );

    await metaRouter.addExecutor(perpTradeExecutor.address);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    expect(await metaRouter.totalRouterFunds()).to.equal(amount);
    expect(await metaRouter.totalSupply()).to.equal(amount);
    expect(await metaRouter.balanceOf(signer.address)).to.equal(amount);

    const start = new Date();

    // move time forward
    // await ethers.provider.send("evm_setNextBlockTimestamp", [start.getTime()+(7*24*60*60)]);
    await mineBlocks(60);

    await expect(metaRouter.deposit(amount, keeperAddress)).to.be.revertedWith(
      "Executor funds are not up to date"
    );
  });

  // Operation - Expected Behaviour
  // addExecutor - should be done by keeper, increase in number of executors if address is unique. Address added should match with index value in list.
  it("Adding an executor", async function () {
    let tempExecutor = await getConvexExecutorContract(metaRouter.address);
    convexTradeExecutor = await getConvexExecutorContract(metaRouter.address);

    await expect(
      metaRouter.connect(invalidSigner).addExecutor(tempExecutor.address)
    ).to.be.revertedWith("Only keeper call");

    await metaRouter.addExecutor(tempExecutor.address);
    await metaRouter.addExecutor(convexTradeExecutor.address);
    await metaRouter.addExecutor(tempExecutor.address);

    expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(3));
    expect(await metaRouter.executorByIndex(1)).to.equal(tempExecutor.address);
    expect(await metaRouter.executorByIndex(2)).to.equal(
      convexTradeExecutor.address
    );
  });

  // Operation - Expected Behaviour
  // depositIntoExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Deposit funds into executor", async function () {
    let amount = BigNumber.from(100e6);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      metaRouter
        .connect(invalidSigner)
        .depositIntoExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("Only keeper call");

    await metaRouter.depositIntoExecutor(convexTradeExecutor.address, amount);
    expect(await metaRouter.totalRouterFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(amount);
    expect(await USDC.balanceOf(metaRouter.address)).to.equal(
      BigNumber.from(0)
    );
  });

  // Operation - Expected Behaviour
  // withdrawFromExecutor - should be done by keeper, increase in funds of executor. Totalfunds should remain same.
  it("Withdraw funds into executor", async function () {
    let amount = BigNumber.from(100e6);
    await perpTradeExecutor.setPosValue(BigNumber.from(0));

    await expect(
      metaRouter
        .connect(invalidSigner)
        .withdrawFromExecutor(convexTradeExecutor.address, amount)
    ).to.be.revertedWith("Only keeper call");

    await metaRouter.withdrawFromExecutor(convexTradeExecutor.address, amount);
    expect(await metaRouter.totalRouterFunds()).to.equal(amount);
    expect((await convexTradeExecutor.totalFunds())[0]).to.equal(
      BigNumber.from(0)
    );
    expect(await USDC.balanceOf(metaRouter.address)).to.equal(amount);
  });

  // Operation - Expected Behaviour
  // removeExecutor - should be done by keeper, decrease in number of executors if address is unique.
  it("Removing an executor", async function () {
    await expect(
      metaRouter
        .connect(invalidSigner)
        .removeExecutor(convexTradeExecutor.address)
    ).to.be.revertedWith("Only keeper call");

    await metaRouter.removeExecutor(convexTradeExecutor.address);
    expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(2));

    await metaRouter.removeExecutor(convexTradeExecutor.address);
    expect(await metaRouter.totalExecutors()).to.equal(BigNumber.from(2));
  });

  // Operation - Expected Behaviour
  // withdraw - decrease in balance of pool, decrease in totalSupply, tokens should be more from depositer address.
  //         - withdraw should fail when the trade executor funds aren't updated.
  it("Withdrawing funds from Metarouter", async function () {
    let amount = BigNumber.from(100e6);
    await mineBlocks(60);
    await expect(
      metaRouter.withdraw(amount, signer.address)
    ).to.be.revertedWith("Executor funds are not up to date");
    await perpTradeExecutor.setPosValue(BigNumber.from(0));
    await metaRouter.withdraw(amount, signer.address);
    expect(await metaRouter.totalRouterFunds()).to.equal(BigNumber.from(0));
    expect(await metaRouter.totalSupply()).to.equal(BigNumber.from(0));
    expect(await metaRouter.balanceOf(signer.address)).to.equal(
      BigNumber.from(0)
    );
  });

  // Operation - Expected Behaviour
  // setKeeper - only governance can set the keeper.
  it("Setting keeper", async function () {
    await expect(
      metaRouter.connect(invalidSigner).setKeeper(governanceAddress)
    ).to.be.revertedWith("Only governance call");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await metaRouter.connect(governanceSigner).setKeeper(governanceAddress);
    expect(await metaRouter.keeper()).to.equal(governanceAddress);
  });

  // Operation - Expected Behaviour
  // changeGovernance - only governance can change the governance.
  it("Changing governance", async function () {
    await expect(
      metaRouter.connect(invalidSigner).setGovernance(keeperAddress)
    ).to.be.revertedWith("Only governance call");
    let governanceSigner = await hre.ethers.getSigner(governanceAddress);

    await metaRouter.connect(governanceSigner).setGovernance(signer.address);
    await metaRouter.acceptGovernance();
    expect(await metaRouter.governance()).to.equal(signer.address);
  });
});
