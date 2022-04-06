# Brahma

This repository contains the smart contracts source code and configuration for Brahma Vaults. The repository uses Hardhat as development environment for compilation, testing and deployment tasks. The repository mainly hosts the source file for protected moonshot vault. 

## What is Protected MoonShot Vault?
The Protected Moonshot DegenVault aims to achieve to hold stables but still take leveraged positions to maximise the base yield.


## Structure
[contracts](./contracts): Contains all the source code of contracts used for protected moonshot vault. <br>
[docs](./docs): Contains all the documentation related core contracts.

## Connect with the community

You can join at the [Discord](https://discord.gg/brahma) channel for asking questions about the protocol or talk about new defi strategies.

## Setup

You can install `hardhat` as an NPM package to get started with contracts. Setup an `.env` as shown in [.env_example](./env_example). 
You can run the full test suite with the following commands:

```
# In one terminal
npx hardhat test 
```