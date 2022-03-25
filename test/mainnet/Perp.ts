import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Hauler,
  IERC20,
  PerpPositionHandlerL2,
  IClearingHouseConfig,
  IIndexPrice,
  IAccountBalance,
  PerpTradeExecutor,
} from "../../src/types";
import { BigNumber, ContractTransaction, Signer } from "ethers";
import {
  optimismRPCBlock,
  optimismRPCPort,
  wantTokenL1,
  wantTokenL2,
  optimismL1CrossDomainMessenger,
  perpVault,
  clearingHouse,
  clearingHouseConfig,
  accountBalance,
  orderBook,
  exchange,
  baseToken,
  quoteTokenvUSDC,
  movrRegistry,
} from "../../scripts/constants";

import abiDecoder from "abi-decoder";

import { moverCall } from "../api";
import { Log } from "@ethersproject/abstract-provider";
import { Interface, LogDescription } from "ethers/lib/utils";

const hauler = "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e";
const USDCWhale = "0x500A746c9a44f68Fe6AA86a92e7B3AF4F322Ae66";


let optimismMessengerInterface: Interface;



describe.only("PerpTE [MAINNET]", function () {
  let keeperAddress: string;
  let governanceAddress: string;
  let signer: SignerWithAddress;
  let signerL2: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
	let haulerContract: Hauler;
  let perpTE: PerpTradeExecutor;
  let USDC: IERC20;
	let keeperSigner: SignerWithAddress;
  let clearingHouseConfigContract: IClearingHouseConfig;
  let accountBalanceContract: IAccountBalance;
	let PerpHandlerL2Contract: PerpPositionHandlerL2;

  before(async () => {

		


    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x45af3Bd5A2c60B7410f33C313c247c439b633446"],
    });

    signer = await hre.ethers.getSigner(
      "0x45af3Bd5A2c60B7410f33C313c247c439b633446"
    );

    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [
        "0x45af3Bd5A2c60B7410f33C313c247c439b633446",
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      ],
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xAE75B29ADe678372D77A8B41225654138a7E6ff1"],
    });

    invalidSigner = await hre.ethers.getSigner(
      "0xAE75B29ADe678372D77A8B41225654138a7E6ff1"
    );

    const PerpTradeExecutor = await hre.ethers.getContractFactory(
      "PerpTradeExecutor",
      invalidSigner
    );
    perpTE = (await PerpTradeExecutor.deploy(
        hauler, 
      wantTokenL2,
      invalidSigner.address, 
      optimismL1CrossDomainMessenger,
      movrRegistry
    )) as PerpTradeExecutor;

    await perpTE.deployed();

		haulerContract = await hre.ethers.getContractAt("Hauler", hauler) as Hauler;

		const keeperAtHauler = await haulerContract.keeper();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [keeperAtHauler],
    });

    keeperSigner = await hre.ethers.getSigner(
      keeperAtHauler
    );



		await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDCWhale],
    });

    const usdcWhaleSigner = await hre.ethers.getSigner(
      USDCWhale
    );
    

    USDC = (await hre.ethers.getContractAt(
      "ERC20",
      wantTokenL1
    )) as IERC20;
    await USDC.connect(usdcWhaleSigner).transfer(
      haulerContract.address,
      await USDC.balanceOf(usdcWhaleSigner.address)
    );
		PerpHandlerL2Contract = await hre.ethers.getContractAt("PerpPositionHandlerL2", invalidSigner.address) as PerpPositionHandlerL2;

  });

  it("Contract initialized correctly", async function () {
		await haulerContract.connect(keeperSigner).addExecutor(perpTE.address);

		equal(await haulerContract.keeper(), await perpTE.keeper());

		equal(await haulerContract.governance(), await perpTE.governance());
  });

  it("Hauler can deposit into TE", async function () {
		const oldUSDCBal = await USDC.balanceOf(perpTE.address);

		await haulerContract.connect(keeperSigner).depositIntoExecutor(perpTE.address, BigNumber.from(1e6).mul(1e3));

		const newUSDCBal = await USDC.balanceOf(perpTE.address);

		expect(newUSDCBal.gt(oldUSDCBal));
  });

	it("TE can send funds to L2", async function () {
		const oldUSDCBal = await USDC.balanceOf(perpTE.address);

    const movrData = await moverCall(
      perpTE.address,
      invalidSigner.address,
      oldUSDCBal,
      true
    );

		const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256,address,address,bytes)"],
      [[oldUSDCBal, movrData.target, movrData.registry, movrData.data]]
    );

		await perpTE.connect(keeperSigner).initiateDeposit(paramsInBytes);

		const newUSDCBal = await USDC.balanceOf(perpTE.address);

		expect(newUSDCBal.lt(oldUSDCBal));
  });

	it("TE can initate call to open position", async function () {

		const amount = BigNumber.from(1e9).mul(1e9).mul(1e3);
		const isShort = true;
		const slippage = BigNumber.from(500);
		const gasLimit = BigNumber.from(1e6).mul(5);

		const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256,bool,uint24,uint32)"],
      [[amount, isShort, slippage, gasLimit]]
    );

		const openPositionTxn = await perpTE.connect(keeperSigner).openPosition(paramsInBytes);
		
		const paramsGenerated = await decodeOptimismChainRelayerLogs(openPositionTxn);

		
		const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: paramsGenerated.calldata});
		
		expect(txnDescription.args.isShort).equal(isShort);
		expect(txnDescription.args.slippage).equal(slippage);
		expect(amount).equal(txnDescription.args.amountIn);
		expect(txnDescription.name).equal('openPosition');
		
  });

	it("TE can initate call to close position", async function () {

		const amount = BigNumber.from(1e9).mul(1e9).mul(1e3);
		const slippage = BigNumber.from(500);
		const gasLimit = BigNumber.from(1e6).mul(5);

		const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint24,uint32)"],
      [[slippage, gasLimit]]
    );

		const closePositionTxn = await perpTE.connect(keeperSigner).closePosition(paramsInBytes);

		const paramsGenerated = await decodeOptimismChainRelayerLogs(closePositionTxn);

		
		const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: paramsGenerated.calldata});
	
		expect(txnDescription.args.slippage).equal(slippage);
		expect(txnDescription.name).equal('closePosition');


  });

	it("TE can initate call to withdraw from L2", async function () {

		const amount = BigNumber.from(1e6).mul(1e3);
		const gasLimit = BigNumber.from(1e6).mul(5);

		const movrData = await moverCall(
      invalidSigner.address,
			perpTE.address,
      amount,
      false
    );

		const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256,address,address,bytes,uint32)"],
      [[amount, movrData.target, movrData.registry, movrData.data, gasLimit]]
    );

		const withdrawTxn = await perpTE.connect(keeperSigner).initateWithdraw(paramsInBytes);
		const paramsGenerated = await decodeOptimismChainRelayerLogs(withdrawTxn);

		
		const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: paramsGenerated.calldata});

		expect(txnDescription.args.amountOut.eq(amount));
		expect(txnDescription.args.allowanceTarget).equal(movrData.target);
		expect(txnDescription.args._socketRegistry).equal(movrData.registry);
		expect(txnDescription.args.socketData).equal(movrData.data);
		expect(txnDescription.name).equal('withdraw');

  });


});

const decodeOptimismChainRelayerLogs = async function (txn: ContractTransaction) {

	const optiChainRelayerAddress = "0x5E4e65926BA27467555EB562121fac00D24E9dD2";
	const receipt = await txn.wait();

	let calldata: string;

	const optimismMessengerInterface = (await hre.ethers.getContractAt("contracts/PerpHandler/interfaces/CrossDomainMessenger.interface.sol:ICrossDomainMessenger", optimismL1CrossDomainMessenger)).interface;

	for(let log of receipt.logs) {
		if (log.address === optiChainRelayerAddress) {

			const thisLog = optimismMessengerInterface.parseLog({topics: log.topics, data: log.data}) as LogDescription;
			calldata = thisLog.args[3];
		}
	}

	const calldataWithoutSelector = hre.ethers.utils.hexDataSlice(calldata, 4);
	const params = hre.ethers.utils.AbiCoder.prototype.decode(["address", "address", "bytes", "uint256"], calldataWithoutSelector);
	
	return {
		target: params[0],
		sender: params[1],
		calldata: params[2],
		nonce: params[3]
	}
}

const equal = async function (a, b, reason?) {
  expect(a).equals(b, reason);
};
