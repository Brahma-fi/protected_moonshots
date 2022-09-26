// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../../../interfaces/BasePositionHandler.sol";
import "../../../library/Math.sol";

import "../interfaces/IFraxConvexBooster.sol";
import "../interfaces/ICurve2Pool.sol";
import "../interfaces/ICurveDepositZapper.sol";
import "../interfaces/IHarvester.sol";
import "../interfaces/IConvexStakingProxy.sol";
import "../interfaces/IConvexStaking.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FraxConvexPositionHandler
/// @author PradeepSelva & BapireddyK;
/// @notice A Position handler to handle FraxConvex for FRAX/USDC pool
contract FraxConvexPositionHandler is BasePositionHandler {
    using SafeERC20 for IERC20;

    /*///////////////////////////////////////////////////////////////
                            ENUMS
  //////////////////////////////////////////////////////////////*/
    enum FraxPoolCoinIndexes {
        FRAX,
        USDC
    }

    /*///////////////////////////////////////////////////////////////
                          STRUCTS FOR DECODING
  //////////////////////////////////////////////////////////////*/
    /// @notice Struct to decode amount in and amount out during deposit and withdraw
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
    /// @notice Pool ID for FRAX/USDC on frax-convex
    uint256 public constant FRAX_USDC_PID = 9;

    /*///////////////////////////////////////////////////////////////
                          GLOBAL MUTABLES
  //////////////////////////////////////////////////////////////*/
    /// @notice the max permitted slippage for swaps
    uint256 public maxSlippage = 30;
    /// @notice The duration to open a staking position for ( in secs )
    uint256 public stakingPeriodSecs;
    /// @notice the latest amount of rewards claimed and harvested
    uint256 public latestHarvestedRewards;
    /// @notice the total cummulative rewards earned so far
    uint256 public totalCummulativeRewards;
    /// @notice governance handled variable, that tells how to calculate position in want token
    /// @dev this is done to account for cases of depeg
    bool public useVirtualPriceForPosValue = true;

    /*///////////////////////////////////////////////////////////////
                            EXTERNAL CONTRACTS
  //////////////////////////////////////////////////////////////*/
    /// @notice The want token that is deposited and withdrawn
    IERC20 public wantToken;
    /// @notice Curve LP Tokens that are converted and staked on Convex
    IERC20 public lpToken = IERC20(0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC);
    /// @notice Harvester that harvests rewards claimed from Convex
    IHarvester public harvester;

    /// @notice curve's Frax Pool
    ICurve2Pool public constant fraxPool =
        ICurve2Pool(0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2);
    /// @notice FraxConvex booster
    IFraxConvexBooster public constant fraxConvexBooster =
        IFraxConvexBooster(0x569f5B842B5006eC17Be02B8b94510BA8e79FbCa);

    /// @notice FraxConvex staking vault
    IConvexStakingProxy public immutable convexVault;
    /// @notice FraxConvex staking vault
    IConvexStaking public immutable convexStaking;

    /*///////////////////////////////////////////////////////////////
                          INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor() {
        address _stakingVault = fraxConvexBooster.createVault(FRAX_USDC_PID);

        // Create a staking proxy vault and get the actual staking contract
        convexVault = IConvexStakingProxy(_stakingVault);
        convexStaking = IConvexStaking(
            IConvexStakingProxy(_stakingVault).stakingAddress()
        );

        // Approve max LP tokens to FraxConvex booster
        lpToken.approve(address(_stakingVault), type(uint256).max);

        // Approve max want tokens to frax2Pool.
        wantToken.approve(address(fraxPool), type(uint256).max);

        // Approve max lp tokens to frax2Pool
        lpToken.approve(address(fraxPool), type(uint256).max);
    }

    /// @notice configures ConvexPositionHandler with the required state
    /// @param _harvester address of harvester
    /// @param _wantToken address of want token
    function _configHandler(address _harvester, address _wantToken) internal {
        wantToken = IERC20(_wantToken);
        harvester = IHarvester(_harvester);
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
        ) = _getTotalBalancesInWantToken(useVirtualPriceForPosValue);

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
   @param _data param not needed here. Added to comply with the interface
   */
    function _withdraw(bytes calldata _data) internal override {
        uint256 lpTokensToConvert = lpToken.balanceOf(address(this));
        // if lp tokens are required to convert, then convert to usdc and update amountToWithdraw
        if (lpTokensToConvert > 0) {
            _convertLpTokenIntoUSDC(lpTokensToConvert);
        }

        emit Withdraw(wantToken.balanceOf(address(this)));
    }

    /*///////////////////////////////////////////////////////////////
                      OPEN / CLOSE LOGIC
  //////////////////////////////////////////////////////////////*/

    /**
   @notice To open staking position in Convex
   @dev stakes the specified Curve Lp Tokens into Convex's Frax pool
   @param _data Encoded AmountParams as _data with LP Token amount
   */
    function _openPosition(bytes calldata _data) internal override {
        _checkPosition(false);

        AmountParams memory openPositionParams = abi.decode(
            _data,
            (AmountParams)
        );
        require(
            openPositionParams._amount <= lpToken.balanceOf(address(this)),
            "INSUFFICIENT_BALANCE"
        );

        uint256 previousLpTokenBalance = lpToken.balanceOf(address(this));
        convexVault.stakeLockedCurveLp(
            openPositionParams._amount,
            stakingPeriodSecs
        );

        require(
            lpToken.balanceOf(address(this)) < previousLpTokenBalance,
            "STAKING_UNSUCCESSFUL"
        );
    }

    /**
   @notice To close Convex Staking Position
   @dev Unstakes from Convex position and gives back them as Curve Lp Tokens along with rewards like CRV, CVX.
   @param _data param not needed here. Added to comply with the interface
   */
    function _closePosition(bytes calldata _data) internal override {
        _checkPosition(true);
        IConvexStaking.LockedStake memory _lockedStakeData = (
            convexStaking.lockedStakesOf(address(convexVault))
        )[0];

        uint256 previousLpTokenBalance = lpToken.balanceOf(address(this));
        convexVault.withdrawLockedAndUnwrap(_lockedStakeData.kek_id);

        require(
            lpToken.balanceOf(address(this)) > previousLpTokenBalance,
            "WITHDRAW_UNSUCCESSFUL"
        );
    }

    /*///////////////////////////////////////////////////////////////
                      REWARDS LOGIC
  //////////////////////////////////////////////////////////////*/
    /**
   @notice To claim rewards from Convex Staking position
   @dev Claims Convex Staking position rewards, and converts them to wantToken i.e., USDC.
   @param _data param not needed here. Added to comply with the interface
   */
    function _claimRewards(bytes calldata _data) internal override {
        convexVault.getReward();

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
        uint256 stakedLpBalanceRaw = convexStaking.lockedLiquidityOf(
            address(convexVault)
        );
        uint256 lpTokenBalanceRaw = lpToken.balanceOf(address(this));

        uint256 totalLpBalance = stakedLpBalanceRaw + lpTokenBalanceRaw;

        // Here, in order to prevent price manipulation attacks via curve pools,
        // When getting total position value -> its calculated based on virtual price
        // During withdrawal -> calc_withdraw_one_coin() is used to get an actual estimate of USDC received if we were to remove liquidity
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
   @dev Burns LpTokens on Frax pool on curve to get USDC
   @param _amount amount of Lp tokens to burn to get USDC
   @return receivedWantTokens amount of want tokens received after converting Lp tokens
   */
    function _convertLpTokenIntoUSDC(uint256 _amount)
        internal
        returns (uint256 receivedWantTokens)
    {
        int128 usdcIndexInPool = int128(
            int256(uint256(FraxPoolCoinIndexes.USDC))
        );

        // estimate amount of USDC received based on stable peg i.e., 1FXS = 1 3Pool LP Token
        uint256 expectedWantTokensOut = (_amount *
            fraxPool.get_virtual_price()) / NORMALIZATION_FACTOR; // 30 = normalizing 18 decimals for virutal price + 18 decimals for LP token - 6 decimals for want token
        // burn Lp tokens to receive USDC with a slippage of `maxSlippage`
        receivedWantTokens = fraxPool.remove_liquidity_one_coin(
            _amount,
            usdcIndexInPool,
            (expectedWantTokensOut * (MAX_BPS - maxSlippage)) / (MAX_BPS)
        );
    }

    /**
   @notice Helper to convert USDC into Lp tokens
   @dev Provides USDC liquidity on Frax pool on curve to get Lp Tokens
   @param _amount amount of USDC to deposit to get Lp Tokens
   @return receivedLpTokens amount of LP tokens received after converting USDC
   */
    function _convertUSDCIntoLpToken(uint256 _amount)
        internal
        returns (uint256 receivedLpTokens)
    {
        uint256[2] memory liquidityAmounts = [0, _amount];

        // estimate amount of Lp Tokens based on stable peg i.e., 1FXS = 1 3Pool LP Token
        uint256 expectedLpOut = (_amount * NORMALIZATION_FACTOR) /
            fraxPool.get_virtual_price(); // 30 = normalizing 18 decimals for virutal price + 18 decimals for LP token - 6 decimals for want token
        // Provide USDC liquidity to receive Lp tokens with a slippage of `maxSlippage`
        receivedLpTokens = fraxPool.add_liquidity(
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
            fraxPool.calc_withdraw_one_coin(
                _value,
                int128(int256(uint256(FraxPoolCoinIndexes.USDC)))
            );
    }

    /**
   @notice to get value of an amount in USDC based on virtual price
   @param _value value to be converted
   @return estimatedLpTokenAmount lp tokens value in USDC based on its virtual price 
   */
    function _lpTokenValueInUSDCfromVirtualPrice(uint256 _value)
        internal
        view
        returns (uint256)
    {
        return (fraxPool.get_virtual_price() * _value) / NORMALIZATION_FACTOR;
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

        return fraxPool.calc_token_amount([0, _value], true);
    }

    /**
   @notice Keeper function to set max accepted slippage of swaps
   @param _slippage Max accepted slippage during harvesting
   */
    function _setSlippage(uint256 _slippage) internal {
        maxSlippage = _slippage;
    }

    /// @notice Governance function to set how position value should be calculated, i.e using virtual price or calc withdraw
    /// @param _useVirtualPriceForPosValue bool signifying if virtual price should be used to calculate position value
    function _setUseVirtualPriceForPosValue(bool _useVirtualPriceForPosValue)
        internal
    {
        useVirtualPriceForPosValue = _useVirtualPriceForPosValue;
    }

    /// @notice Governance function to set the period to open a staking position for
    /// @param _stakingPeriodSecs the staking period duration in seconds
    function _setStakingPeriod(uint256 _stakingPeriodSecs) internal {
        stakingPeriodSecs = _stakingPeriodSecs;
    }

    /// @notice helper function to check if a position is active or inactive
    /// @param isActive input to check if the position to check should be active or inactive
    function _checkPosition(bool isActive) internal view {
        require(
            convexStaking.lockedStakesOfLength(address(convexVault)) ==
                (isActive ? 1 : 0),
            isActive ? "NO_ACTIVE_POSITION" : "POSITION_ALREADY_ACTIVE"
        );
    }
}
