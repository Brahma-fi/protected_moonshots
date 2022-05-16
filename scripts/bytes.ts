import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { convexTradeExecutorAddress, vaultAddress } from "./constants";
const getDepositBytes = async () => {
  const convexTE = await ethers.getContractAt(
    "ConvexTradeExecutor",
    convexTradeExecutorAddress
  );
  const vault = await ethers.getContractAt("Vault", vaultAddress);
  const usdc = await ethers.getContractAt(
    "ERC20",
    "0xceaf7747579696a2f0bb206a14210e3c9e6fb269"
  );

  // let usdcBal = await usdc.balanceOf(convexTE.address);
  let usdcBal = 500000 * 1e6;
  // console.log("Vault USDC bal:", usdcBal.toString());
  const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[usdcBal]]
  );

  return paramsInBytes;
};

(async () => {
  console.log("Deposit bytes:", await getDepositBytes());
})();
