---
description: The Batcher Contract
---

# Batcher - Detailed Documentation

- **Contract Name:** Batcher.sol
- **Type/Category:** Core Module
- [**Associated Diagram**]()
- [**Contract Source**](../contracts/Batcher/Batcher.sol)
- [**Etherscan**](https://etherscan.io/address/)

## 1. Introduction

The `Batcher` contract is the contract where user deposit/withdraw their funds. `Vault` has their deposit and withdraw functions locked by access modifier `onlyBatcher`. `Batcher` contract relays user's deposits and withdraws to the `Vault`

## 2. Contract Details

**- Key Functionalities**

- `depositFunds` - Accept user's `wantTokens` and store state reflecting their pending wantTokens to be deposited to the `Vault`. Verifies an EIP 712 signature signed by `verificationAuthority` containing the user address depositing as msg.sender to ensure user has permissions to deposit

- `depositFundsInCurveLpToken` - Accept user's `CurveLPTokens`, swap them into `wantTokens` and store state reflecting their pending wantTokens to be deposited to the `Vault`

- `withdrawFunds` - Accept user's request to withdraw `wantToken`. Also accept user's vault LP tokens if they dont have enough tokens stored in `Batcher`

- `batchDeposit` - Deposits funds into the `vault` contract and holds LP tokens received on behalf of user

- `batchWithdraw` - Withdraw funds from `vault` and distributes it to users

- `claimTokens` - Allows user to claim LP tokens that `Batcher` held on their behalf. Completely optional for the user to facilitate composability.

## 3. Roles

| Role Name  | Access                               | Description                                                                                         |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Governance | Mutable by current _Governance_ role | Allows to set new `verificationAuthority` on `Batcher` . Allows to sweep ERC20 in case of emergency |
| Keeper     | Fetched from `Vault`                 | Main operation is to perform operations like `batchDeposit`, `batchWithdraw` and `setVaultLimit`    |

## 4. Mechanisms & Concepts

The `Batcher` contract is responsible for gatekeeping vault and allowing whitelisted users to deposit and withdraw from the vault. The `Batcher` also holds and manages LP tokens on behalf of the user. Users can claim these LP tokens if they want to.

## 5. Gotchas

Users can only deposit if they get a signature signed from the `verificationAuthority` containing their wallet address. This signature will be issued by Brahma backend only when the user is whitelisted to use the vault

## 6. Failure Modes

- In case of emergency the sweep can be initated via `Governance`.
