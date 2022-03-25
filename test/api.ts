import axios from "axios";
import { assert } from "chai";
import { BigNumber } from "ethers";
import fetch from "node-fetch";
import { MovrQuoteSchema, MovrBuildTxnSchema } from "../scripts/apiSchema";

export async function moverCall(
  fromAddress: string,
  toAddress: string,
  amount: BigNumber,
  direction: boolean
) {
  // direction True: L1 -> L2
  // direction False: L2 -> L1
  const fromChainID = direction ? 1 : 10; // mainnet
  const toChainID = direction ? 10 : 1; // optimism

  const fromToken = direction
    ? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    : "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
  const toToken = direction
    ? "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"
    : "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const getQuoteQuery =
    "https://backend.movr.network/v1/quote?fromAsset=" +
    fromToken +
    "&fromChainId=" +
    fromChainID +
    "&toAsset=" +
    toToken +
    "&toChainId=" +
    toChainID +
    "&amount=" +
    amount +
    "&sort=cheapestRoute";

  const resObj = await fetch(getQuoteQuery);

  let res: MovrQuoteSchema = <MovrQuoteSchema>await resObj.json();
  const route = res.result.routes[0];

  const routePath = route.routePath;
  const inputAmount = route.bridgeRoute.inputAmount;
  const outputAmount = route.bridgeRoute.outputAmount;

  const buildTxnQuery =
    "https://backend.movr.network/v1/send/build-tx?recipient=" +
    toAddress +
    "&fromAsset=" +
    fromToken +
    "&fromChainId=" +
    fromChainID +
    "&toAsset=" +
    toToken +
    "&toChainId=" +
    toChainID +
    "&amount=" +
    inputAmount +
    "&output=" +
    outputAmount +
    "&fromAddress=" +
    fromAddress +
    "&routePath=" +
    routePath;

  // console.log(buildTxnQuery)
//   console.log("amount", amount.toString());

  const resTxnObj = await fetch(buildTxnQuery);
  const resTxn: MovrBuildTxnSchema = <MovrBuildTxnSchema>await resTxnObj.json();
  // console.log(resTxn);

  return {
    target: route.allowanceTarget,
    registry: resTxn.result.tx.to,
    data: resTxn.result.tx.data,
  };
}

export async function get1inchSwapData(
  from: string,
  to: string,
  amount: string,
  fromAddress: string
): Promise<string | undefined> {
  const query = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${from}&toTokenAddress=${to}&amount=${amount}&fromAddress=${fromAddress}&slippage=50&disableEstimate=true`;
  const { data, status } = await axios.get(query);

  if (status === 200) {
    // console.log(`[API] ${query}`);
    return data.tx.data;
  }

  assert(false);
}
