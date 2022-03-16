import { expect } from "chai";
import hre from "hardhat";
import dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {Batcher, Hauler, ICurveDepositZapper, ICurvePool} from "../src/types";
import {setup, getSignature, getHaulerContract, getUSDCContract} from "./utils";
import { BigNumber, BigNumberish } from "ethers";
import { optimismRPCBlock, optimismRPCPort } from "../scripts/constants";
import { ChildProcess, exec } from 'child_process';
import { Provider } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";

// Language: typescript
// Path: test/PerpTE.ts
// Main access modifiers owner, governor.

let optimismForkRPC:ChildProcess;

dotenv.config;

describe.only("PerpTE", function () {
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let hauler: Hauler;

    let l1Provider: JsonRpcProvider;
    let l2Provider: JsonRpcProvider;

    
    
    before(async () => {
        optimismForkRPC =  exec(`npx hardhat node --fork https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY} --fork-block-number ${optimismRPCBlock} --port ${optimismRPCPort}`,
        function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }
        });
        await new Promise(r => setTimeout(r, 10000));

        l1Provider = hre.ethers.provider;
        l2Provider = new hre.ethers.providers.JsonRpcProvider('http://localhost:8550');

        [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();

     });

    it("Check address assingment Batcher", async function () {



        console.log('nysigner', signer.address);
        
        const l1bal = await l1Provider.getBalance("0xAE75B29ADe678372D77A8B41225654138a7E6ff1");
        console.log('l1 bal', l1bal.toString());

        
        const l2bal = await l2Provider.getBalance("0xAE75B29ADe678372D77A8B41225654138a7E6ff1");
        console.log('l2 bal', l2bal.toString());

    
    });
    after( async() => {

        optimismForkRPC.kill(0);

    })

});