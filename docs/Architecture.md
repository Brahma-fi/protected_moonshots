## Introduction

Brahma represents a suite of sustainable open-sourced products that make yield composable alpha and drives capital efficiency in the DeFi ecosystem. As a first step towards this goal, we started with the protected moonshot vault. This valult is built around the idea that users can get leveraged yield from their investments, while still having their prinicpal protected. In order to achieve this brahma has made use of following protocols:

1. Convex pool for getting rewards on `USDC` deposit made by user.
2. Perp V2 for taking leveraged position using harvested yield.

## Trade Anatomy

The trade for delta neutral strategy looks as follows. Let’s say a user deposited 1000 USDC into the vault. Here is how the position looks like.

- **Position opening:** Lets say the user deposited 1000 USDC into the vault.
  1000 USDC -> deposited on curve to get lp tokens and staked on convex rewards.
  After a week the rewards are harvested. Let's say it was 10 USDC.<br>
  10 USDC -> this is yield is bridged to optimism to take a leveraged position on perp.
  <br>
- **Position closing:**
  In order to settle withdrawals requested by user. The vault holds around 1-10% funds as buffer in vault. If the requested amount is more than buffer amount.  
  Unstake → the equivalent request amount from convex. Transfer the funds to vault and withdraw.

## Summary

The above functionality is achieved by the `Batcher`, `Vault`, `ConvexTradeExecutor` and `PerpTradeExecutor` contracts. Where Batcher, Vault contracts mainly handle the user deposit/withdrawls. ConvexTradeExecutor and PerpTradeExecutor handles the position taken on respective protocols.

## Protected MoonShot Smart Contract Modules

![alt text](./images/architecture_diagram.svg)

## Contracts

- `Batcher`: Batcher contract main function is batch multiple user deposits so its cheaper for user to deposit/withdraw. The current implementation helps us integrate karma check so users who pass karma check can deposit/withdraw. Users deposit/withdraw into vault through this contract.
- `Vault`: Vault contract is the main contract user funds are managed across different protocols using their respective trade executors. Vault can add/remove trade executors depending on strategy. Vault also manages funds across different trade executors.
- `ConvexTradeExecutor`: ConvexTradeExecutor is the contract that handles the position taken on convex protocol.
- `PerpTradeExecutor`: PerpTradeExecutor is the contract that handles the position taken on perp protocol.

## Decentralization

Governance holds the authority to add or remove trade executors depending on changes to strategy. In case of perp trade executor the position value is set by keeper which is managed by protocol. While we understand this is a centralization risk. It can only impact the yield part invested in perp so severity should be less. We have plans to further decentralize this when support cross chain orcales is added between optimism and eth mainnet.
