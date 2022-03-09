/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./interfaces/IHarvester.sol";
import "./interfaces/IUniswapSwapRouter.sol";
import "./interfaces/IUniswapV3Factory.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Harvester is IHarvester {
  using SafeERC20 for IERC20;
  using SafeERC20 for IERC20Metadata;

  uint256 private immutable MAX_BPS = 10000;

  IUniswapV3Factory private immutable uniswapFactory =
    IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
  IUniswapSwapRouter private immutable uniswapRouter =
    IUniswapSwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

  address public override keeper;
  address public override governance;

  IERC20Metadata public wantToken;
  address[] public override swapTokens;
  uint256 public override numTokens;

  uint256 public override slippage;

  constructor(
    address _keeper,
    IERC20Metadata _wantToken,
    uint256 _slippage,
    address _governance
  ) {
    keeper = _keeper;
    wantToken = _wantToken;
    slippage = _slippage;
    governance = _governance;
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

  /// @notice Keeper function to set max accepted slippage of swaps
  /// @param _slippage Max accepted slippage during harvesting
  function setSlippage(uint256 _slippage) external override onlyKeeper {
    slippage = _slippage;
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

  /// @notice Keeper function to add a new swap token
  /// @param _addr address of the new swap token
  function addSwapToken(address _addr)
    external
    override
    onlyKeeper
    validAddress(_addr)
  {
    swapTokens.push(_addr);
    numTokens += 1;
  }

  /// @notice Keeper function to remove a swap token
  /// @param _addr address of the swap token to remove
  function removeSwapToken(address _addr)
    external
    override
    onlyKeeper
    validAddress(_addr)
  {
    uint256 _initialNumTokens = numTokens;

    for (uint256 idx = 0; idx < _initialNumTokens; idx++) {
      if (swapTokens[idx] == _addr) {
        delete swapTokens[idx];
        numTokens -= 1;

        for (uint256 delIdx = idx; delIdx < numTokens - 1; delIdx++) {
          swapTokens[delIdx] = swapTokens[delIdx + 1];
        }
        swapTokens.pop();
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

      _swapTokens(sourceToken, fee, sourceTokenBalance, 0);
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
    IERC20(_token).safeTransfer(
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

  modifier onlyKeeper() {
    require(msg.sender == keeper, "auth: keeper");
    _;
  }
}
