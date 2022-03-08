// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../../interfaces/BasePositionHandler.sol";
import "./interfaces/IConvexRewards.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/IHarvester.sol";

import "../../library/Math.sol";

import "./../solmate/ERC20.sol";
import "../solmate/SafeTransferLib.sol";

/// @title Convexhandler
/// @notice Used to control the long position handler interacting with Convex
contract ConvexPositionHandler is BasePositionHandler {
  using SafeTransferLib for ERC20;

  enum UST3PoolCoinIndexes {
    DAI,
    USDC,
    USDT
  }

  struct AmountParams {
    uint256 _amount;
  }

  struct WithdrawParams {
    uint256 _maxWithdraw;
    address _recipient;
  }

  uint256 public immutable MAX_BPS = 10000;
  uint256 public maxSlippage = 30;

  address public governance;
  address public keeper;

  ERC20 public wantToken;
  ERC20 public lpToken;

  IHarvester public harvester;

  // 0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A
  IConvexRewards public baseRewardPool;
  // 0x890f4e345B1dAED0367A877a1612f86A1f86985f
  ICurvePool public ust3Pool;

  function _initHandler(
    address _baseRewardPool,
    address _ust3Pool,
    address _token,
    address _lpToken,
    address _harvester,
    address _governance,
    address _keeper
  ) internal {
    baseRewardPool = IConvexRewards(_baseRewardPool);
    ust3Pool = ICurvePool(_ust3Pool);

    wantToken = ERC20(_token);
    lpToken = ERC20(_lpToken);

    harvester = IHarvester(_harvester);

    governance = _governance;
    keeper = _keeper;
  }

  /// @notice Governance function to approve tokens to harvester for swaps
  /// @param tokens An array of token addresses to approve
  function approveRewardTokensToHarvester(address[] memory tokens)
    external
    onlyGovernance
  {
    for (uint256 idx = 0; idx < tokens.length; idx++) {
      ERC20(tokens[idx]).safeApprove(address(harvester), type(uint256).max);
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
    require(depositParams._amount > 0, "invalid deposit amount");

    wantToken.safeTransferFrom(
      msg.sender,
      address(this),
      depositParams._amount
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
        uint256 lpTokensToUnstake = (amountToWithdraw -
          lpTokenBalance -
          usdcBalance) / _UST3WCRVPrice();

        require(
          baseRewardPool.withdraw(lpTokensToUnstake, true),
          "could not unstake"
        );
      }
    }

    uint256 lpTokensToConvert = (amountToWithdraw - usdcBalance) /
      _UST3WCRVPrice();

    // if lp tokens are required to convert, then convert to usdc and update amountToWithdraw
    if (lpTokensToConvert > 0) {
      uint256 usdcReceivedAfterConversion = _convertLpTokenIntoUSDC(
        lpTokensToConvert
      );
      amountToWithdraw = usdcBalance + usdcReceivedAfterConversion;
    }

    // transfer lp tokens to recipient
    wantToken.safeTransfer(
      withdrawParams._recipient,
      _normaliseDecimals(amountToWithdraw, false)
    );
  }

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
    stakedLpBalance =
      baseRewardPool.balanceOf(address(this)) *
      _UST3WCRVPrice();
    lpTokenBalance = lpToken.balanceOf(address(this)) * _UST3WCRVPrice();
    usdcBalance = _normaliseDecimals(wantToken.balanceOf(address(this)), true);
  }

  function _convertLpTokenIntoUSDC(uint256 _amount)
    internal
    returns (uint256 receivedLpTokens)
  {
    lpToken.safeApprove(address(ust3Pool), _amount);

    receivedLpTokens = ust3Pool.remove_liquidity_one_coin(
      _amount,
      int128(int256(uint256(UST3PoolCoinIndexes.USDC))),
      ((_amount * _UST3WCRVPrice()) * (MAX_BPS - maxSlippage)) / (MAX_BPS)
    );
  }

  function _convertUSDCIntoLpToken(uint256 _amount)
    internal
    returns (uint256 receivedWantTokens)
  {
    uint256[3] memory liquidityAmounts = [_amount, 0, 0];

    wantToken.safeApprove(address(ust3Pool), _amount);

    receivedWantTokens = ust3Pool.add_liquidity(
      liquidityAmounts,
      ((_amount / _UST3WCRVPrice()) * (MAX_BPS - maxSlippage)) / (MAX_BPS)
    );
  }

  /// @notice price of lpToken in wantToken
  function _UST3WCRVPrice() internal view returns (uint256) {
    return ust3Pool.get_virtual_price();
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

  modifier onlyGovernance() {
    require(msg.sender == governance, "access :: Governance");
    _;
  }

  modifier onlyKeeper() {
    require(msg.sender == keeper, "access :: Keeper");
    _;
  }
}
