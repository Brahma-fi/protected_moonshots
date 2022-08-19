import { expect } from "chai";
import * as dotenv from "dotenv";
import { ethers } from "hardhat";
import { Harvester } from "../../src/types";
import { randomSigner, switchToNetwork } from "../utils";

const HarvesterConfig = {
  vaultAddress: "0x3c4Fe0db16c9b521480c43856ba3196A9fa50E08",
};

const ExpectedHarvesterState = {
  crv: "0xD533a949740bb3306d119CC777fa900bA034cd52",
  cvx: "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B",
  snx: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
  _3crv: "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490",
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  crvEthPool: "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511",
  cvxEthPool: "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4",
  _3crvPool: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
  uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  crvEthPrice: "0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e",
  cvxEthPrice: "0xC9CbF687f43176B302F03f5e58470b77D07c61c6",
  snxUsdPrice: "0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699",
  ethUsdPrice: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  slippage: 0.01,
  wethSwapFee: 500,
  snxSwapFee: 1e4,
  maxBps: 1e4,
};

let harvester: Harvester;

describe("Harvester [MAINNET]", () => {
  before(async () => {
    dotenv.config();
    await switchToNetwork(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      Number(process.env.BLOCK_NUMBER)
    );

    const signer = await randomSigner();

    const HarvesterFactory = await ethers.getContractFactory("Harvester");
    harvester = (await HarvesterFactory.connect(signer).deploy(
      ...Object.values(HarvesterConfig)
    )) as Harvester;
  });

  it("is harvester deployed correctly", async () => {
    expect(await harvester.MAX_BPS()).equal(ExpectedHarvesterState.maxBps);
    expect(await harvester.WETH_SWAP_FEE()).equal(
      ExpectedHarvesterState.wethSwapFee
    );
    expect(await harvester.SNX_SWAP_FEE()).equal(
      ExpectedHarvesterState.snxSwapFee
    );

    const slippage =
      parseFloat((await harvester.maxSlippage()).toString()) /
      parseFloat((await harvester.MAX_BPS()).toString());
    expect(slippage).equal(ExpectedHarvesterState.slippage);

    expect(await harvester.crv()).equal(ExpectedHarvesterState.crv);
    expect(await harvester.cvx()).equal(ExpectedHarvesterState.cvx);
    expect(await harvester.snx()).equal(ExpectedHarvesterState.snx);
    expect(await harvester.weth()).equal(ExpectedHarvesterState.weth);
    expect(await harvester._3crv()).equal(ExpectedHarvesterState._3crv);

    expect(await harvester.crveth()).equal(ExpectedHarvesterState.crvEthPool);
    expect(await harvester.cvxeth()).equal(ExpectedHarvesterState.cvxEthPool);
    expect(await harvester._3crvPool()).equal(ExpectedHarvesterState._3crvPool);

    expect(await harvester.uniswapRouter()).equal(
      ExpectedHarvesterState.uniswapRouter
    );

    expect(await harvester.crvEthPrice()).equal(
      ExpectedHarvesterState.crvEthPrice
    );
    expect(await harvester.cvxEthPrice()).equal(
      ExpectedHarvesterState.cvxEthPrice
    );
    expect(await harvester.snxUsdPrice()).equal(
      ExpectedHarvesterState.snxUsdPrice
    );
    expect(await harvester.ethUsdPrice()).equal(
      ExpectedHarvesterState.ethUsdPrice
    );
  });
});
