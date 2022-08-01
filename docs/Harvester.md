---
description: The Harvester Contract
---

# Harvester - Documentation

- **Contract Name:** Harvester.sol
- **Type/Category:** Core Module
- [**Associated Diagram**]()
- [**Contract Source**](../contracts/ConvexExecutor/Harvester.sol)
- [**Etherscan**](https://etherscan.io/address/)

## 1. Introduction

The `Harvester` is a contract to harvest rewards from Convex staking position into Want Token for the convex TE to claim rewards.

## 2. Contract Details

**- Key Functionalities**

- `harvest` - Converts all the reward tokens into the want token and returns that, and any remaining tokens back to the msg.sender

- `setSlippage` - Keeper function to set the acceptable slippage for reward harvesting

## 3. Roles

| Role Name  | Access                                            | Description                                                          |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role (from Vault) | To modify the contract's base state and call `sweep` to sweep funds. |
| Keeper     | Mutable by _Governance_ role (from Vault)         | To perform all the main operations like `setSlippage`.               |

## 4. Mechanisms & Concepts

The `Harvester` is responsible for keeping track of all the reward tokens, from a `ConvexTradeExecutor` and harvests these rewards into want tokens. The reward tokens are first sent to the `Harvester` and once it has reward token balance, it can be harvested to convert these tokens into the want token and get it sent back.

## 5. Gotchas

During swaps, the estimated amounts may temporarily be considerably different from the actual received amounts. In a case where this estimate is much higher than the actual amount, it can cause a failure during swap, due to insufficient slippage.

## 6. Failure Modes

- In case of emergency, `Governance` can sweep funds from the contract to retrieve them.
- If the curve pool is imbalanced it might to lead to +ve/-ve slippage depending to type of imbalance. So `Keeper` can change slippage to facilitate entry/exit into the pool.

## 7. Trust Assumptions

We assume that the `ConvexTradeExecutor` sends funds correctly before calling the `harvest` function.

---

# Deployment

- Pre-requisite contracts

  - All reward token contracts (external) must already be correctly deployed

- Actions after deployment
  - `setSlippage()` on harvester if slippage is needed to be > or < 0.1%
