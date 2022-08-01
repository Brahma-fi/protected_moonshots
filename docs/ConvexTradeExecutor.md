---
description: The ConvexTradeExecutor Contract
---

# ConvexTradeExecutor - Documentation

- **Contract Name:** ConvexTradeExecutor.sol
- **Type/Category:** Core Module
- [**Associated Diagram**]()
- [**Contract Source**](../contracts/ConvexTradeExecutor.sol)
- [**Etherscan**](https://etherscan.io/address/0x3167b932336b029bBFE1964E435889FA8e595738)

## 1. Introduction

The `ConvexTradeExecutor` is a contract to execute strategy's trade, on Convex. The `Vault` deposits to and withdraws funds in USDC, which is then converted to Curve LP tokens which are converted and staked on convex, to accrue rewards and earn yield.

## 2. Contract Details

**- Key Functionalities**

- `initiateDeposit` - Converts the want tokens sent by vault into Curve LP tokens by depositing into Curve Pool.

- `initiateWithdraw` - Prepares enough want token balance in the contract by unstaking/converting LP Tokens if needed, for the vault to pull.

- `openPosition` - Opens a staking position on Convex with Curve LP tokens.

- `closePosition` - Unstakes and withdraws from the current Convex staked position.

- `claimRewards` - Claims the rewards accrued in the open staked position on Convex. Harvests these rewards into wantToken. This also claims any yield generated from price changes in Curve LP tokens, and burns them for Want Tokens.

## 3. Roles

| Role Name  | Access                                            | Description                                                                                                                                       |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role (from Vault) | To modify the contract's base state and call `sweep` to sweep funds.                                                                              |
| Keeper     | Mutable by _Governance_ role (from Vault)         | To perform all the main operations like `setSlippage`, `initiateDeposit`, `initiateWithdraw`, `openPosition`, `closePosition` and `claimRewards`. |

## 4. Mechanisms & Concepts

The `ConvexTradeExecutor` is responsible for executing the strategy's trade, on Convex. It accepts deposits from `Vault` in `wantToken` and converts this into Curve LP Tokens, which are converted to Convex Curve LP Tokens and staked on Convex. It also claims rewards from the Convex staked position and from the Curve's LP token's price, and harvests these into `wantToken`s. At the final stage, it prepares enough `wantToken`s, by either unstaking from position or converting LP Tokens, for the `Vault` to pull.

## 5. Gotchas

During swaps, the estimated amounts may temporarily be considerably different from the actual received amounts. In a case where this estimate is much higher than the actual amount, it can cause a failure during swap, due to insufficient slippage.

## 6. Failure Modes

- In case of emergency, `Governance` can sweep funds from the contract to retrieve them.
- If the curve pool is imbalanced it might to lead to +ve/-ve slippage depending to type of imbalance. So `Governance` can change slippage to facilitate entry/exit into the pool.

## 7. Trust Assumptions

We assume that the `Vault` will send and pull out funds from vault during deposit and withdraw respectively. `Keeper` ensures that enough funds are maintained in the contract for `Vault` to pull.

---

# Deployment

- Pre-requisite contracts

  - Vault.sol
  - Harvester.sol

- Actions after deployment
  - `setSlippage()` on harvester if slippage is needed to be > or < 0.1%
  - `setUseVirtualPriceForPosValue()` if position value calculation is required to be done using virtual price instead of simulated calculations.
  - `addExecutor()` on Vault, to add newly deployed convex TE to vault.
