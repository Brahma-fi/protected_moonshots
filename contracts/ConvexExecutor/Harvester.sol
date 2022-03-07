/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./interfaces/IHarvester.sol";
import "./interfaces/IUniswapSwapRouter.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/IQuoter.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { SafeTransferLib } from "../solmate/SafeTransferLib.sol";
import "../solmate/ERC20.sol";

contract Harvester is IHarvester {
  using SafeTransferLib for ERC20;
  using SafeERC20 for IERC20;
  using SafeERC20 for IERC20Metadata;

  uint256 private immutable MAX_BPS = 10000;

  IUniswapV3Factory private immutable uniswapFactory =
    IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
  IUniswapSwapRouter private immutable uniswapRouter =
    IUniswapSwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
  IQuoter public immutable quoter =
    IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

  address public override strategist;
  address public override governance;

  IERC20Metadata public wantToken;
  address[] public override swapTokens;
  uint256 public override numTokens;

  uint256 public override slippage;

  constructor(
    address _strategist,
    IERC20Metadata _wantToken,
    uint256 _slippage,
    address _governance
  ) {
    strategist = _strategist;
    wantToken = _wantToken;
    slippage = _slippage;
    governance = _governance;
  }

  /// @notice Strategist function to set want token to convert swapTokens into
  /// @param _addr address of the want token
  function setWantToken(address _addr)
    external
    override
    validAddress(_addr)
    onlyStrategist
  {
    wantToken = IERC20Metadata(_addr);
  }

  /// @notice Strategist function to set max accepted slippage of swaps
  /// @param _slippage Max accepted slippage during harvesting
  function setSlippage(uint256 _slippage) external override onlyStrategist {
    slippage = _slippage;
  }

  /// @notice Strategist&Governance function to set a new strategist
  /// @param _strategist address of new strategist
  function setStrategist(address _strategist) external override {
    require(
      msg.sender == strategist || msg.sender == governance,
      "Harvester :: strategist|governance"
    );

    strategist = _strategist;
  }

  /// @notice Governance function to set a new governance
  /// @param _governance address of new governance
  function setGovernance(address _governance) external override onlyGovernance {
    governance = _governance;
  }

  /// @notice Strategist function to add a new swap token
  /// @param _addr address of the new swap token
  function addSwapToken(address _addr)
    external
    override
    onlyStrategist
    validAddress(_addr)
  {
    swapTokens.push(_addr);
    numTokens++;
  }

  /// @notice Strategist function to remove a swap token
  /// @param _addr address of the swap token to remove
  function removeSwapToken(address _addr)
    external
    override
    onlyStrategist
    validAddress(_addr)
  {
    uint256 _initialNumTokens = numTokens;

    for (uint256 idx = 0; idx < _initialNumTokens; idx++) {
      if (swapTokens[idx] == _addr) {
        delete swapTokens[idx];
        numTokens--;
      }
    }

    if (numTokens == _initialNumTokens) {
      revert("_addr does not exist");
    }
  }

  /// @notice Swap a single token thats present in the Harvester using UniV3
  /// @param sourceToken address of the token to swap into wantToken
  function swap(address sourceToken) public override {
    require(sourceToken != address(0), "sourceToken invalid");

    uint16[3] memory fees = [500, 3000, 10000];
    uint256 sourceTokenBalance = IERC20Metadata(sourceToken).balanceOf(
      address(this)
    );

    if (sourceTokenBalance > 0) {
      uint24 fee;
      for (uint256 idx = 0; idx < fees.length; idx++) {
        if (
          uniswapFactory.getPool(sourceToken, address(wantToken), fees[idx]) !=
          address(0)
        ) {
          fee = fees[idx];
          break;
        }
      }

      _estimateAndSwap(sourceToken, sourceTokenBalance, fee);
    }
  }

  /// @notice Harvest the entire swap tokens list, i.e convert them into wantToken
  /// @dev Pulls all swap token balances from the msg.sender, swaps them into wantToken, and sends back the wantToken balance
  function harvest() external override {
    for (uint256 idx = 0; idx < swapTokens.length; idx++) {
      IERC20 _token = IERC20(swapTokens[idx]);
      _token.safeTransferFrom(
        msg.sender,
        address(this),
        _token.balanceOf(msg.sender)
      );

      swap(swapTokens[idx]);
    }

    wantToken.safeTransfer(msg.sender, wantToken.balanceOf(address(this)));
  }

  /// @notice estimates output and swaps a token
  /// @dev Internal helper function to perform UniV3 output estimations and call swap
  function _estimateAndSwap(
    address token,
    uint256 amountToSwap,
    uint24 fee
  ) internal {
    uint256 amountOutMinimum = (quoter.quoteExactInputSingle(
      address(token),
      address(wantToken),
      fee,
      amountToSwap,
      0
    ) * (MAX_BPS - slippage)) / (MAX_BPS);

    _swapTokens(token, fee, amountToSwap, amountOutMinimum);
  }

  /// @notice swaps a token on UniV3
  /// @dev Internal helper function to perform token swap on UniV3
  function _swapTokens(
    address token,
    uint24 fee,
    uint256 amountIn,
    uint256 amountOutMinimum
  ) internal {
    IERC20Metadata(token).safeApprove(address(uniswapRouter), amountIn);

    IUniswapSwapRouter.ExactInputSingleParams memory params = IUniswapSwapRouter
      .ExactInputSingleParams({
        tokenIn: token,
        tokenOut: address(wantToken),
        fee: fee,
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0
      });
    uniswapRouter.exactInputSingle(params);
  }

  /// @notice Governance function to sweep a token's balance lying in Harvester
  /// @param _token address of token to sweep
  function sweep(address _token) external override onlyGovernance {
    ERC20(_token).safeTransfer(
      governance,
      IERC20Metadata(_token).balanceOf(address(this))
    );
  }

  /// @notice Used to migrate to a new Harvester contract
  /// @dev Transfers all swapToken balances to the new contract address
  /// @param _newHarvester address of new Harvester contract
  function migrate(address _newHarvester) external override {
    for (uint256 idx = 0; idx < swapTokens.length; idx++) {
      IERC20 _token = IERC20(swapTokens[idx]);
      _token.safeTransfer(_newHarvester, _token.balanceOf(address(this)));
    }
  }

  modifier validAddress(address _addr) {
    require(_addr != address(0), "_addr invalid");
    _;
  }

  modifier onlyGovernance() {
    require(msg.sender == governance, "Harvester :: onlyGovernance");
    _;
  }

  modifier onlyStrategist() {
    require(msg.sender == strategist, "auth: strategist");
    _;
  }
}
