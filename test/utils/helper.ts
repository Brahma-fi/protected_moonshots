import { BigNumber, utils } from "ethers";

export function randomBN(upper: BigNumber): BigNumber {
  const out = BigNumber.from(utils.randomBytes(32)).mod(upper);
  if (out.gt(0)) return out;
  return randomBN(upper);
}
