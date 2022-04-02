---
description: The Hauler Contract
---

# Hauler - Detailed Documentation

* **Contract Name:** Hauler.sol
* **Type/Category:** Core Module
* [**Associated Diagram**]()
* [**Contract Source**](../contracts/Hauler.sol)
* [**Etherscan**](https://etherscan.io/address/)

## 1. Introduction
The `Hauler` contract is the main place where user deposit/withdraw their funds. `Hauler` can deploy to funds to various protocols using `TradeExecutor` contract. User are issued an erc20 token representing their share for amount of funds deposited.


## 2. Contract Details
**- Key Functionalities**

* `deposit` - Mint to new hauler tokens representing user's share of funds.

* `withdraw` - Burn the hauler tokens and transfer the amount to user's wallet.

* `depositIntoExecutor` - Deposits funds into the executor contract to be used for making trades on protocol

* `withdrawFromExecutor` - Withdraw funds from executor in order to process user withdrawal request. 

* `claimFees` - Calims the fees from the yield generated on user funds.


## 3. Mechanisms & Concepts
The Hauler processes the deposits and withdrawals by keeping track of funds invested in trade executors. So trade executor funds should be updated before processing any deposits or withdrawals. Hauler computes the yield it generated between different harvest cycles to process the fees.  

## 4. Gotchas 

When trade executor funds are updated incorrectly the depositers might be issued incorrect amount of tokens. This can be fixed by updating the trade executor funds before processing the deposit.

## 5. Failure Modes 

* As a safety mechanism new deposits/withdrawals can be disabled by modifying the `batcher` address in `Hauler` contract.
 
