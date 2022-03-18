import { ethers } from "hardhat";

const getDepositBytes = async () => {
  const hauler = await ethers.getContractAt(
    "Hauler",
    "0x1C4ceb52ab54a35F9d03FcC156a7c57F965e081e"
  );
  const usdc = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  );

  const usdcBal = await usdc.balanceOf(hauler.address);
  console.log("Hauler USDC bal:", usdcBal.toString());
  const paramsInBytes = ethers.utils.AbiCoder.prototype.encode(
    ["tuple(uint256)"],
    [[usdcBal.div(2)]]
  );

  return paramsInBytes;
};

(async () => {
  console.log("Deposit bytes:", await getDepositBytes());
})();
