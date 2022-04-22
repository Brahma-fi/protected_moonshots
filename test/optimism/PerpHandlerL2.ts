import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Vault,
  IERC20,
  PerpPositionHandlerL2,
  IAccountBalance,
} from "../../src/types";
import { BigNumber } from "ethers";
import {
  wantTokenL1,
  wantTokenL2,
  perpVault,
  clearingHouse,
  clearingHouseConfig,
  accountBalance,
  exchange,
  baseToken,
  quoteTokenvUSDC,
  movrRegistry,
} from "../../scripts/constants";

import { moverCall } from "../api";

describe("PerpHandlerL2 [OPTIMISM]", function () {
  let signer: SignerWithAddress;
  let invalidSigner: SignerWithAddress;

  let perpL2Handler: PerpPositionHandlerL2;
  let USDC: IERC20;

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

    const PerpHandlerL2 = await hre.ethers.getContractFactory(
      "PerpPositionHandlerL2",
      invalidSigner
    );
    perpL2Handler = (await PerpHandlerL2.deploy(
      wantTokenL1,
      wantTokenL2,
      invalidSigner.address,
      perpVault,
      clearingHouse,
      clearingHouseConfig,
      accountBalance,
      exchange,
      baseToken,
      quoteTokenvUSDC,
      signer.address,
      movrRegistry
    )) as PerpPositionHandlerL2;

    await perpL2Handler.deployed();

    USDC = (await hre.ethers.getContractAt("ERC20", wantTokenL2)) as IERC20;
    await USDC.connect(invalidSigner).transfer(
      perpL2Handler.address,
      await USDC.balanceOf(invalidSigner.address)
    );

    accountBalanceContract = (await hre.ethers.getContractAt(
      "IAccountBalance",
      accountBalance
    )) as IAccountBalance;
  });

  // Operation - Expected Behaviour
  // initalized -  Exepcting contract to be initalized properly with some USDC for testing
  it("Contract initialized correctly", async function () {
    expect(await perpL2Handler.keeper()).equals(signer.address);

    const usdcBal = await USDC.balanceOf(perpL2Handler.address);

    expect(usdcBal.gt(0));
  });

  // Operation - Expected Behaviour
  // openPosition - Open new short position on Perp, set PerpPostion variable isActive as true
  //              - Should only work if sent using Keeper address
  //              - Perp's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if PerpPosition is already active
  it("Can open short", async function () {
    let usdcBal = BigNumber.from(100e6);
    // let usdcBal = await USDC.balanceOf(perpL2Handler.address);
    usdcBal = usdcBal.mul(1e12);

    equal((await perpL2Handler.perpPosition()).isActive, false);

    equal(
      await accountBalanceContract.getTotalPositionSize(
        perpL2Handler.address,
        baseToken
      ),
      0
    );
    await perpL2Handler.connect(signer).openPosition(true, usdcBal, 500);

    equal((await perpL2Handler.perpPosition()).isActive, true);
    equal((await perpL2Handler.perpPosition()).isShort, true);

    expect(
      !(
        await accountBalanceContract.getTotalPositionSize(
          perpL2Handler.address,
          baseToken
        )
      ).isZero()
    );
  });

  // Operation - Expected Behaviour
  // closePosition - Close existing position on Perp, set PerpPostion variable isActive as false
  //              - Should only work if sent using Keeper address
  //              - Perp's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if PerpPosition is already inactive
  it("Can close short", async function () {
    let usdcBalBefore = await USDC.balanceOf(perpL2Handler.address);

    equal((await perpL2Handler.perpPosition()).isActive, true);
    await perpL2Handler.connect(signer).closePosition(1500);
    equal((await perpL2Handler.perpPosition()).isActive, false);
    expect(
      (
        await accountBalanceContract.getTotalPositionSize(
          perpL2Handler.address,
          baseToken
        )
      ).isZero()
    );

    let usdcBalAfter = await USDC.balanceOf(perpL2Handler.address);

    expect(usdcBalAfter.gt(usdcBalBefore));
  });

  // Operation - Expected Behaviour
  // openPosition - Should fail as trying to call using non Keeper address
  it("Open position only works with keeper", async function () {
    let usdcBal = await USDC.balanceOf(perpL2Handler.address);
    usdcBal = usdcBal.mul(1e12);
    await expect(
      perpL2Handler.connect(invalidSigner).openPosition(true, usdcBal, 500)
    ).to.be.revertedWith("ONLY_AUTHORIZED");
  });

  // Operation - Expected Behaviour
  // closePosition - Should fail as trying to call using non Keeper address
  it("Close position only works with keeper", async function () {
    let usdcBal = await USDC.balanceOf(perpL2Handler.address);
    usdcBal = usdcBal.mul(1e12);
    await expect(
      perpL2Handler.connect(invalidSigner).closePosition(500)
    ).to.be.revertedWith("ONLY_AUTHORIZED");
  });

  // Operation - Expected Behaviour
  // openPosition - Open new long position on Perp, set PerpPostion variable isActive as true
  //              - Should only work if sent using Keeper address
  //              - Perp's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if PerpPosition is already active
  it("Can open long", async function () {
    let usdcBal = BigNumber.from(100e6);
    // let usdcBal = await USDC.balanceOf(perpL2Handler.address);
    usdcBal = usdcBal.mul(1e12);

    equal((await perpL2Handler.perpPosition()).isActive, false);

    equal(
      await accountBalanceContract.getTotalPositionSize(
        perpL2Handler.address,
        baseToken
      ),
      0
    );
    await perpL2Handler.connect(signer).openPosition(false, usdcBal, 500);

    equal((await perpL2Handler.perpPosition()).isActive, true);
    equal((await perpL2Handler.perpPosition()).isShort, false);

    expect(
      !(
        await accountBalanceContract.getTotalPositionSize(
          perpL2Handler.address,
          baseToken
        )
      ).isZero()
    );
  });

  // Operation - Expected Behaviour
  // closePosition - Close existing position on Perp, set PerpPostion variable isActive as false
  //              - Should only work if sent using Keeper address
  //              - Perp's accountBalance contract should reflect change in positionValue of our contract
  //              - Shouldnt work if PerpPosition is already inactive
  it("Can close long", async function () {
    let usdcBalBefore = await USDC.balanceOf(perpL2Handler.address);

    equal((await perpL2Handler.perpPosition()).isActive, true);
    await perpL2Handler.connect(signer).closePosition(1500);
    equal((await perpL2Handler.perpPosition()).isActive, false);
    expect(
      (
        await accountBalanceContract.getTotalPositionSize(
          perpL2Handler.address,
          baseToken
        )
      ).isZero()
    );

    let usdcBalAfter = await USDC.balanceOf(perpL2Handler.address);

    expect(usdcBalAfter.gt(usdcBalBefore));
  });

  // Operation - Expected Behaviour
  // withdraw - Expected contract to have USDC balance. Should call socket to bridge funds from L2 to L1
  //              - Should only work if sent using Keeper address
  //              - USDC balance should change reflectng call succeeded in test environment
  //              - Should validate that socketRegistry same as one stored in contract state
  //              - Should validate that socketCalldata contains correct params for amountOut, destination chain id and destination address
  it("Can withdraw successfully", async function () {
    let usdcBalBefore = await USDC.balanceOf(perpL2Handler.address);

    const movrData = await moverCall(
      perpL2Handler.address,
      invalidSigner.address,
      usdcBalBefore,
      false
    );

    await expect(
      perpL2Handler
        .connect(signer)
        .withdraw(
          usdcBalBefore,
          movrData.target,
          movrData.target,
          movrData.data
        )
    ).to.be.revertedWith("INVALID_REGISTRY");
    await expect(
      perpL2Handler
        .connect(invalidSigner)
        .withdraw(
          usdcBalBefore,
          movrData.target,
          movrData.registry,
          movrData.data
        )
    ).to.be.revertedWith("ONLY_AUTHORIZED");

    await perpL2Handler
      .connect(signer)
      .withdraw(
        usdcBalBefore,
        movrData.target,
        movrData.registry,
        movrData.data
      );
    let usdcBalAfter = await USDC.balanceOf(perpL2Handler.address);

    expect(usdcBalAfter.lt(usdcBalBefore));
  });
});

const equal = async function (a, b, reason?) {
  expect(a).equals(b, reason);
};
