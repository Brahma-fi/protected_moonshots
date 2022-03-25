import { ethers } from "hardhat";
import { IERC20, PerpTradeExecutor } from "../src/types";
import { wantTokenL1 } from "./constants";

const main = async () => {
  const pmusdc = (await ethers.getContractAt(
    "IERC20",
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e"
  )) as IERC20;
  const usdc = (await ethers.getContractAt("IERC20", wantTokenL1)) as IERC20;
  const perpTE = (await ethers.getContractAt(
    "PerpTradeExecutor",
    "0x675A5c853fc2bc81E0eB79FC45e395d01Bd5D72D"
  )) as PerpTradeExecutor;
};

main()
  .then(() => console.log("Deposited"))
  .catch((e) => console.error(e));
