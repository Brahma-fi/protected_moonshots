/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  BaseContract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import type { TypedEventFilter, TypedEvent, TypedListener } from "./common";

interface IVaultInterface extends ethers.utils.Interface {
  functions: {
    "acceptGovernance()": FunctionFragment;
    "apiVersion()": FunctionFragment;
    "baseRewardPool()": FunctionFragment;
    "batcher()": FunctionFragment;
    "deposit(uint256,address)": FunctionFragment;
    "depositLimit()": FunctionFragment;
    "emergencyShutdown()": FunctionFragment;
    "governance()": FunctionFragment;
    "managementFee()": FunctionFragment;
    "maxAvailableShares()": FunctionFragment;
    "pendingGovernance()": FunctionFragment;
    "performanceFee()": FunctionFragment;
    "setBatcher(address)": FunctionFragment;
    "setDepositLimit(uint256)": FunctionFragment;
    "setEmergencyShutdown(bool)": FunctionFragment;
    "setGovernance(address)": FunctionFragment;
    "setManagementFee(uint256)": FunctionFragment;
    "setPerformanceFee(uint256)": FunctionFragment;
    "token()": FunctionFragment;
    "totalAssets()": FunctionFragment;
    "ust3Pool()": FunctionFragment;
    "withdraw(uint256,address,uint256)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "acceptGovernance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "apiVersion",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "baseRewardPool",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "batcher", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "deposit",
    values: [BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "depositLimit",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "emergencyShutdown",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "governance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "managementFee",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "maxAvailableShares",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "pendingGovernance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "performanceFee",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "setBatcher", values: [string]): string;
  encodeFunctionData(
    functionFragment: "setDepositLimit",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setEmergencyShutdown",
    values: [boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "setGovernance",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "setManagementFee",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "setPerformanceFee",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "token", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "totalAssets",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "ust3Pool", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "withdraw",
    values: [BigNumberish, string, BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "acceptGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "apiVersion", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "baseRewardPool",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "batcher", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "deposit", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "depositLimit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "emergencyShutdown",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "governance", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "managementFee",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "maxAvailableShares",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "pendingGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "performanceFee",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "setBatcher", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setDepositLimit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setEmergencyShutdown",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setManagementFee",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setPerformanceFee",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "token", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "totalAssets",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "ust3Pool", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "withdraw", data: BytesLike): Result;

  events: {};
}

export class IVault extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: IVaultInterface;

  functions: {
    acceptGovernance(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    apiVersion(
      overrides?: CallOverrides
    ): Promise<[string] & { _apiVersion: string }>;

    baseRewardPool(overrides?: CallOverrides): Promise<[string]>;

    batcher(overrides?: CallOverrides): Promise<[string]>;

    deposit(
      _amount: BigNumberish,
      recepient: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    depositLimit(overrides?: CallOverrides): Promise<[BigNumber]>;

    emergencyShutdown(overrides?: CallOverrides): Promise<[boolean]>;

    governance(overrides?: CallOverrides): Promise<[string]>;

    managementFee(overrides?: CallOverrides): Promise<[BigNumber]>;

    maxAvailableShares(
      overrides?: CallOverrides
    ): Promise<[BigNumber] & { _maxAvailableShares: BigNumber }>;

    pendingGovernance(overrides?: CallOverrides): Promise<[string]>;

    performanceFee(overrides?: CallOverrides): Promise<[BigNumber]>;

    setBatcher(
      _batcher: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setDepositLimit(
      _depositLimit: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setEmergencyShutdown(
      _active: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setGovernance(
      _governance: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setManagementFee(
      _managementFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setPerformanceFee(
      _performanceFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    token(overrides?: CallOverrides): Promise<[string]>;

    totalAssets(overrides?: CallOverrides): Promise<[BigNumber]>;

    ust3Pool(overrides?: CallOverrides): Promise<[string]>;

    withdraw(
      maxShares: BigNumberish,
      recepient: string,
      maxLoss: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  acceptGovernance(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  apiVersion(overrides?: CallOverrides): Promise<string>;

  baseRewardPool(overrides?: CallOverrides): Promise<string>;

  batcher(overrides?: CallOverrides): Promise<string>;

  deposit(
    _amount: BigNumberish,
    recepient: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  depositLimit(overrides?: CallOverrides): Promise<BigNumber>;

  emergencyShutdown(overrides?: CallOverrides): Promise<boolean>;

  governance(overrides?: CallOverrides): Promise<string>;

  managementFee(overrides?: CallOverrides): Promise<BigNumber>;

  maxAvailableShares(overrides?: CallOverrides): Promise<BigNumber>;

  pendingGovernance(overrides?: CallOverrides): Promise<string>;

  performanceFee(overrides?: CallOverrides): Promise<BigNumber>;

  setBatcher(
    _batcher: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setDepositLimit(
    _depositLimit: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setEmergencyShutdown(
    _active: boolean,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setGovernance(
    _governance: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setManagementFee(
    _managementFee: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setPerformanceFee(
    _performanceFee: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  token(overrides?: CallOverrides): Promise<string>;

  totalAssets(overrides?: CallOverrides): Promise<BigNumber>;

  ust3Pool(overrides?: CallOverrides): Promise<string>;

  withdraw(
    maxShares: BigNumberish,
    recepient: string,
    maxLoss: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    acceptGovernance(overrides?: CallOverrides): Promise<void>;

    apiVersion(overrides?: CallOverrides): Promise<string>;

    baseRewardPool(overrides?: CallOverrides): Promise<string>;

    batcher(overrides?: CallOverrides): Promise<string>;

    deposit(
      _amount: BigNumberish,
      recepient: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    depositLimit(overrides?: CallOverrides): Promise<BigNumber>;

    emergencyShutdown(overrides?: CallOverrides): Promise<boolean>;

    governance(overrides?: CallOverrides): Promise<string>;

    managementFee(overrides?: CallOverrides): Promise<BigNumber>;

    maxAvailableShares(overrides?: CallOverrides): Promise<BigNumber>;

    pendingGovernance(overrides?: CallOverrides): Promise<string>;

    performanceFee(overrides?: CallOverrides): Promise<BigNumber>;

    setBatcher(_batcher: string, overrides?: CallOverrides): Promise<void>;

    setDepositLimit(
      _depositLimit: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setEmergencyShutdown(
      _active: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    setGovernance(
      _governance: string,
      overrides?: CallOverrides
    ): Promise<void>;

    setManagementFee(
      _managementFee: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    setPerformanceFee(
      _performanceFee: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    token(overrides?: CallOverrides): Promise<string>;

    totalAssets(overrides?: CallOverrides): Promise<BigNumber>;

    ust3Pool(overrides?: CallOverrides): Promise<string>;

    withdraw(
      maxShares: BigNumberish,
      recepient: string,
      maxLoss: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    acceptGovernance(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    apiVersion(overrides?: CallOverrides): Promise<BigNumber>;

    baseRewardPool(overrides?: CallOverrides): Promise<BigNumber>;

    batcher(overrides?: CallOverrides): Promise<BigNumber>;

    deposit(
      _amount: BigNumberish,
      recepient: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    depositLimit(overrides?: CallOverrides): Promise<BigNumber>;

    emergencyShutdown(overrides?: CallOverrides): Promise<BigNumber>;

    governance(overrides?: CallOverrides): Promise<BigNumber>;

    managementFee(overrides?: CallOverrides): Promise<BigNumber>;

    maxAvailableShares(overrides?: CallOverrides): Promise<BigNumber>;

    pendingGovernance(overrides?: CallOverrides): Promise<BigNumber>;

    performanceFee(overrides?: CallOverrides): Promise<BigNumber>;

    setBatcher(
      _batcher: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setDepositLimit(
      _depositLimit: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setEmergencyShutdown(
      _active: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setGovernance(
      _governance: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setManagementFee(
      _managementFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setPerformanceFee(
      _performanceFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    token(overrides?: CallOverrides): Promise<BigNumber>;

    totalAssets(overrides?: CallOverrides): Promise<BigNumber>;

    ust3Pool(overrides?: CallOverrides): Promise<BigNumber>;

    withdraw(
      maxShares: BigNumberish,
      recepient: string,
      maxLoss: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    acceptGovernance(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    apiVersion(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    baseRewardPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    batcher(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    deposit(
      _amount: BigNumberish,
      recepient: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    depositLimit(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    emergencyShutdown(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    governance(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    managementFee(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    maxAvailableShares(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    pendingGovernance(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    performanceFee(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    setBatcher(
      _batcher: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setDepositLimit(
      _depositLimit: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setEmergencyShutdown(
      _active: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setGovernance(
      _governance: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setManagementFee(
      _managementFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setPerformanceFee(
      _performanceFee: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    token(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    totalAssets(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    ust3Pool(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    withdraw(
      maxShares: BigNumberish,
      recepient: string,
      maxLoss: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
