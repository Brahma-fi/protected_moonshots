import { expect } from "chai";
import hre from "hardhat";
import dotenv from "dotenv";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Batcher, Hauler, IERC20, ICurveDepositZapper, ICurvePool, PerpPositionHandler, PerpTradeExecutor, PerpPositionHandlerL2, IClearingHouseConfig, IIndexPrice, IAccountBalance } from "../../src/types";
import { setup, getSignature, getHaulerContract, getUSDCContract } from "../utils";
import { BigNumber, BigNumberish } from "ethers";
import { optimismRPCBlock, optimismRPCPort, wantTokenL1, wantTokenL2, optimismL1CrossDomainMessenger, perpVault, clearingHouse, clearingHouseConfig, accountBalance, orderBook, exchange, baseTokenvCRV, quoteTokenvUSDC, movrRegistry} from "../../scripts/constants";
import { ChildProcess, exec } from 'child_process';
import { Provider } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";

import {moverCall} from "../api";




describe.only("PerpHandlerL2 [OPTIMISM]", function () {
    let keeperAddress: string;
    let governanceAddress: string;
    let signer: SignerWithAddress;
    let signerL2: SignerWithAddress;
    let invalidSigner: SignerWithAddress;
    let hauler: Hauler;

    let perpL2Handler: PerpPositionHandlerL2;
    let USDC: IERC20;

    let clearingHouseConfigContract: IClearingHouseConfig;
    let accountBalanceContract: IAccountBalance;



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
            invalidSigner.address,
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

        USDC = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", wantTokenL2) as IERC20;
        await USDC.connect(invalidSigner).transfer(perpL2Handler.address, (await USDC.balanceOf(invalidSigner.address)));

        const baseToken = await hre.ethers.getContractAt("IIndexPrice", baseTokenvCRV) as IIndexPrice;
        console.log(baseToken.address);
        clearingHouseConfigContract = await hre.ethers.getContractAt("IClearingHouseConfig", clearingHouseConfig) as IClearingHouseConfig;
        const twapInterval = await clearingHouseConfigContract.getTwapInterval();
        console.log('twap interval', twapInterval);
        console.log('index price', await baseToken.getIndexPrice(BigNumber.from(twapInterval)));

        accountBalanceContract = await hre.ethers.getContractAt("IAccountBalance", accountBalance) as IAccountBalance;

        

    });

    it("Contract initialized correctly", async function () {

        expect(await perpL2Handler.keeper()).equals(signer.address);

        const usdcBal = await USDC.balanceOf(perpL2Handler.address);

        expect(usdcBal.gt(0));

        console.log('Perp handler has USDC', usdcBal)
    });

    it("Can open short", async function () {

        let usdcBal = await USDC.balanceOf(perpL2Handler.address);
        usdcBal = usdcBal.mul(1e12);

        equal((await perpL2Handler.perpPosition()).isActive, false);

        equal(await accountBalanceContract.getTotalPositionSize(perpL2Handler.address, baseTokenvCRV), 0)

        console.log(usdcBal.div(1e9).div(1e9));
        await perpL2Handler.connect(signer).openPosition(true, usdcBal, 500);

        equal((await perpL2Handler.perpPosition()).isActive, true);
        equal((await perpL2Handler.perpPosition()).isShort, true);

        expect(!((await accountBalanceContract.getTotalPositionSize(perpL2Handler.address, baseTokenvCRV)).isZero()));

    });

    it("Can close short", async function () {

        let usdcBalBefore = await USDC.balanceOf(perpL2Handler.address);

        equal((await perpL2Handler.perpPosition()).isActive, true);
        await perpL2Handler.connect(signer).closePosition(1500);
        equal((await perpL2Handler.perpPosition()).isActive, false);
        expect(((await accountBalanceContract.getTotalPositionSize(perpL2Handler.address, baseTokenvCRV)).isZero()));

        let usdcBalAfter = await USDC.balanceOf(perpL2Handler.address);

        expect(usdcBalAfter.gt(usdcBalBefore))
    });



    it("Open position only works with keeper", async function () {

        let usdcBal = await USDC.balanceOf(perpL2Handler.address);
        usdcBal = usdcBal.mul(1e12);
        await expect(
            perpL2Handler.connect(invalidSigner).openPosition(true, usdcBal, 500)
          ).to.be.revertedWith("Only owner can call this function");
    });

    it("Close position only works with keeper", async function () {

        let usdcBal = await USDC.balanceOf(perpL2Handler.address);
        usdcBal = usdcBal.mul(1e12);
        await expect(
            perpL2Handler.connect(invalidSigner).closePosition(500)
          ).to.be.revertedWith("Only owner can call this function");
    });

    it("Can withdraw successfully", async function () {

        let usdcBalBefore = await USDC.balanceOf(perpL2Handler.address);

        const movrData = (await moverCall(perpL2Handler.address, invalidSigner.address, usdcBalBefore , false));
        const withdrawTxn = await perpL2Handler.connect(signer).withdraw(usdcBalBefore, movrData.target, movrData.registry, movrData.data);
        let usdcBalAfter = await USDC.balanceOf(perpL2Handler.address);

        // console.log(withdrawTxn)

        expect(usdcBalAfter.lt(usdcBalBefore))
    });

});

const equal = async function (a, b, reason?) {
    expect(a).equals(b, reason);
}