---
description: The vault Contract
---

# Vault - Documentation

- **Contract Name:** Vault.sol
- **Type/Category:** Core Module
- [**Contract Source**](../contracts/Vault.sol)
- [**Etherscan**](https://etherscan.io/address/)

## 1. Introduction

The `Vault` is designed to issue tokens proportional to amount of funds the user deposits. It's meant to issue new tokens or burn existing tokens only when all the fund values are updated. `Vault` uses `TradeExecutor` contracts to invest the user funds in various protocols. The funds of mainnet `TradeExecutor` are updated on a block by block basis. While those interact with other L2 protocols, the funds are updated by keeper in order to process deposits/withdrawals.

## 2. Contract Details

**- Key Functionalities**

- `deposit` - Mint to new vault tokens representing user's share of funds.

- `withdraw` - Burn the vault tokens and transfer the amount to user's wallet.

- `depositIntoExecutor` - Deposits funds into the executor contract to be used for making trades on protocol

- `withdrawFromExecutor` - Withdraw funds from executor in order to process user withdrawal request.

- `collectFees` - Calims the fees from the yield generated on user funds to governance.

## 3. Roles

| Role Name  | Access                               | Description                                                                                                |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role | Allows to add/remove new `TradeExecutors` on `vault` . Update any new addresses on `batcher` and `keeper`. |
| Keeper     | Mutable by _Governance_ role         | Main operation is move funds across the current `TradeExecutors` on `vault`.                               |

## 4. Mechanisms & Concepts

The `vault` contract is responsible for issuing erc20 tokens representing user share based on the total funds it holds. The `vault` also keeps the track of funds invested in trade executors. So trade executor funds should be updated before processing any deposits or withdrawals. vault computes the yield it generated between different harvest cycles to process the fees. `Keeper` maintains the list of `TradeExecutors` and `batcher` makes sure there is always enough collateral on `vault` to process any user withdrawals.

## 5. Gotchas

When trade executor funds are updated incorrectly the users might be issued incorrect amount of tokens. This can be prevented by updating the trade executor funds before processing the deposit and simulating the txn on new update.

## 6. Failure Modes

- In case of emergency the deposits/withdrawals are disabled by taking the `vault` in emergency mode with `setEmergencyMode` function.
- All the funds from will be recalled from `TradeExecutors` to `vault` to reduce attack impact.
- Only `Governance` can enable back the deposits/withdrawals after emergency.

## 7. Trust Assumptions

We assume that for `TradeExecutors` that move funds to L2 protocols, their funds are updated correctly by `Keeper` as they aren't available solutions to update the state of l2 contract funds. We are exploring solutions with layerZero and anyswap call for this to prevent centralization risk.
