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

/// @title ConvexPositionHandler
/// @author PradeepSelva & BapireddyK;
/// @notice A Position handler to handle Convex
contract ConvexPositionHandler is BasePositionHandler {
    using SafeERC20 for IERC20;

    /*///////////////////////////////////////////////////////////////
                            ENUMS
  //////////////////////////////////////////////////////////////*/
    enum UST3PoolCoinIndexes {
        UST,
        DAI,
        USDC,
        USDT
    }

    /*///////////////////////////////////////////////////////////////
                          STRUCTS FOR DECODING
  //////////////////////////////////////////////////////////////*/
    struct AmountParams {
        uint256 _amount;
    }

    /*///////////////////////////////////////////////////////////////
                          GLOBAL IMMUTABLES
  //////////////////////////////////////////////////////////////*/
    /// @dev the max basis points used as normalizing factor.
    uint256 public immutable MAX_BPS = 10000;
    /// @dev the normalization factor for amounts
    uint256 public constant NORMALIZATION_FACTOR = 1e30;

    /*///////////////////////////////////////////////////////////////
                          GLOBAL MUTABLES
  //////////////////////////////////////////////////////////////*/
    /// @notice the max permitted slippage for swaps
    uint256 public maxSlippage = 30;
    /// @notice the latest amount of rewards claimed and harvested
    uint256 public latestHarvestedRewards;
    /// @notice the total cummulative rewards earned so far
    uint256 public totalCummulativeRewards;

    /*///////////////////////////////////////////////////////////////
                            EXTERNAL CONTRACTS
  //////////////////////////////////////////////////////////////*/
    /// @notice The want token that is deposited and withdrawn
    IERC20 public wantToken;
    /// @notice Curve LP Tokens that are converted and staked on Convex
    IERC20 public lpToken = IERC20(0xCEAF7747579696A2F0bb206a14210e3c9e6fB269);

    /// @notice Harvester that harvests rewards claimed from Convex
    IHarvester public harvester;

    /// @notice convex UST3 base reward pool
    IConvexRewards public immutable baseRewardPool =
        IConvexRewards(0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A);
    /// @notice curve's UST3 Pool
    ICurvePool public immutable ust3Pool =
        ICurvePool(0xCEAF7747579696A2F0bb206a14210e3c9e6fB269);
    /// @notice curve 3 pool zap
    ICurveDepositZapper public immutable curve3PoolZap =
        ICurveDepositZapper(0xA79828DF1850E8a3A3064576f380D90aECDD3359);
    /// @notice convex booster
    IConvexBooster public immutable convexBooster =
        IConvexBooster(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);

    /*///////////////////////////////////////////////////////////////
                          INITIALIZING
    //////////////////////////////////////////////////////////////*/
    /// @notice configures ConvexPositionHandler with the required state
    /// @param _harvester address of harvester
    /// @param _wantToken address of want token
    function _configHandler(address _harvester, address _wantToken) internal {
        wantToken = IERC20(_wantToken);
        harvester = IHarvester(_harvester);

        address UST_3POOL = 0xCEAF7747579696A2F0bb206a14210e3c9e6fB269;
        address CURVE3POOL_ZAP = 0xA79828DF1850E8a3A3064576f380D90aECDD3359;
        address CONVEX_BOOSTER = 0xF403C135812408BFbE8713b5A23a04b3D48AAE31;

        // Assign virtual price of ust3pool
        prevSharePrice = ICurvePool(UST_3POOL).get_virtual_price();

        // Approve max LP tokens to convex booster
        IERC20(UST_3POOL).safeApprove(CONVEX_BOOSTER, type(uint256).max);

        // Approve max want tokens to zapper.
        wantToken.safeApprove(CURVE3POOL_ZAP, type(uint256).max);

        // Approve max lp tokens to zapper
        IERC20(UST_3POOL).safeApprove(CURVE3POOL_ZAP, type(uint256).max);
    }

    /*///////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
  //////////////////////////////////////////////////////////////*/

    /**
   @notice To get the total balances of the contract in want token price
   @return totalBalance Total balance of contract in want token
   @return blockNumber Current block number
   */
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
        ) = _getTotalBalancesInWantToken(false);

        return (stakedLpBalance + lpTokenBalance + usdcBalance, block.number);
    }

    /*///////////////////////////////////////////////////////////////
                      DEPOSIT / WITHDRAW LOGIC
  //////////////////////////////////////////////////////////////*/

    /**
   @notice To deposit into the Curve Pool
   @dev Converts USDC to lp tokens via Curve
   @param _data Encoded AmountParams as _data with USDC amount
   */
    function _deposit(bytes calldata _data) internal override {
        AmountParams memory depositParams = abi.decode(_data, (AmountParams));
        require(
            depositParams._amount <= wantToken.balanceOf(address(this)),
            "invalid deposit amount"
        );

        _convertUSDCIntoLpToken(depositParams._amount);

        emit Deposit(depositParams._amount);
    }

    /**
   @notice To withdraw from ConvexHandler
   @dev  Converts Curve Lp Tokens  back to USDC.
   @param _data Encoded WithdrawParams as _data with USDC token amount
   */
    function _withdraw(bytes calldata _data) internal override {
        // _amount here is the maxWithdraw
        AmountParams memory withdrawParams = abi.decode(_data, (AmountParams));
        (
            uint256 stakedLpBalance,
            uint256 lpTokenBalance,
            uint256 usdcBalance
        ) = _getTotalBalancesInWantToken(true);
        uint256 totalBalance = (stakedLpBalance + lpTokenBalance + usdcBalance);

        // if _amount is more than balance, then withdraw entire balance
        if (withdrawParams._amount > totalBalance) {
            withdrawParams._amount = totalBalance;
        }

        // calculate maximum amount that can be withdrawn
        uint256 amountToWithdraw = withdrawParams._amount;
        uint256 usdcValueOfLpTokensToConvert = 0;

        // if usdc token balance is insufficient
        if (amountToWithdraw > usdcBalance) {
            usdcValueOfLpTokensToConvert = amountToWithdraw - usdcBalance;
            if (usdcValueOfLpTokensToConvert > lpTokenBalance) {
                uint256 amountToUnstake = usdcValueOfLpTokensToConvert -
                    lpTokenBalance;
                // unstake convex position partially
                uint256 lpTokensToUnstake = _USDCValueInLpToken(
                    amountToUnstake
                );
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

        emit Withdraw(withdrawParams._amount);
    }

    /*///////////////////////////////////////////////////////////////
                      OPEN / CLOSE LOGIC
  //////////////////////////////////////////////////////////////*/

    /**
   @notice To open staking position in Convex
   @dev stakes the specified Curve Lp Tokens into Convex's UST3-Wormhole pool
   @param _data Encoded AmountParams as _data with LP Token amount
   */
    function _openPosition(bytes calldata _data) internal override {
        AmountParams memory openPositionParams = abi.decode(
            _data,
            (AmountParams)
        );

        require(
            openPositionParams._amount <= lpToken.balanceOf(address(this)),
            "INSUFFICIENT_BALANCE"
        );

        require(
            convexBooster.deposit(
                baseRewardPool.pid(),
                openPositionParams._amount,
                true
            ),
            "CONVEX_STAKING_FAILED"
        );
    }

    /**
   @notice To close Convex Staking Position
   @dev Unstakes from Convex position and gives back them as Curve Lp Tokens along with rewards like CRV, CVX.
   @param _data Encoded AmountParams as _data with LP token amount
   */
    function _closePosition(bytes calldata _data) internal override {
        AmountParams memory closePositionParams = abi.decode(
            _data,
            (AmountParams)
        );

        require(
            closePositionParams._amount <=
                baseRewardPool.balanceOf(address(this)),
            "AMOUNT_EXCEEDS_BALANCE"
        );

        if (closePositionParams._amount > 0) {
            /// Unstake _amount and claim rewards from convex
            baseRewardPool.withdrawAndUnwrap(closePositionParams._amount, true);
        } else {
            /// Unstake entire balance if closePositionParams._amount is 0
            baseRewardPool.withdrawAllAndUnwrap(true);
        }
    }

    /*///////////////////////////////////////////////////////////////
                      REWARDS LOGIC
  //////////////////////////////////////////////////////////////*/
    /// @notice variable to track previous share price of LP token
    uint256 public prevSharePrice = type(uint256).max;

    /**
   @notice To claim rewards from Convex Staking position
   @dev Claims Convex Staking position rewards, and converts them to wantToken i.e., USDC.
   @param _data is not needed here (empty param, to satisfy interface)
   */
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
                IERC20(rewardTokens[i]).safeTransfer(
                    address(harvester),
                    balance
                );
            }
        }

        // convert all rewards to usdc
        harvester.harvest();

        // get curve lp rewards
        uint256 currentSharePrice = ust3Pool.get_virtual_price();
        if (currentSharePrice > prevSharePrice) {
            // claim any gain on lp token yields
            uint256 contractLpTokenBalance = lpToken.balanceOf(address(this));
            uint256 totalLpBalance = contractLpTokenBalance +
                baseRewardPool.balanceOf(address(this));
            uint256 yieldEarned = (currentSharePrice - prevSharePrice) *
                totalLpBalance;

            uint256 lpTokenEarned = yieldEarned / 1e18; // 18 decimal from virtual price

            // If lpTokenEarned is more than lpToken balance in contract, unstake the difference
            if (lpTokenEarned > contractLpTokenBalance) {
                baseRewardPool.withdrawAndUnwrap(
                    lpTokenEarned - contractLpTokenBalance,
                    true
                );
            }
            // convert lp token to usdc
            _convertLpTokenIntoUSDC(lpTokenEarned);
        }
        prevSharePrice = currentSharePrice;

        latestHarvestedRewards =
            wantToken.balanceOf(address(this)) -
            initialUSDCBalance;
        totalCummulativeRewards += latestHarvestedRewards;

        emit Claim(latestHarvestedRewards);
    }

    /*///////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
  //////////////////////////////////////////////////////////////*/

    /// @notice To get total contract balances in terms of want token
    /// @dev Gets lp token balance from contract, staked position on convex, and converts all of them to usdc. And gives balance as want token.
    /// @param useVirtualPrice to check if balances shoudl be based on virtual price
    /// @return stakedLpBalance balance of staked LP tokens in terms of want token
    /// @return lpTokenBalance balance of LP tokens in contract
    /// @return usdcBalance usdc balance in contract
    function _getTotalBalancesInWantToken(bool useVirtualPrice)
        internal
        view
        returns (
            uint256 stakedLpBalance,
            uint256 lpTokenBalance,
            uint256 usdcBalance
        )
    {
        uint256 stakedLpBalanceRaw = baseRewardPool.balanceOf(address(this));
        uint256 lpTokenBalanceRaw = lpToken.balanceOf(address(this));

        uint256 totalLpBalance = stakedLpBalanceRaw + lpTokenBalanceRaw;

        // Here, in order to prevent price manipulation attacks via curve pools,
        // When getting total position value -> its calculated based on virtual price
        // During withdrawal -> calc_withdraw_one_coin() is used to get an actual estimate of ETH received if we were to remove liquidity
        // The following checks account for this
        uint256 totalLpBalanceInUSDC = useVirtualPrice
            ? _lpTokenValueInUSDCfromVirtualPrice(totalLpBalance)
            : _lpTokenValueInUSDC(totalLpBalance);

        lpTokenBalance = useVirtualPrice
            ? _lpTokenValueInUSDCfromVirtualPrice(lpTokenBalanceRaw)
            : _lpTokenValueInUSDC(lpTokenBalanceRaw);

        stakedLpBalance = totalLpBalanceInUSDC - lpTokenBalance;
        usdcBalance = wantToken.balanceOf(address(this));
    }

    /**
   @notice Helper to convert Lp tokens into USDC
   @dev Burns LpTokens on UST3-Wormhole pool on curve to get USDC
   @param _amount amount of Lp tokens to burn to get USDC
   @return receivedWantTokens amount of want tokens received after converting Lp tokens
   */
    function _convertLpTokenIntoUSDC(uint256 _amount)
        internal
        returns (uint256 receivedWantTokens)
    {
        int128 usdcIndexInPool = int128(
            int256(uint256(UST3PoolCoinIndexes.USDC))
        );

        // estimate amount of USDC received based on stable peg i.e., 1UST = 1 3Pool LP Token
        uint256 expectedWantTokensOut = (_amount *
            ust3Pool.get_virtual_price()) / NORMALIZATION_FACTOR; // 30 = normalizing 18 decimals for virutal price + 18 decimals for LP token - 6 decimals for want token
        // burn Lp tokens to receive USDC with a slippage of `maxSlippage`
        receivedWantTokens = curve3PoolZap.remove_liquidity_one_coin(
            address(ust3Pool),
            _amount,
            usdcIndexInPool,
            (expectedWantTokensOut * (MAX_BPS - maxSlippage)) / (MAX_BPS)
        );
    }

    /**
   @notice Helper to convert USDC into Lp tokens
   @dev Provides USDC liquidity on UST3-Wormhole pool on curve to get Lp Tokens
   @param _amount amount of USDC to deposit to get Lp Tokens
   @return receivedLpTokens amount of LP tokens received after converting USDC
   */
    function _convertUSDCIntoLpToken(uint256 _amount)
        internal
        returns (uint256 receivedLpTokens)
    {
        uint256[4] memory liquidityAmounts = [0, 0, _amount, 0];

        // estimate amount of Lp Tokens based on stable peg i.e., 1UST = 1 3Pool LP Token
        uint256 expectedLpOut = (_amount * NORMALIZATION_FACTOR) /
            ust3Pool.get_virtual_price(); // 30 = normalizing 18 decimals for virutal price + 18 decimals for LP token - 6 decimals for want token
        // Provide USDC liquidity to receive Lp tokens with a slippage of `maxSlippage`
        receivedLpTokens = curve3PoolZap.add_liquidity(
            address(ust3Pool),
            liquidityAmounts,
            (expectedLpOut * (MAX_BPS - maxSlippage)) / (MAX_BPS)
        );
    }

    /**
   @notice to get value of an amount in USDC
   @param _value value to be converted
   @return estimatedLpTokenAmount estimated amount of lp tokens if (_value) amount of USDC is converted
   */
    function _lpTokenValueInUSDC(uint256 _value)
        internal
        view
        returns (uint256)
    {
        if (_value == 0) return 0;

        return
            curve3PoolZap.calc_withdraw_one_coin(
                address(ust3Pool),
                _value,
                int128(int256(uint256(UST3PoolCoinIndexes.USDC)))
            );
    }

    /**
   @notice to get value of an amount in ETB based on virtual price
   @param _value value to be converted
   @return estimatedLpTokenAmount lp tokens value in ETH based on its virtual price 
   */
    function _lpTokenValueInUSDCfromVirtualPrice(uint256 _value)
        internal
        view
        returns (uint256)
    {
        return (ust3Pool.get_virtual_price() * _value) / NORMALIZATION_FACTOR;
    }

    /**
   @notice to get value of an amount in Lp Tokens
   @param _value value to be converted
   @return estimatedUSDCAmount estimated amount of USDC if (_value) amount of LP Tokens is converted
   */
    function _USDCValueInLpToken(uint256 _value)
        internal
        view
        returns (uint256)
    {
        if (_value == 0) return 0;

        return
            curve3PoolZap.calc_token_amount(
                address(ust3Pool),
                [0, 0, _value, 0],
                true
            );
    }

    /**
   @notice Keeper function to set max accepted slippage of swaps
   @param _slippage Max accepted slippage during harvesting
   */
    function _setSlippage(uint256 _slippage) internal {
        maxSlippage = _slippage;
    }
}
