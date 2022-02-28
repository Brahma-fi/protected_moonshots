// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./solmate/ERC20.sol";
import "./solmate/SafeTransferLib.sol";

import "../library/Math.sol";

import "../interfaces/IVault.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/ICurvePool.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is IVault, ERC20, ReentrancyGuard {
  using SafeTransferLib for ERC20;

  ERC20 public override token;
  address public override governance;
  address public override pendingGovernance;
  address public override batcher;

  uint256 public override depositLimit;
  uint256 public override managementFee;
  uint256 public override performanceFee;
  uint256 public constant MAX_BPS = 10000;
  string public constant API_VERSION = "1.0.0";

  bool public override emergencyShutdown = false;

  // 0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A
  IConvexRewards public override baseRewardPool;
  // 0xCEAF7747579696A2F0bb206a14210e3c9e6fB269
  ICurvePool public override ust3Pool;

  event UpdateGovernance(
    address governance // New active governance
  );

  event UpdateDepositLimit(
    uint256 depositLimit // New active deposit limit
  );

  event UpdatePerformanceFee(
    uint256 performanceFee // New active performance fee
  );

  event UpdateManagementFee(
    uint256 managementFee // New active performance fee
  );

  event EmergencyShutdown(
    bool active //New emergency shutdown state (if false, normal operation enabled)
  );

  constructor(
    uint256 _depositLimit,
    address _token,
    address _governance,
    address _batcher,
    address _baseRewardPool,
    address _ust3Pool,
    string memory _name,
    string memory _symbol,
    uint8 _decimal
  ) ERC20(_name, _symbol, _decimal) {
    _initialize(
      _depositLimit,
      _token,
      _governance,
      _batcher,
      _baseRewardPool,
      _ust3Pool
    );
  }

  function _initialize(
    uint256 _depositLimit,
    address _token,
    address _governance,
    address _batcher,
    address _baseRewardPool,
    address _ust3Pool
  ) internal {
    depositLimit = _depositLimit;
    token = ERC20(_token);

    baseRewardPool = IConvexRewards(_baseRewardPool);
    ust3Pool = ICurvePool(_ust3Pool);

    governance = _governance;
    batcher = _batcher;
    performanceFee = 0;
    managementFee = 0;

    token.safeApprove(_baseRewardPool, type(uint256).max);

    emit UpdateGovernance(governance);
    emit UpdatePerformanceFee(performanceFee);
    emit UpdateManagementFee(managementFee);
    emit UpdateDepositLimit(depositLimit);
  }

  function apiVersion() external pure override returns (string memory) {
    return API_VERSION;
  }

  function setGovernance(address _governance) external override onlyGovernance {
    pendingGovernance = _governance;
  }

  function acceptGovernance() external override {
    _onlyPendingGovernance();
    governance = msg.sender;

    emit UpdateGovernance(governance);
  }

  function setBatcher(address _batcher) external override onlyGovernance {
    batcher = _batcher;
  }

  function setDepositLimit(uint256 _depositLimit)
    external
    override
    onlyGovernance
  {
    depositLimit = _depositLimit;

    emit UpdateDepositLimit(depositLimit);
  }

  function setEmergencyShutdown(bool _active) external override {
    if (_active) {
      _onlyGovernance();
    }

    emergencyShutdown = _active;

    emit EmergencyShutdown(_active);
  }

  function setPerformanceFee(uint256 _performanceFee)
    external
    override
    onlyGovernance
  {
    require(_performanceFee <= MAX_BPS / 2, "fee too high");
    performanceFee = _performanceFee;

    emit UpdatePerformanceFee(performanceFee);
  }

  function setManagementFee(uint256 _managementFee)
    external
    override
    onlyGovernance
  {
    require(_managementFee <= MAX_BPS, "fee too high");
    managementFee = _managementFee;

    emit UpdateManagementFee(managementFee);
  }

  function deposit(uint256 _amount, address recepient)
    external
    override
    nonReentrant
    onlyBatcher
    returns (uint256 sharesOut)
  {
    _nonZero(_amount, "zero amount");
    require(totalAssets() + _amount <= depositLimit, "excess deposit");

    sharesOut = _issueSharesForAmount(recepient, _amount);
    token.safeTransferFrom(msg.sender, address(this), _amount);

    _depositToConvex(_amount);
  }

  function _depositToConvex(uint256 _amount) internal {
    require(token.balanceOf(address(this)) >= _amount, "insufficient balance");
    require(baseRewardPool.stake(_amount), "convex staking failed");
  }

  function _shareValue(uint256 shares) internal view returns (uint256) {
    if (totalSupply == 0) {
      return shares;
    }
    return shares * (totalAssets() / totalSupply);
  }

  function _sharesForAmount(uint256 amount) internal view returns (uint256) {
    uint256 freeFunds = totalAssets();

    if (freeFunds == 0) {
      return 0;
    }

    return (amount * totalSupply) / freeFunds;
  }

  function maxAvailableShares()
    external
    view
    override
    returns (uint256 _maxAvailableShares)
  {
    _maxAvailableShares = _sharesForAmount(totalAssets());
  }

  // TODO: get staking balance in convex, lp token tokens in this address and USDC--> lp tokens price conversion
  function totalAssets() public view override returns (uint256) {
    uint256 ust3wcrvPrice = ust3Pool.get_virtual_price();

    return _UST3WCRVBalance() * ust3wcrvPrice;
  }

  function _UST3WCRVBalance() internal view returns (uint256) {
    return
      token.balanceOf(address(this)) + baseRewardPool.balanceOf(address(this));
  }

  // TODO: unstake from convex pool and convert usdc lying around. --> curve lp token.
  function withdraw(
    uint256 maxShares,
    address recepient,
    uint256 maxLoss
  ) external override nonReentrant returns (uint256 amountToWithdraw) {
    uint256 maxWithdraw = _shareValue(maxShares);
    uint256 stakedLpBalance = baseRewardPool.balanceOf(address(this));
    uint256 lpTokenBalance = token.balanceOf(address(this));

    amountToWithdraw = Math.min(
      maxWithdraw,
      (stakedLpBalance + lpTokenBalance)
    );

    if (amountToWithdraw > lpTokenBalance) {
      require(
        baseRewardPool.withdraw(amountToWithdraw - lpTokenBalance, true),
        "could not unstake"
      );
    }

    token.safeTransfer(recepient, amountToWithdraw);
  }

  function _issueSharesForAmount(address to, uint256 amount)
    internal
    returns (uint256 shares)
  {
    if (totalSupply > 0) {
      shares = amount * (totalSupply / totalAssets());
    } else {
      shares = amount;
    }

    _mint(to, shares);
  }

  function _nonZero(uint256 value, string memory message) internal pure {
    require(value > 0, message);
  }

  function _onlyPendingGovernance() internal view {
    require(msg.sender == pendingGovernance, "access :: pendingGovernance");
  }

  function _onlyBatcher() internal view {
    require(msg.sender == batcher, "access :: Batcher");
  }

  function _onlyGovernance() internal view {
    require(msg.sender == governance, "access :: Governance");
  }

  modifier onlyBatcher() {
    _onlyBatcher();
    _;
  }

  modifier onlyGovernance() {
    _onlyGovernance();
    _;
  }
}
