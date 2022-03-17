// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../../interfaces/BasePositionHandler.sol";
import "./interfaces/IConvexRewards.sol";
import "./interfaces/IConvexBooster.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/ICurveDepositZapper.sol";
import "./interfaces/IHarvester.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "hardhat/console.sol";
/// @title Convexhandler
/// @notice Used to control the long position handler interacting with Convex
contract ConvexPositionHandler is BasePositionHandler {
  using SafeERC20 for IERC20;

  enum UST3PoolCoinIndexes {
    UST,
    DAI,
    USDC,
    USDT
  }

  struct AmountParams {
    uint256 _amount;
  }

  uint256 public immutable MAX_BPS = 10000;
  uint256 public maxSlippage = 30;

  IERC20 public wantToken;
  IERC20 public lpToken;

  IHarvester public harvester;

  // 0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A
  IConvexRewards public baseRewardPool;
  // 0xCEAF7747579696A2F0bb206a14210e3c9e6fB269
  ICurvePool public ust3Pool;
  // 0xA79828DF1850E8a3A3064576f380D90aECDD3359
  ICurveDepositZapper public curve3PoolZap;
  // 0xF403C135812408BFbE8713b5A23a04b3D48AAE31
  IConvexBooster public convexBooster;

  function _initHandler(
    address _baseRewardPool,
    address _convexBooster,
    address _ust3Pool,
    address _curve3PoolZap,
    address _token,
    address _harvester
  ) internal {
    baseRewardPool = IConvexRewards(_baseRewardPool);
    convexBooster = IConvexBooster(_convexBooster);

    ust3Pool = ICurvePool(_ust3Pool);
    curve3PoolZap = ICurveDepositZapper(_curve3PoolZap);

    wantToken = IERC20(_token);
    lpToken = IERC20(_ust3Pool);

    harvester = IHarvester(_harvester);
    lpToken.safeApprove(address(convexBooster), type(uint256).max);

  }

  /// @notice To get the total balances of the contract in want token price
  function positionInWantToken()
    public
    view
    override
    returns (uint256, uint256)
  {
    (
      uint256 stakedLpBalance,
      uint256 lpTokenBalance,
      uint256 usdcBalance
    ) = _getTotalBalancesInWantToken();

    return (stakedLpBalance + lpTokenBalance + usdcBalance, block.number);
  }

  /// @notice To deposit into the ConvexHandler
  /// @dev Pulls USDC lp tokens into ConvexHandler
  /// @param _data Encoded AmountParams as _data
  function _deposit(bytes calldata _data) internal override {
    AmountParams memory depositParams = abi.decode(_data, (AmountParams));
    require(
      depositParams._amount <= wantToken.balanceOf(address(this)),
      "invalid deposit amount"
    );

    _convertUSDCIntoLpToken(depositParams._amount);
  }

  /// @notice To use ConvexHandler balance to open position on Convex
  /// @dev stakes the specified into Convex's UST3-Wormhole pool
  /// @param _data Encoded AmountParams as _data
  function _openPosition(bytes calldata _data) internal override {
    AmountParams memory openPositionParams = abi.decode(_data, (AmountParams));

    require(
      openPositionParams._amount <= lpToken.balanceOf(address(this)),
      "insufficient balance"
    );

    require(
      convexBooster.deposit(
        baseRewardPool.pid(),
        openPositionParams._amount,
        true
      ),
      "convex staking failed"
    );
  }

  /// @notice To close Convex position
  /// @dev Unstakes and claims the required portion from Convex position
  /// @param _data Encoded AmountParams as _data
  function _closePosition(bytes calldata _data) internal override {
    AmountParams memory closePositionParams = abi.decode(_data, (AmountParams));

    require(
      closePositionParams._amount <= baseRewardPool.balanceOf(address(this)),
      "LongPositionHandler :: close amount"
    );

    /// Unstake _amount and claim rewards from convex
    /// Unstake entire balance if closePositionParams._amount is 0
      baseRewardPool.withdrawAndUnwrap(closePositionParams._amount, true);
  }

  /// @notice To withdraw from ConvexHandler
  /// @dev Finds max amount that can be withdrawn, unstake position or convert lp balance to withdraw
  /// @param _data Encoded WithdrawParams as _data
  function _withdraw(bytes calldata _data) internal override {
    // _amount here is the maxWithdraw
    AmountParams memory withdrawParams = abi.decode(_data, (AmountParams));
    (
      uint256 stakedLpBalance,
      uint256 lpTokenBalance,
      uint256 usdcBalance
    ) = _getTotalBalancesInWantToken();

    console.log("stakedLpBalance", stakedLpBalance);
    console.log("lpTokenBalance", lpTokenBalance);
    console.log("usdcBalance", usdcBalance);

    require(
      withdrawParams._amount <=
        (stakedLpBalance + lpTokenBalance + usdcBalance),
      "amount requested exceeds limit"
    );

    // calculate maximum amount that can be withdrawn
    uint256 amountToWithdraw = withdrawParams._amount;
    console.log("amountToWithdraw", amountToWithdraw);
    uint256 usdcValueOfLpTokensToConvert = 0;

    // if usdc token balance is insufficient
    if (amountToWithdraw > usdcBalance) {
      usdcValueOfLpTokensToConvert = amountToWithdraw - usdcBalance;

        if (usdcValueOfLpTokensToConvert > lpTokenBalance) {
          uint256 amountToUnstake = usdcValueOfLpTokensToConvert - lpTokenBalance;
          console.log(
            "usdcValueOfLpTokensToConvert",
            usdcValueOfLpTokensToConvert
          );
          // unstake convex position partially
          uint256 lpTokensToUnstake = _USDCValueInLpToken(amountToUnstake);
          console.log("lpTokensToUnstake", lpTokensToUnstake);
          require(
            baseRewardPool.withdrawAndUnwrap(lpTokensToUnstake, true),
            "could not unstake"
          );
      }
    }

    // usdcValueOfLpTokensToConvert's value converted to Lp Tokens
    uint256 lpTokensToConvert = _USDCValueInLpToken(
      usdcValueOfLpTokensToConvert
    );
    console.log("lpTokensToConvert", lpTokensToConvert);
    // if lp tokens are required to convert, then convert to usdc and update amountToWithdraw
    if (lpTokensToConvert > 0) {
      uint256 usdcReceivedAfterConversion = _convertLpTokenIntoUSDC(
        lpTokensToConvert
      );
      console.log("usdcReceivedAfterConversion", usdcReceivedAfterConversion);
      uint256 slippage  = (usdcValueOfLpTokensToConvert - usdcReceivedAfterConversion )*100000/usdcValueOfLpTokensToConvert; 
      console.log("slippage",slippage);

    }
  }

  //TODO: need to add fee part here.
  /// @notice To claim rewards from Convex position
  /// @dev Claims Convex position rewards, and converts them to wantToken
  /// @param _data is not needed here (empty param)
  function _claimRewards(bytes calldata _data) internal override {
    require(baseRewardPool.getReward(), "reward claim failed");

    // get list of tokens to transfer to harvester
    IERC20[3] memory rewardTokens = [
      harvester.crv(),
      harvester.cvx(),
      harvester._3crv()
    ];
    //transfer them
    uint256 balance;
    for (uint256 i = 0; i < rewardTokens.length; i++) {
      balance = rewardTokens[i].balanceOf(address(this));

      if (balance > 0) {
        rewardTokens[i].safeTransfer(address(harvester), balance);
      }
    }

    // convert all rewards to usdc
    harvester.harvest();
  }

  /// @notice To get total contract balances in terms of lp tokens
  /// @dev Gets lp token balance from contract and from staked position on convex, and converts usdc balance of contract to lp tokens.
  function _getTotalBalancesInWantToken()
    internal
    view
    returns (
      uint256 stakedLpBalance,
      uint256 lpTokenBalance,
      uint256 usdcBalance
    )
  {
    stakedLpBalance = _lpTokenValueInUSDC(
      baseRewardPool.balanceOf(address(this))
    );
    lpTokenBalance = _lpTokenValueInUSDC(lpToken.balanceOf(address(this)));
    usdcBalance = wantToken.balanceOf(address(this));
  }

  /// @notice Helper to convert Lp tokens into USDC
  /// @dev Burns LpTokens on UST3-Wormhole pool on curve to get USDC
  /// @param _amount amount of Lp tokens to burn to get USDC
  function _convertLpTokenIntoUSDC(uint256 _amount)
    internal
    returns (uint256 receivedWantTokens)
  {
    lpToken.safeApprove(address(curve3PoolZap), _amount);

    int128 usdcIndexInPool = int128(int256(uint256(UST3PoolCoinIndexes.USDC)));

    // estimate amount of USDC received on burning Lp tokens
    uint256 expectedWantTokensOut = curve3PoolZap.calc_withdraw_one_coin(
      address(ust3Pool),
      _amount,
      usdcIndexInPool
    );
    // burn Lp tokens to receive USDC with a slippage of `maxSlippage`
    receivedWantTokens = curve3PoolZap.remove_liquidity_one_coin(
      address(ust3Pool),
      _amount,
      usdcIndexInPool,
      (expectedWantTokensOut * (MAX_BPS - maxSlippage)) / (MAX_BPS)
    );

    uint256 minTokens =   (expectedWantTokensOut * (MAX_BPS - maxSlippage)) / (MAX_BPS);
    console.log("receivedWantTokens", receivedWantTokens);
    console.log("minTokensOfUSDC", minTokens);
  }

  /// @notice Helper to convert USDC into Lp tokens
  /// @dev Provides USDC liquidity on UST3-Wormhole pool on curve to get Lp Tokens
  /// @param _amount amount of USDC to deposit to get Lp Tokens
  function _convertUSDCIntoLpToken(uint256 _amount)
    internal
    returns (uint256 receivedLpTokens)
  {
    uint256[4] memory liquidityAmounts = [0, 0, _amount, 0];

    wantToken.safeApprove(address(curve3PoolZap), _amount);

    // estimate amount of Lp Tokens received on depositing USDC
    uint256 expectedLpOut = curve3PoolZap.calc_token_amount(
      address(ust3Pool),
      liquidityAmounts,
      true
    );
    // Provide USDC liquidity to receive Lp tokens with a slippage of `maxSlippage`
    receivedLpTokens = curve3PoolZap.add_liquidity(
      address(ust3Pool),
      liquidityAmounts,
      (expectedLpOut * (MAX_BPS - maxSlippage)) / (MAX_BPS)
    );
    uint256 minTokens =   (expectedLpOut * (MAX_BPS - maxSlippage)) / (MAX_BPS);
    console.log("receivedLpTokens", receivedLpTokens);
    console.log("minTokens", minTokens);
  }

  /// @notice to get value of an amount in USDC
  /// @param _value value to be converted
  function _lpTokenValueInUSDC(uint256 _value) internal view returns (uint256) {
    return
      curve3PoolZap.calc_withdraw_one_coin(
        address(ust3Pool),
        _value,
        int128(int256(uint256(UST3PoolCoinIndexes.USDC)))
      );
  }

  /// @notice to get value of an amount in Lp Tokens
  /// @param _value value to be converted
  function _USDCValueInLpToken(uint256 _value) internal view returns (uint256) {
    return
      curve3PoolZap.calc_token_amount(
        address(ust3Pool),
        [0, 0, _value, 0],
        true
      );
  }

  /// @notice Keeper function to set max accepted slippage of swaps
  /// @param _slippage Max accepted slippage during harvesting
  function _setSlippage(uint256 _slippage) internal {
    maxSlippage = _slippage;
  }



}
