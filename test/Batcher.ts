import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {Batcher, ERC20, MetaRouter} from "../src/types";
import {setup, getSignature, getMetaRouterContract} from "./utils";
import { BigNumber } from "ethers";

// Language: typescript
// Path: test/Batcher.ts
// Main access modifiers owner, governor.

describe("Batcher", function () {
    let batcher: Batcher;
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let router: MetaRouter;
    before(async () => {
        [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
        router = await getMetaRouterContract();
     });

    it("Check address assingment Batcher", async function () {
        const Batcher = await hre.ethers.getContractFactory("Batcher", signer);
        batcher = (await Batcher.deploy(invalidSigner.address, governanceAddress)) as Batcher;
        await batcher.deployed();
        expect(await batcher.governance()).to.equal(governanceAddress);
        expect(await batcher.owner()).to.equal(signer.address);
        expect(await batcher.verificationAuthority()).to.equal(invalidSigner.address);
    
    });
    
    // Operation - Expected Behaviour
    // depositFunds -  increament in depositLedger mapping, batcher balance increament,
    //              -  decrease of USDC funds of user, message for user only verified
    //              - shouldn't breach maxDepositLimit of rotuer.  

    it("Deposit verification", async function () {
       let signature =  await getSignature(signer.address, invalidSigner, batcher.address);
        console.log("signature:", signature);
        let amount = BigNumber.from(100e6);
        const USDC = (await hre.ethers.getContractAt(
          "ERC20",
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        )) as ERC20;
        await USDC.connect(signer).approve(batcher.address, amount);
        await batcher.setRouterParams(router.address, USDC.address, BigNumber.from(1000e6));

        await batcher.depositFunds(amount, router.address ,signature);
        expect(await batcher.depositLedger(router.address, signer.address)).to.equal(amount);

        await batcher.batchDeposit(router.address, [signer.address]);
        expect(await batcher.depositLedger(router.address, signer.address)).to.equal(BigNumber.from(0));

    });

    // Operation - Expected Behaviour
    // withdrawFunds -  increament in withdrawLedger mapping, batcher balance increament in router tokens.
    //              -  increase of USDC funds of user.
    it("Withdraw verification", async function () {

    });

    // Operation - Expected Behaviour
    // batchDeposit - onlyOwner should call this function, user usdc balance should decrease with increase in router tokens.
    it("Batch deposit verification", async function () {
    });

    // Operation - Expected Behaviour
    // batchWithdraw - onlyOwner should call this function, user usdc balance should increase with decrease in router tokens.
    it("Batch withdraw verification", async function () {
    });


});