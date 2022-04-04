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
The `Hauler` contract is the main place where user deposit/withdraw their funds. `Hauler` is responsible for managing funds on various protocols using `TradeExecutor` contract. User are issued an erc20 token representing their share for amount of funds deposited.

## 2. Contract Details
**- Key Functionalities**

* `deposit` - Mint to new hauler tokens representing user's share of funds.

* `withdraw` - Burn the hauler tokens and transfer the amount to user's wallet.

* `depositIntoExecutor` - Deposits funds into the executor contract to be used for making trades on protocol

* `withdrawFromExecutor` - Withdraw funds from executor in order to process user withdrawal request. 

* `claimFees` - Calims the fees from the yield generated on user funds to governance.

## 3. Roles
| Role Name          | Access                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                          |
|--------------------|------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Governance   |  Mutable by current *Governance* role                          | Allows to add/remove new `TradeExecutors` on `Hauler` . Update any new addresses on `batcher` and `keeper`.                                                                                                                                                                                                                                 |
| Keeper | Mutable by *Governance* role | Main operation is move funds across the current `TradeExecutors` on `Hauler`. Also used for `claimingFees` for `Governance` during harvest cycles.  |


## 4. Mechanisms & Concepts
The `Hauler` contract is responsible for mainly issuing erc20 tokens representing user share based on the total funds it holds. The `Hauler` also keeps the track of funds invested in trade executors. So trade executor funds should be updated before processing any deposits or withdrawals. Hauler computes the yield it generated between different harvest cycles to process the fees. `Keeper` maintains the list of `TradeExecutors` and `batcher` makes sure there is always enough collateral on `Hauler` to process any user withdrawals.  

## 5. Gotchas 
When trade executor funds are updated incorrectly the depositers might be issued incorrect amount of tokens. This can be prevented by updating the trade executor funds before processing the deposit and simulating the txn on new update.

## 6. Failure Modes 
* In case of emergency the deposits/withdrawals are disabled by modifying the `batcher` address via `Governance`.
* All the funds from will be recalled from `TradeExecutors` to `Hauler` to reduce attack impact.
* Only `Governance` can enable back the deposits/withdrawals after emergency.
 
