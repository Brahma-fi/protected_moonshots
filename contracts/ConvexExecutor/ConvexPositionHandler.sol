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

/// @title Convexhandler
/// @notice Used to control the long position handler interacting with Convex
contract ConvexPositionHandler is BasePositionHandler {
  using SafeERC20 for IERC20;

  event Deposit(uint256 indexed amount, uint256 indexed blockNumber);
  event Withdraw(uint256 indexed amount, uint256 indexed blockNumber);
  event Claim(uint256 indexed amount, uint256 indexed blockNumber);

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

  function _configHandler(
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

  /// @notice To deposit into the Curve Pool
  /// @dev Converts USDC to lp tokens via Curve
  /// @param _data Encoded AmountParams as _data with USDC amount
  function _deposit(bytes calldata _data) internal override {
    AmountParams memory depositParams = abi.decode(_data, (AmountParams));
    require(
      depositParams._amount <= wantToken.balanceOf(address(this)),
      "invalid deposit amount"
    );

    _convertUSDCIntoLpToken(depositParams._amount);

    emit Deposit(depositParams._amount, block.number);
  }

  /// @notice To open staking position in Convex
  /// @dev stakes the specified Curve Lp Tokens into Convex's UST3-Wormhole pool
  /// @param _data Encoded AmountParams as _data with LP Token amount
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

  /// @notice To close Convex Staking Position
  /// @dev Unstakes from Convex position and gives back them as Curve Lp Tokens along with rewards like CRV, CVX.
  /// @param _data Encoded AmountParams as _data with LP token amount
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
  /// @dev  Converts Curve Lp Tokens  back to USDC.
  /// @param _data Encoded WithdrawParams as _data with USDC token amount
  function _withdraw(bytes calldata _data) internal override {
    // _amount here is the maxWithdraw
    AmountParams memory withdrawParams = abi.decode(_data, (AmountParams));
    (
      uint256 stakedLpBalance,
      uint256 lpTokenBalance,
      uint256 usdcBalance
    ) = _getTotalBalancesInWantToken();

    require(
      withdrawParams._amount <=
        (stakedLpBalance + lpTokenBalance + usdcBalance),
      "amount requested exceeds limit"
    );

    // calculate maximum amount that can be withdrawn
    uint256 amountToWithdraw = withdrawParams._amount;
    uint256 usdcValueOfLpTokensToConvert = 0;

    // if usdc token balance is insufficient
    if (amountToWithdraw > usdcBalance) {
      usdcValueOfLpTokensToConvert = amountToWithdraw - usdcBalance;

      if (usdcValueOfLpTokensToConvert > lpTokenBalance) {
        uint256 amountToUnstake = usdcValueOfLpTokensToConvert - lpTokenBalance;
        // unstake convex position partially
        uint256 lpTokensToUnstake = _USDCValueInLpToken(amountToUnstake);
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
    // if lp tokens are required to convert, then convert to usdc and update amountToWithdraw
    if (lpTokensToConvert > 0) {
      _convertLpTokenIntoUSDC(lpTokensToConvert);
    }

    emit Withdraw(withdrawParams._amount, block.number);
  }

  /// @notice To claim rewards from Convex Staking position
  /// @dev Claims Convex Staking position rewards, and converts them to wantToken i.e., USDC.
  /// @param _data is not needed here (empty param)
  function _claimRewards(bytes calldata _data) internal override {
    require(baseRewardPool.getReward(), "reward claim failed");

    uint256 initialUSDCBalance = wantToken.balanceOf(address(this));

    // get list of tokens to transfer to harvester
    address[] memory rewardTokens = harvester.rewardTokens();
    //transfer them
    uint256 balance;
    for (uint256 i = 0; i < rewardTokens.length; i++) {
      balance = IERC20(rewardTokens[i]).balanceOf(address(this));

      if (balance > 0) {
        IERC20(rewardTokens[i]).safeTransfer(address(harvester), balance);
      }
    }

    // convert all rewards to usdc
    harvester.harvest();

    emit Claim(
      wantToken.balanceOf(address(this)) - initialUSDCBalance,
      block.number
    );
  }

  /// @notice To get total contract balances in terms of want token
  /// @dev Gets lp token balance from contract, staked position on convex, and converts all of them to usdc. And gives balance as want token.
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
  }

  /// @notice to get value of an amount in USDC
  /// @param _value value to be converted
  function _lpTokenValueInUSDC(uint256 _value) internal view returns (uint256) {
    if (_value == 0) return 0;

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
    if (_value == 0) return 0;

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
