import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Vault,
  IERC20,
  PerpPositionHandlerL2,
  IClearingHouseConfig,
  IAccountBalance,
  PerpTradeExecutor,
} from "../../src/types";
import { BigNumber, ContractTransaction, Signer } from "ethers";
import {
  wantTokenL1,
  wantTokenL2,
  optimismL1CrossDomainMessenger,
  movrRegistry,
} from "../../scripts/constants";

import { moverCall } from "../api";
import { LogDescription } from "ethers/lib/utils";
import { randomSigner, getSigner } from "../utils/signers";
import {
  getWantToken,
  getVault,
  getMockTradeExecutor,
  getMockAsyncTradeExecutor,
} from "../utils/contracts";

import { mineBlocks, switchToNetwork } from "../utils/hardhat";
import { randomBN } from "../utils/helper";

const USDCWhaleAddress = "0x500A746c9a44f68Fe6AA86a92e7B3AF4F322Ae66";

describe("PerpTE [MAINNET]", function () {
  let keeper: SignerWithAddress;
  let governance: SignerWithAddress;
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;
  let vault: Vault;
  let perpTE: PerpTradeExecutor;
  let USDC: IERC20;
  let PerpHandlerL2Contract: PerpPositionHandlerL2;

  beforeEach(async () => {
    await switchToNetwork(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      parseInt(`${process.env.BLOCK_NUMBER}`)
    );

    signer = await randomSigner();
    invalidSigner = await randomSigner();
    keeper = await randomSigner();
    governance = await randomSigner();

    USDC = (await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      wantTokenL1
    )) as IERC20;

    vault = await getVault(
      USDC.address,
      keeper.address,
      governance.address,
      "Vault",
      "VLT"
    );

    const PerpTradeExecutor = await hre.ethers.getContractFactory(
      "PerpTradeExecutor",
      invalidSigner
    );
    perpTE = (await PerpTradeExecutor.deploy(
      vault.address,
      wantTokenL2,
      invalidSigner.address,
      optimismL1CrossDomainMessenger,
      movrRegistry
    )) as PerpTradeExecutor;

    await perpTE.deployed();

    // await hre.network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [USDCWhale]
    // });

    // const usdcWhaleSigner = await hre.ethers.getSigner(USDCWhale);

    let USDCWhale = await getSigner(USDCWhaleAddress);

    await USDC.connect(USDCWhale).transfer(
      vault.address,
      await USDC.balanceOf(USDCWhale.address)
    );

    PerpHandlerL2Contract = (await hre.ethers.getContractAt(
      "PerpPositionHandlerL2",
      invalidSigner.address
    )) as PerpPositionHandlerL2;

    await vault.connect(governance).addExecutor(perpTE.address);
  });

  it("Contract initialized correctly", async function () {
    equal(await vault.keeper(), await perpTE.keeper());

    equal(await vault.governance(), await perpTE.governance());
  });

  it("Vault can deposit into TE", async function () {
    const oldUSDCBal = await USDC.balanceOf(perpTE.address);

    await vault
      .connect(keeper)
      .depositIntoExecutor(perpTE.address, BigNumber.from(1e6).mul(1e3));

    const newUSDCBal = await USDC.balanceOf(perpTE.address);

    expect(newUSDCBal.gt(oldUSDCBal));
  });

  it("TE can send funds to L2", async function () {
    await vault
      .connect(keeper)
      .depositIntoExecutor(perpTE.address, BigNumber.from(1e6).mul(1e3));

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

    await perpTE.connect(keeper).initiateDeposit(paramsInBytes);

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

    const openPositionTxn = await perpTE
      .connect(keeper)
      .openPosition(paramsInBytes);

    const paramsGenerated = await decodeOptimismChainRelayerLogs(
      openPositionTxn
    );

    const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({
      data: paramsGenerated.calldata,
    });

    expect(txnDescription.args.isShort).equal(isShort);
    expect(txnDescription.args.slippage).equal(slippage);
    expect(amount).equal(txnDescription.args.amountIn);
    expect(txnDescription.name).equal("openPosition");
  });

  it("TE can initate call to close position", async function () {
    const slippage = BigNumber.from(500);
    const gasLimit = BigNumber.from(1e6).mul(5);

    const paramsInBytes = hre.ethers.utils.AbiCoder.prototype.encode(
      ["tuple(uint24,uint32)"],
      [[slippage, gasLimit]]
    );

    const closePositionTxn = await perpTE
      .connect(keeper)
      .closePosition(paramsInBytes);

    const paramsGenerated = await decodeOptimismChainRelayerLogs(
      closePositionTxn
    );

    const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({
      data: paramsGenerated.calldata,
    });

    expect(txnDescription.args.slippage).equal(slippage);
    expect(txnDescription.name).equal("closePosition");
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

    const withdrawTxn = await perpTE
      .connect(keeper)
      .initiateWithdraw(paramsInBytes);
    const paramsGenerated = await decodeOptimismChainRelayerLogs(withdrawTxn);

    const txnDescription = PerpHandlerL2Contract.interface.parseTransaction({
      data: paramsGenerated.calldata,
    });

    expect(txnDescription.args.amountOut.eq(amount));
    expect(txnDescription.args.allowanceTarget).equal(movrData.target);
    expect(txnDescription.args._socketRegistry).equal(movrData.registry);
    expect(txnDescription.args.socketData).equal(movrData.data);
    expect(txnDescription.name).equal("withdraw");
  });
});

const decodeOptimismChainRelayerLogs = async function (
  txn: ContractTransaction
) {
  const optiChainRelayerAddress = "0x5E4e65926BA27467555EB562121fac00D24E9dD2";
  const receipt = await txn.wait();

  let calldata: string;

  const optimismMessengerInterface = (
    await hre.ethers.getContractAt(
      "contracts/PerpHandler/interfaces/CrossDomainMessenger.interface.sol:ICrossDomainMessenger",
      optimismL1CrossDomainMessenger
    )
  ).interface;

  for (let log of receipt.logs) {
    if (log.address === optiChainRelayerAddress) {
      const thisLog = optimismMessengerInterface.parseLog({
        topics: log.topics,
        data: log.data,
      }) as LogDescription;
      calldata = thisLog.args[3];
    }
  }

  const calldataWithoutSelector = hre.ethers.utils.hexDataSlice(calldata, 4);
  const params = hre.ethers.utils.AbiCoder.prototype.decode(
    ["address", "address", "bytes", "uint256"],
    calldataWithoutSelector
  );

  return {
    target: params[0],
    sender: params[1],
    calldata: params[2],
    nonce: params[3],
  };
};

const equal = async function (a, b, reason?) {
  expect(a).equals(b, reason);
};
