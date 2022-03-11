import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {Batcher} from "../src/types";
import {setup} from "./utils";


describe("Batcher", function () {
    let batcher: Batcher;
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let invalidSigner: SignerWithAddress;

    before(async () => {
        [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
     });

    it("Check address assingment Batcher", async function () {
        const Batcher = await hre.ethers.getContractFactory("Batcher", signer);
        batcher = (await Batcher.deploy(governanceAddress, governanceAddress)) as Batcher;
        await batcher.deployed();
        expect(await batcher.governance()).to.equal(governanceAddress);
        expect(await batcher.owner()).to.equal(signer.address);
        expect(await batcher.verificationAuthority()).to.equal(governanceAddress);
    
    });


});