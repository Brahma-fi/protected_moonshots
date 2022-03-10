// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../../interfaces/BasePositionHandler.sol";
import "./interfaces/IConvexRewards.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/ICurveDepositZapper.sol";
import "./interfaces/IHarvester.sol";

import "../../library/Math.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

  struct WithdrawParams {
    uint256 _maxWithdraw;
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

  function _initHandler(
    address _baseRewardPool,
    address _ust3Pool,
    address _curve3PoolZap,
    address _token,
    address _lpToken,
    address _harvester
  ) internal {
    baseRewardPool = IConvexRewards(_baseRewardPool);
    ust3Pool = ICurvePool(_ust3Pool);
    curve3PoolZap = ICurveDepositZapper(_curve3PoolZap);

    wantToken = IERC20(_token);
    lpToken = IERC20(_lpToken);

    harvester = IHarvester(_harvester);
  }

  /// @notice Governance function to approve tokens to harvester for swaps
  /// @param tokens An array of token addresses to approve
  function _approveRewardTokensToHarvester(address[] memory tokens) internal {
    for (uint256 idx = 0; idx < tokens.length; idx++) {
      IERC20(tokens[idx]).safeApprove(address(harvester), type(uint256).max);
    }
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

    return (
      _normaliseDecimals(
        (stakedLpBalance + lpTokenBalance + usdcBalance),
        false
      ),
      block.number
    );
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
      lpToken.balanceOf(address(this)) >= openPositionParams._amount,
      "insufficient balance"
    );
    require(
      baseRewardPool.stake(openPositionParams._amount),
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
    if (closePositionParams._amount == 0) {
      baseRewardPool.withdrawAll(true);
    } else {
      baseRewardPool.withdraw(closePositionParams._amount, true);
    }
  }

  /// @notice To withdraw from ConvexHandler
  /// @dev Finds max amount that can be withdrawn, unstake position or convert lp balance to withdraw
  /// @param _data Encoded WithdrawParams as _data
  function _withdraw(bytes calldata _data) internal override {
    // _amount here is the maxWithdraw
    WithdrawParams memory withdrawParams = abi.decode(_data, (WithdrawParams));
    (
      uint256 stakedLpBalance,
      uint256 lpTokenBalance,
      uint256 usdcBalance
    ) = _getTotalBalancesInWantToken();

    // calculate maximum amount that can be withdrawn
    uint256 amountToWithdraw = Math.min(
      _normaliseDecimals(withdrawParams._maxWithdraw, true),
      (stakedLpBalance + lpTokenBalance + usdcBalance)
    );

    // if usdc token balance is insufficient
    if (amountToWithdraw > usdcBalance) {
      // unstake convex position partially
      if (stakedLpBalance > 0) {
        uint256 lpTokensToUnstake = _USDCValueInLpToken(
          (amountToWithdraw - lpTokenBalance - usdcBalance),
          18,
          true
        );

        require(
          baseRewardPool.withdraw(lpTokensToUnstake, true),
          "could not unstake"
        );
      }
    }

    uint256 lpTokensToConvert = _USDCValueInLpToken(
      (amountToWithdraw - usdcBalance),
      18,
      true
    );

    // if lp tokens are required to convert, then convert to usdc and update amountToWithdraw
    if (lpTokensToConvert > 0) {
      uint256 usdcReceivedAfterConversion = _convertLpTokenIntoUSDC(
        lpTokensToConvert
      );
      amountToWithdraw = usdcBalance + usdcReceivedAfterConversion;
    }
  }

  //TODO: need to add fee part here.
  /// @notice To claim rewards from Convex position
  /// @dev Claims Convex position rewards, and converts them to wantToken
  /// @param _data is not needed here (empty param)
  function _claimRewards(bytes calldata _data) internal override {
    require(baseRewardPool.getReward(), "reward claim failed");
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
      baseRewardPool.balanceOf(address(this)),
      18
    );
    lpTokenBalance = _lpTokenValueInUSDC(lpToken.balanceOf(address(this)), 18);
    usdcBalance = _normaliseDecimals(wantToken.balanceOf(address(this)), true);
  }

  /// @notice Helper to convert Lp tokens into USDC
  /// @dev Burns LpTokens on UST3-Wormhole pool on curve to get USDC
  /// @param _amount amount of Lp tokens to burn to get USDC
  function _convertLpTokenIntoUSDC(uint256 _amount)
    internal
    returns (uint256 receivedWantTokens)
  {
    lpToken.safeApprove(address(ust3Pool), _amount);

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

    wantToken.safeApprove(address(ust3Pool), _amount);

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

  /// @notice price of lpToken in wantToken
  function _UST3WCRVPrice() internal view returns (uint256) {
    return ust3Pool.get_virtual_price();
  }

  /// @notice to get value of an amount in USDC
  /// @param _value value to be converted
  /// @param _decimals the output decimals
  function _lpTokenValueInUSDC(uint256 _value, uint256 _decimals)
    internal
    view
    returns (uint256)
  {
    return
      (((_value * _UST3WCRVPrice()) / 10**_decimals) / 1e18) * 10**_decimals;
  }

  /// @notice to get value of an amount in Lp Tokens
  /// @param _value value to be converted
  /// @param _decimals the output decimals
  /// @param _is18Decimals True if input is 1e18, else false
  function _USDCValueInLpToken(
    uint256 _value,
    uint256 _decimals,
    bool _is18Decimals
  ) internal view returns (uint256) {
    return
      ((_is18Decimals ? _value : _normaliseDecimals(_value, false)) *
        10**_decimals) / _UST3WCRVPrice();
  }

  /// @notice helper to normalise decimals
  /// @param _value value to normalise
  /// @param _direction True -> 6 decimals to 18 decimals ; False -> 18 decimals -> 6 decimals
  function _normaliseDecimals(uint256 _value, bool _direction)
    internal
    pure
    returns (uint256)
  {
    return (_value * (_direction ? 1e18 : 1e6)) / (_direction ? 1e6 : 1e18);
  }
}
