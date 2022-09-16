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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FraxConvexPositionHandler
/// @author PradeepSelva & BapireddyK;
/// @notice A Position handler to handle FraxConvex for FRAX/USDC pool
abstract contract FraxConvexPositionHandler is BasePositionHandler {
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

    /*///////////////////////////////////////////////////////////////
                          INITIALIZING
    //////////////////////////////////////////////////////////////*/
    constructor() {
        convexVault = IConvexStakingProxy(
            fraxConvexBooster.createVault(FRAX_USDC_PID)
        );
    }

    /// @notice configures ConvexPositionHandler with the required state
    /// @param _harvester address of harvester
    /// @param _wantToken address of want token
    function _configHandler(address _harvester, address _wantToken) internal {
        wantToken = IERC20(_wantToken);
        harvester = IHarvester(_harvester);

        // Approve max LP tokens to FraxConvex booster
        lpToken.approve(address(convexVault), type(uint256).max);

        // Approve max want tokens to frax2Pool.
        wantToken.approve(address(fraxPool), type(uint256).max);

        // Approve max lp tokens to frax2Pool
        lpToken.approve(address(fraxPool), type(uint256).max);
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
}
