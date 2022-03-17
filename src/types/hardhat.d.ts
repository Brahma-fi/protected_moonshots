/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { ethers } from "ethers";
import {
  FactoryOptions,
  HardhatEthersHelpers as HardhatEthersHelpersBase,
} from "@nomiclabs/hardhat-ethers/types";

import * as Contracts from ".";

declare module "hardhat/types/runtime" {
  interface HardhatEthersHelpers extends HardhatEthersHelpersBase {
    getContractFactory(
      name: "Ownable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Ownable__factory>;
    getContractFactory(
      name: "ERC20",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ERC20__factory>;
    getContractFactory(
      name: "IERC20Metadata",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20Metadata__factory>;
    getContractFactory(
      name: "IERC20",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20__factory>;
    getContractFactory(
      name: "IAccountBalance",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IAccountBalance__factory>;
    getContractFactory(
      name: "IClearingHouse",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IClearingHouse__factory>;
    getContractFactory(
      name: "IClearingHouseConfig",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IClearingHouseConfig__factory>;
    getContractFactory(
      name: "IExchange",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IExchange__factory>;
    getContractFactory(
      name: "IOrderBook",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IOrderBook__factory>;
    getContractFactory(
      name: "IVault",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IVault__factory>;
    getContractFactory(
      name: "IVirtualToken",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IVirtualToken__factory>;
    getContractFactory(
      name: "BaseTradeExecutor",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.BaseTradeExecutor__factory>;
    getContractFactory(
      name: "Batcher",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Batcher__factory>;
    getContractFactory(
      name: "IBatcher",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBatcher__factory>;
    getContractFactory(
      name: "ConvexPositionHandler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ConvexPositionHandler__factory>;
    getContractFactory(
      name: "Harvester",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Harvester__factory>;
    getContractFactory(
      name: "IConvexBooster",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IConvexBooster__factory>;
    getContractFactory(
      name: "IConvexRewards",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IConvexRewards__factory>;
    getContractFactory(
      name: "ICurveDepositZapper",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurveDepositZapper__factory>;
    getContractFactory(
      name: "ICurvePool",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurvePool__factory>;
    getContractFactory(
      name: "ICurveV2Pool",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICurveV2Pool__factory>;
    getContractFactory(
      name: "IHarvester",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IHarvester__factory>;
    getContractFactory(
      name: "IUniswapV3Factory",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3Factory__factory>;
    getContractFactory(
      name: "IUniswapV3Router",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3Router__factory>;
    getContractFactory(
      name: "IUniswapV3SwapCallback",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUniswapV3SwapCallback__factory>;
    getContractFactory(
      name: "ConvexTradeExecutor",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ConvexTradeExecutor__factory>;
    getContractFactory(
      name: "Hauler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.Hauler__factory>;
    getContractFactory(
      name: "ICrossDomainMessenger",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICrossDomainMessenger__factory>;
    getContractFactory(
      name: "OptimismWrapper",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OptimismWrapper__factory>;
    getContractFactory(
      name: "PerpPositionHandler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.PerpPositionHandler__factory>;
    getContractFactory(
      name: "ICrossDomainMessenger",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ICrossDomainMessenger__factory>;
    getContractFactory(
      name: "IERC20",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20__factory>;
    getContractFactory(
      name: "IPositionHandler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IPositionHandler__factory>;
    getContractFactory(
      name: "OptimismL2Wrapper",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OptimismL2Wrapper__factory>;
    getContractFactory(
      name: "PerpPositionHandlerL2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.PerpPositionHandlerL2__factory>;
    getContractFactory(
      name: "PerpV2Controller",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.PerpV2Controller__factory>;
    getContractFactory(
      name: "PerpTradeExecutor",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.PerpTradeExecutor__factory>;
    getContractFactory(
      name: "BasePositionHandler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.BasePositionHandler__factory>;
    getContractFactory(
      name: "IHauler",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IHauler__factory>;
    getContractFactory(
      name: "ITradeExecutor",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ITradeExecutor__factory>;

    getContractAt(
      name: "Ownable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Ownable>;
    getContractAt(
      name: "ERC20",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ERC20>;
    getContractAt(
      name: "IERC20Metadata",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20Metadata>;
    getContractAt(
      name: "IERC20",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20>;
    getContractAt(
      name: "IAccountBalance",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IAccountBalance>;
    getContractAt(
      name: "IClearingHouse",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IClearingHouse>;
    getContractAt(
      name: "IClearingHouseConfig",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IClearingHouseConfig>;
    getContractAt(
      name: "IExchange",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IExchange>;
    getContractAt(
      name: "IOrderBook",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IOrderBook>;
    getContractAt(
      name: "IVault",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IVault>;
    getContractAt(
      name: "IVirtualToken",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IVirtualToken>;
    getContractAt(
      name: "BaseTradeExecutor",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.BaseTradeExecutor>;
    getContractAt(
      name: "Batcher",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Batcher>;
    getContractAt(
      name: "IBatcher",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBatcher>;
    getContractAt(
      name: "ConvexPositionHandler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ConvexPositionHandler>;
    getContractAt(
      name: "Harvester",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Harvester>;
    getContractAt(
      name: "IConvexBooster",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IConvexBooster>;
    getContractAt(
      name: "IConvexRewards",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IConvexRewards>;
    getContractAt(
      name: "ICurveDepositZapper",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurveDepositZapper>;
    getContractAt(
      name: "ICurvePool",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurvePool>;
    getContractAt(
      name: "ICurveV2Pool",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICurveV2Pool>;
    getContractAt(
      name: "IHarvester",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IHarvester>;
    getContractAt(
      name: "IUniswapV3Factory",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3Factory>;
    getContractAt(
      name: "IUniswapV3Router",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3Router>;
    getContractAt(
      name: "IUniswapV3SwapCallback",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUniswapV3SwapCallback>;
    getContractAt(
      name: "ConvexTradeExecutor",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ConvexTradeExecutor>;
    getContractAt(
      name: "Hauler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.Hauler>;
    getContractAt(
      name: "ICrossDomainMessenger",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICrossDomainMessenger>;
    getContractAt(
      name: "OptimismWrapper",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OptimismWrapper>;
    getContractAt(
      name: "PerpPositionHandler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.PerpPositionHandler>;
    getContractAt(
      name: "ICrossDomainMessenger",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ICrossDomainMessenger>;
    getContractAt(
      name: "IERC20",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20>;
    getContractAt(
      name: "IPositionHandler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IPositionHandler>;
    getContractAt(
      name: "OptimismL2Wrapper",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OptimismL2Wrapper>;
    getContractAt(
      name: "PerpPositionHandlerL2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.PerpPositionHandlerL2>;
    getContractAt(
      name: "PerpV2Controller",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.PerpV2Controller>;
    getContractAt(
      name: "PerpTradeExecutor",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.PerpTradeExecutor>;
    getContractAt(
      name: "BasePositionHandler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.BasePositionHandler>;
    getContractAt(
      name: "IHauler",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IHauler>;
    getContractAt(
      name: "ITradeExecutor",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ITradeExecutor>;

    // default types
    getContractFactory(
      name: string,
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<ethers.ContractFactory>;
    getContractFactory(
      abi: any[],
      bytecode: ethers.utils.BytesLike,
      signer?: ethers.Signer
    ): Promise<ethers.ContractFactory>;
    getContractAt(
      nameOrAbi: string | any[],
      address: string,
      signer?: ethers.Signer
    ): Promise<ethers.Contract>;
  }
}
