import { expect } from "chai";
import hre from "hardhat";
import dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Batcher, Hauler, IERC20, ICurveDepositZapper, ICurvePool, PerpPositionHandler, PerpTradeExecutor, PerpPositionHandlerL2 } from "../../src/types";
import { setup, getSignature, getHaulerContract, getUSDCContract } from "../utils";
import { BigNumber, BigNumberish } from "ethers";
import { optimismRPCBlock, optimismRPCPort, wantTokenL1, wantTokenL2, optimismL1CrossDomainMessenger, perpVault, clearingHouse, clearingHouseConfig, accountBalance, orderBook, exchange, baseTokenvCRV, quoteTokenvUSDC, movrRegistry} from "../../scripts/constants";
import { ChildProcess, exec } from 'child_process';
import { Provider } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";






describe.only("PerpHandlerL2", function () {
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let signerL2: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let hauler: Hauler;

    let perpL2Handler: PerpPositionHandlerL2;
    let USDC: IERC20;


    before(async () => {

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x45af3Bd5A2c60B7410f33C313c247c439b633446"]
        });

        signer = await hre.ethers.getSigner("0x45af3Bd5A2c60B7410f33C313c247c439b633446");

        await hre.network.provider.request({
            method: "hardhat_setBalance",
            params: ["0x45af3Bd5A2c60B7410f33C313c247c439b633446", "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"]
        });

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xAE75B29ADe678372D77A8B41225654138a7E6ff1"]
        });

        invalidSigner = await hre.ethers.getSigner("0xAE75B29ADe678372D77A8B41225654138a7E6ff1");

        const PerpHandlerL2 = await hre.ethers.getContractFactory("PerpPositionHandlerL2", invalidSigner);
        perpL2Handler = await PerpHandlerL2.deploy(
            wantTokenL1,
            wantTokenL2,
            "0x0000000000000000000000000000000000000000",
            perpVault,
            clearingHouse,
            clearingHouseConfig,
            accountBalance,
            orderBook,
            exchange,
            baseTokenvCRV,
            quoteTokenvUSDC,
            signer.address,
            movrRegistry,
        ) as PerpPositionHandlerL2;

        await perpL2Handler.deployed();

        // await hre.network.provider.request({
        //     method: "hardhat_impersonateAccount",
        //     params: ["0xdecc0c09c3b5f6e92ef4184125d5648a66e35298"]
        // });

        // const USDCWhale = await hre.ethers.getSigner("0xdecc0c09c3b5f6e92ef4184125d5648a66e35298");

        USDC = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", wantTokenL2) as IERC20;
        await USDC.connect(invalidSigner).transfer(perpL2Handler.address, (await USDC.balanceOf(invalidSigner.address)));

    });

    it("Contract initialized correctly", async function () {

        expect(await perpL2Handler.keeper()).equals(signer.address);

        expect((await USDC.balanceOf(perpL2Handler.address)).gt(0));
    });

    it("Can open long", async function () {

        let usdcBal = await USDC.balanceOf(perpL2Handler.address);
        usdcBal = usdcBal.mul(10e12).mul(5);

        console.log(usdcBal.div(10e9).div(10e9).toString());
        await perpL2Handler.connect(signer).openPosition(false, usdcBal, 500);

    });

});