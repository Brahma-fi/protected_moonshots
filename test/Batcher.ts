import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {Batcher, ERC20} from "../src/types";
import {setup, getSignature} from "./utils";
import { BigNumber } from "ethers";
import { sign } from "crypto";


describe("Batcher", function () {
    let batcher: Batcher;
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let routerAddres: string;
    before(async () => {
        [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
        routerAddres = "0x95Ba4cF87D6723ad9C0Db21737D862bE80e93911";
     });

    it("Check address assingment Batcher", async function () {
        const Batcher = await hre.ethers.getContractFactory("Batcher", signer);
        batcher = (await Batcher.deploy(invalidSigner.address, governanceAddress)) as Batcher;
        await batcher.deployed();
        expect(await batcher.governance()).to.equal(governanceAddress);
        expect(await batcher.owner()).to.equal(signer.address);
        expect(await batcher.verificationAuthority()).to.equal(invalidSigner.address);
    
    });

    it("Deposit verification", async function () {
       let signature =  await getSignature(signer.address, invalidSigner, batcher.address);
        console.log("signature:", signature);
        let amount = BigNumber.from(100e6);
        const USDC = (await hre.ethers.getContractAt(
          "ERC20",
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        )) as ERC20;
        await USDC.connect(signer).approve(batcher.address, amount);
        await batcher.setRouter(routerAddres, USDC.address, BigNumber.from(1000e6));

        await batcher.depositFunds(amount, routerAddres ,signature);
        expect(await batcher.depositLedger(routerAddres, signer.address)).to.equal(amount);
    });

});