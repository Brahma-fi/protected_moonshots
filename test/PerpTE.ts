import { expect } from "chai";
import hre from "hardhat";
import dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {Batcher, Hauler, ICurveDepositZapper, ICurvePool, PerpPositionHandler, PerpTradeExecutor, PerpPositionHandlerL2} from "../src/types";
import {setup, getSignature, getHaulerContract, getUSDCContract} from "./utils";
import { BigNumber, BigNumberish } from "ethers";
import { optimismRPCBlock, optimismRPCPort, wantTokenL1, wantTokenL2, optimismL1CrossDomainMessenger, } from "../scripts/constants";
import { ChildProcess, exec } from 'child_process';
import { Provider } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";

// Language: typescript
// Path: test/PerpTE.ts
// Main access modifiers governance, keeper.

let optimismForkRPC:ChildProcess;

dotenv.config;

describe.only("PerpTE", function () {
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let signerL2: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let hauler: Hauler;

    let l1Provider: JsonRpcProvider;
    let l2Provider: JsonRpcProvider;

    let perpTE: PerpTradeExecutor;
    let perpL2Handler: PerpPositionHandlerL2;

    
    
    before(async () => {
        optimismForkRPC =  exec(`npx hardhat node --fork https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY} --fork-block-number ${optimismRPCBlock} --port ${optimismRPCPort}`,
        function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }
        });

        try {
            await new Promise(r => setTimeout(r, 10000));

            l1Provider = hre.ethers.provider;
            l2Provider = new hre.ethers.providers.JsonRpcProvider('http://127.0.0.1:8550');

            [keeperAddress, governanceAddress, signer, invalidSigner] = await setup();
            hauler = await getHaulerContract();

            const signerL2 = new hre.ethers.Wallet(process.env.PRIVATE_KEY, l2Provider);
            console.log(signerL2)

            const PerpL2Handler = await hre.ethers.getContractFactory("PerpPositionHandlerL2", signerL2);
            perpL2Handler = await PerpL2Handler.deploy() as PerpPositionHandlerL2;
            await perpL2Handler.deployed();

            // console.log(PerpL2Handler.getDeployTransaction().chainId);

            const PerpTE = await hre.ethers.getContractFactory("PerpTradeExecutor", signer);
            perpTE = await PerpTE.deploy(
                hauler.address,
                wantTokenL2,
                perpL2Handler.address,
                optimismL1CrossDomainMessenger
            ) as PerpTradeExecutor;

            await perpTE.deployed();

            console.log(PerpTE.getDeployTransaction(hauler.address,
                wantTokenL2,
                perpL2Handler.address,
                optimismL1CrossDomainMessenger).chainId);


        } catch (err) {
            console.log(err);
            optimismForkRPC.kill();
        }
     });

    it("L1 and L2 contracts initialized correctly", async function () {



        console.log('l1signer', signer.address);
        console.log('l2signer', signerL2.address);
        
        const l1bal = await l1Provider.getBalance("0xAE75B29ADe678372D77A8B41225654138a7E6ff1");
        console.log('l1 bal', l1bal.toString());

        
        const l2bal = await l2Provider.getBalance("0xAE75B29ADe678372D77A8B41225654138a7E6ff1");
        console.log('l2 bal', l2bal.toString());


        optimismForkRPC.kill(0);
    
    });
    after( async() => {

        optimismForkRPC.kill(0);

    })

});