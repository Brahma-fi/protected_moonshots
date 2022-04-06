/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./interfaces/IHarvester.sol";
import "./interfaces/IUniswapV3Router.sol";
import "./interfaces/ICurveV2Pool.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Harvester is IHarvester {
  using SafeERC20 for IERC20;
  using SafeERC20 for IERC20Metadata;

  IERC20 public immutable override crv =
    IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
  IERC20 public immutable override cvx =
    IERC20(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
  IERC20 public immutable override _3crv =
    IERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
  IERC20 private immutable weth =
    IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

  ICurveV2Pool private immutable crveth =
    ICurveV2Pool(0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511);

  ICurveV2Pool private immutable cvxeth =
    ICurveV2Pool(0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4);

  ICurveV2Pool private immutable _3crvPool =
    ICurveV2Pool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);

  IUniswapV3Router private immutable uniswapRouter =
    IUniswapV3Router(0xE592427A0AEce92De3Edee1F18E0157C05861564);

  address public override keeper;
  address public override governance;

  IERC20Metadata public wantToken;

  constructor(
    address _keeper,
    IERC20Metadata _wantToken,
    address _governance
  ) {
    keeper = _keeper;
    wantToken = _wantToken;
    governance = _governance;
  }

  function approve() external override onlyKeeper {
    // max approve routers
    crv.safeApprove(address(crveth), type(uint256).max);
    cvx.safeApprove(address(cvxeth), type(uint256).max);
    weth.safeApprove(address(uniswapRouter), type(uint256).max);
    _3crv.safeApprove(address(_3crvPool), type(uint256).max);
  }

  /// @notice Keeper function to set want token to convert swapTokens into
  /// @param _addr address of the want token
  function setWantToken(address _addr)
    external
    override
    validAddress(_addr)
    onlyKeeper
  {
    wantToken = IERC20Metadata(_addr);
  }

  /// @notice Keeper&Governance function to set a new keeper
  /// @param _keeper address of new keeper
  function setKeeper(address _keeper) external override {
    require(
      msg.sender == keeper || msg.sender == governance,
      "Harvester :: keeper|governance"
    );

    keeper = _keeper;
  }

  /// @notice Governance function to set a new governance
  /// @param _governance address of new governance
  function setGovernance(address _governance) external override onlyGovernance {
    governance = _governance;
  }

  /// @notice Harvest the entire swap tokens list, i.e convert them into wantToken
  /// @dev Pulls all swap token balances from the msg.sender, swaps them into wantToken, and sends back the wantToken balance
  function harvest() external override {
    uint256 crvBalance = crv.balanceOf(address(this));
    uint256 cvxBalance = cvx.balanceOf(address(this));
    uint256 _3crvBalance = _3crv.balanceOf(address(this));
    // swap convex to eth
    if (cvxBalance > 0) {
      cvxeth.exchange(1, 0, cvxBalance, 0, false);
    }
    // swap crv to eth
    if (crv.balanceOf(address(this)) > 0) {
      crveth.exchange(1, 0, crvBalance, 0, false);
    }
    uint256 wethBalance = weth.balanceOf(address(this));

    // swap eth to USDC using 0.5% pool
    if (wethBalance > 0) {
      uniswapRouter.exactInput(
        IUniswapV3Router.ExactInputParams(
          abi.encodePacked(address(weth), uint24(500), address(wantToken)),
          address(this),
          block.timestamp,
          wethBalance,
          0
        )
      );
    }

    // swap _crv to usdc
    if (_3crvBalance > 0) {
      _3crvPool.remove_liquidity_one_coin(_3crvBalance, 1, 0);
    }

    // send token usdc back to vault
    wantToken.safeTransfer(msg.sender, wantToken.balanceOf(address(this)));
  }

  /// @notice Governance function to sweep a token's balance lying in Harvester
  /// @param _token address of token to sweep
  function sweep(address _token) external override onlyGovernance {
    IERC20(_token).safeTransfer(
      governance,
      IERC20Metadata(_token).balanceOf(address(this))
    );
  }

  //@notice Function which returns address of reward tokens
  function rewardTokens() external view override returns (address[] memory) {
    address[] memory rewards = new address[](3);
    rewards[0] = address(crv);
    rewards[1] = address(cvx);
    rewards[2] = address(_3crv);
    return rewards;
  }

  modifier validAddress(address _addr) {
    require(_addr != address(0), "_addr invalid");
    _;
  }

  modifier onlyGovernance() {
    require(msg.sender == governance, "Harvester :: onlyGovernance");
    _;
  }

  modifier onlyKeeper() {
    require(msg.sender == keeper, "auth: keeper");
    _;
  }
}
