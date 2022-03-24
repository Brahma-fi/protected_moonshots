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
import { BigNumber, Signer } from "ethers";
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

const hauler = "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e";
const USDCWhale = "0x500A746c9a44f68Fe6AA86a92e7B3AF4F322Ae66";

const optimismMessengerInterface = new hre.ethers.utils.Interface([
	"event SentMessage(bytes message)",
	"event RelayedMessage(bytes32 msgHash)",
	"event FailedRelayedMessage(bytes32 msgHash)",
	"event TransactionEnqueued(address _l1TxOrigin, address _target, uint256 _gasLimit, bytes _data, uint256 _queueIndex, uint256 _timestamp)"

])

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

    // const baseTokenContract = (await hre.ethers.getContractAt(
    //   "IIndexPrice",
    //   baseToken
    // )) as IIndexPrice;
    // clearingHouseConfigContract = (await hre.ethers.getContractAt(
    //   "IClearingHouseConfig",
    //   clearingHouseConfig
    // )) as IClearingHouseConfig;
    // const twapInterval = await clearingHouseConfigContract.getTwapInterval();
    // accountBalanceContract = (await hre.ethers.getContractAt(
    //   "IAccountBalance",
    //   accountBalance
    // )) as IAccountBalance;
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
		const receipt = await openPositionTxn.wait();
		let calldata: string;



		// for(let log of receipt.logs) {
		// 	// if (log.address === optimismL1CrossDomainMessenger) {
		// 		const thisLog = optimismMessengerInterface.parseLog({topics: log.topics, data: log.data});

		// 		console.log(thisLog);
		// 	// }
		// }



		const PerpHandlerL2Contract = await hre.ethers.getContractAt("PerpPositionHandlerL2", invalidSigner.address);
		// const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: calldata});
		


  });

	it("TE can initate call to close position", async function () {

		const amount = BigNumber.from(1e9).mul(1e9).mul(1e3);
		const slippage = BigNumber.from(500);
		const gasLimit = BigNumber.from(1e6).mul(5);

		const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint256,uint24,uint32)"],
      [[amount, slippage, gasLimit]]
    );

		const closePositionTxn = await perpTE.connect(keeperSigner).closePosition(paramsInBytes);
		const receipt = await closePositionTxn.wait();
		let calldata: string;


		
		// for(let log of receipt.logs) {
		// 	// if (log.address === optimismL1CrossDomainMessenger) {
		// 		const thisLog = optimismMessengerInterface.parseLog({topics: log.topics, data: log.data});

		// 		console.log(thisLog);
		// 	// }
		// }



		const PerpHandlerL2Contract = await hre.ethers.getContractAt("PerpPositionHandlerL2", invalidSigner.address);
		// const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: calldata});
		


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
		const receipt = await withdrawTxn.wait();
		let calldata: string;


		
		// for(let log of receipt.logs) {
		// 	// if (log.address === optimismL1CrossDomainMessenger) {
		// 		const thisLog = optimismMessengerInterface.parseLog({topics: log.topics, data: log.data});

		// 		console.log(thisLog);
		// 	// }
		// }



		const PerpHandlerL2Contract = await hre.ethers.getContractAt("PerpPositionHandlerL2", invalidSigner.address);
		// const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({data: calldata});
		


  });


});

const equal = async function (a, b, reason?) {
  expect(a).equals(b, reason);
};
