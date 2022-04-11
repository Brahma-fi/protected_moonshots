---
description: The ConvexTradeExecutor Contract
---

# ConvexTradeExecutor - Detailed Documentation

- **Contract Name:** ConvexTradeExecutor.sol
- **Type/Category:** Core Module
- [**Associated Diagram**]()
- [**Contract Source**](../contracts/ConvexTradeExecutor.sol)
- [**Etherscan**](https://etherscan.io/address/0x3167b932336b029bBFE1964E435889FA8e595738)

## 1. Introduction

The `ConvexTradeExecutor` is a contract to execute strategy's trade, on Convex. The `Vault` deposits to and withdraws funds in USDC, which is then converted to Curve LP tokens which are converted and staked on convex, to accrue rewards and earn yield.

## 2. Contract Details

**- Key Functionalities**

- `initiateDeposit` - Converts the want tokens sent by vault into Curve LP (UST3 Metapool) tokens.

- `initiateWithdraw` - Prepares enough want token balance in the contract by unstaking/converting LP Tokens if needed, for the vault to pull.

- `openPosition` - Opens a staking position on Convex with Curve LP (UST3 Metapool) tokens.

- `closePosition` - Unstakes and withdraws from the current Convex staked position.

- `claimRewards` - Claims the rewards accrued in the open staked position on Convex, and harvests these rewards into Want Token.

## 3. Roles

| Role Name  | Access                                            | Description                                                                                                                                       |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role (from Vault) | To modify the contract's base state and call `sweep` to sweep funds.                                                                              |
| Keeper     | Mutable by _Governance_ role (from Vault)         | To perform all the main operations like `setSlippage`, `initiateDeposit`, `initiateWithdraw`, `openPosition`, `closePosition` and `claimRewards`. |

## 4. Mechanisms & Concepts

The `ConvexTradeExecutor` is responsible for executing the strategy's trade, on Convex. It accepts deposits from `Vault` in `wantToken` and converts this into Curve LP (UST3 Metapool) Tokens, which are converted to Convex Curve LP Tokens and staked on Convex. It also claims rewards from the Convex staked position, and harvests these into `wantToken`s. At the final stage, it prepares enough `wantToken`s, by either unstaking from position or converting LP Tokens, for the `Vault` to pull.

## 5. Gotchas

During swaps, the estimated amounts may temporarily be considerably different from the actual received amounts. In a case where this estimate is much higher than the actual amount, it can cause a failure during swap, due to insufficient slippage.

## 6. Failure Modes

- In case of emergency, `Governance` can sweep funds from the contract to retrieve them.
