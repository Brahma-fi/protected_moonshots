---
description: The PerpTradeExecutor Contract
---

# PerpTradeExecutor - Detailed Documentation

- **Contract Name:** PerpTradeExecutor.sol
- **Type/Category:** Core Module
- [**Associated Diagram**]()
- [**Contract Source**](../contracts/PerpTradeExecutor.sol)
- [**Etherscan**](https://etherscan.io/address/0x3167b932336b029bBFE1964E435889FA8e595738)

## 1. Introduction

THe `PerpTradeExecutor` is handler contract for `PerpHandler` on L2. The `Vault` deposits to and withdraws funds in USDC, which is then sent to `PerpHandler` on L2. `PerpHandler` then opens long or short according to strategy instructions.

## 2. Contract Details

**- Key Functionalities**

- `initiateDeposit` - Sends USDC to `PerpHandler` on L2 using Socket

- `initiateWithdraw` - Sends a txn to `PerpHandler` on L2 via Optimism Gateway instructing the contract to send USDC back to `PerpTradeExecutor` using Socket
- `openPosition` - Sends a txn to `PerpHandler` on L2 via Optimism Gateway instructing the contract to deposit USDC balance on Perp open a position (long/short)

- `closePosition` - Sends a txn to `PerpHandler` on L2 via Optimism Gateway instructing the contract to close existing position on Perp and withdraw all USDC balance



## 3. Roles

| Role Name  | Access                                            | Description                                                                                                                                       |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role (from Vault) | To modify the contract's base state and call `sweep` to sweep funds.                                                                              |
| Keeper     | Mutable by _Governance_ role (from Vault)         | To perform all the main operations like `setSlippage`, `initiateDeposit`, `initiateWithdraw`, `openPosition`, `closePosition`, `setPosValue` and `setSocketRegistry`. |

## 4. Mechanisms & Concepts

The `PerpTradeExecutor` is responsible for communicating with a `PerpHandler` contract on optimism L2. It accepts deposits from `Vault` in `wantToken` and sends it to the L2 `PerpHandler` contract. It also uses Optimism Gateway to send txns to `PerpHandler` to instruct it in performing tasks such as opening / closing positions on PerpV2 as well as sending `wantToken` back to L1 `PerpTradeExecutor`
## 5. Gotchas

When sending `wantToken` to L2 using Socket, `PerpTradeExecutor` will decode and verify calldata. It will check the address where txn is to be sent and match against stored address. If Socket changes the address, it needs to be updated on `PerpTradeExecutor`. 


## 6. Failure Modes

- In case of emergency, `Governance` can sweep funds from the contract to retrieve them.
- In case of Optimism Gateway not working, `Keeper` can send txns directly to L2
