import { ethers } from "hardhat";

const getDepositBytes = async () => {
  const convexTE = await ethers.getContractAt(
    "ConvexTradeExecutor",
    "0x3167b932336b029bBFE1964E435889FA8e595738"
  );
  const usdc = await ethers.getContractAt(
    "ERC20",
    "0xceaf7747579696a2f0bb206a14210e3c9e6fb269"
  );

  const usdcBal = await usdc.balanceOf(convexTE.address);
  console.log("Vault USDC bal:", usdcBal.toString());
  const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[usdcBal]]
  );

  return paramsInBytes;
};

(async () => {
  console.log("Deposit bytes:", await getDepositBytes());
})();
