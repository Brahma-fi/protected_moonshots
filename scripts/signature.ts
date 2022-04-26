import hre from "hardhat";
import { getSignature } from "../test/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const main = (async () => {
  let signer = (await hre.ethers.getSigners())[0];
  console.log(signer.address);
  let output = await getSignature(
    "0x6b29610D6c6a9E47812bE40F1335918bd63321bf",
    signer,
    "0x9eBBccCcBfe01047dab8Ef07fAc3e4dBaD444dAC"
  );
  console.log(output);
})();
