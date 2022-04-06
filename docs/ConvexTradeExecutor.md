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

THe `ConvexTradeExecutor` is the long position handler. The `Hauler` deposits to and withdraws funds in USDC, which is then converted to Curve LP tokens which are converted and staked on convex, to accrue rewards and earn yield.

## 2. Contract Details

**- Key Functionalities**

- `initiateDeposit` - Converts the want tokens sent by hauler into Curve LP (UST3 Metapool) tokens.

- `initiateWithdraw` - Prepares enough want token balance in the contract by unstaking/converting LP Tokens if needed, for the hauler to pull.

- `openPosition` - Opens a long position on Convex by staking Curve LP (UST3 Metapool) tokens.

- `closePosition` - Unstakes and withdraws from the current Convex staked position.

- `claimRewards` - Claims the rewards accrued in the open staked position on Convex, and harvests these rewards into Want Token.

## 3. Roles

| Role Name  | Access                                             | Description                                                                                                                                       |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role (from Hauler) | To modify the contract's base state and call `sweep` to sweep funds.                                                                              |
| Keeper     | Mutable by _Governance_ role (from Hauler)         | To perform all the main operations like `setSlippage`, `initiateDeposit`, `initiateWithdraw`, `openPosition`, `closePosition` and `claimRewards`. |

## 4. Mechanisms & Concepts

The `ConvexTradeExecutor` is responsible for handling the long position of the strategy. It accepts deposits from `Hauler` in `wantToken` and converts this into Curve LP (UST3 Metapool) Tokens, which are converted to Convex Curve LP Tokens and staked on Convex. It also claims rewards from the Convex staked position, and harvests these into `wantToken`s. At the final stage, it prepares enough `wantToken`s, by either unstaking from position or converting LP Tokens, for the `Hauler` to pull.

## 5. Gotchas

During swaps, the estimated amounts may temporarily be considerably different from the actual received amounts. In a case where this estimate is much higher than the actual amount, it can cause a failure during swap, due to insufficient slippage.

## 6. Failure Modes

- In case of emergency, `Governance` can sweep funds from the contract to retrieve them.