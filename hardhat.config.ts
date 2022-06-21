import * as dotenv from "dotenv";
import { HardhatNetworkForkingUserConfig } from "hardhat/types";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import { readFileSync } from "fs";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const FORK_OPTIMISM = process.env.FORK_OPTIMISM || "0";

const buildForkConfig = (): HardhatNetworkForkingUserConfig => {
  let forkMode: HardhatNetworkForkingUserConfig;
  if (FORK_OPTIMISM == "1") {
    forkMode = {
      url: process.env.QUICKNODE_OPTIMISM_URL,
      blockNumber: Number(process.env.OPTIMISM_BLOCK_NUMBER),
    };
  } else {
    forkMode = {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      blockNumber: 15003356,
    };
  }
  return forkMode;
};

const getTenderlyForkConfig = (): string => {
  let url = JSON.parse(readFileSync("tenderlyConfig.json").toString());
  // console.log(`https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`)
  return url.forkRPCUrl;

  // return `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: buildForkConfig(),
      chainId: 1,
    },
    tenderly: {
      url: getTenderlyForkConfig(),
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      timeout: 99999,
      url:
        `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}` || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    rinkeby: {
      url:
        `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}` || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    optimism: {
      url: `${process.env.QUICKNODE_OPTIMISM_URL}`,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    localhosted: {
      url: `http://127.0.0.1:8500`,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.json"],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
};

export default config;
