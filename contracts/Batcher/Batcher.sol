// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IBatcher.sol";
import "../../interfaces/IVault.sol";
import "../ConvexExecutor/interfaces/ICurvePool.sol";
import "../ConvexExecutor/interfaces/ICurveDepositZapper.sol";

import "./EIP712.sol";

/// @title Batcher
/// @author 0xAd1
/// @notice Used to batch user deposits and withdrawals until the next rebalance
contract Batcher is IBatcher, EIP712, ReentrancyGuard {
  using SafeERC20 for IERC20;

  /// @notice Vault parameters for the batcher
  VaultInfo public vaultInfo;

  /// @notice Creates a new Batcher strictly linked to a vault
  /// @param _verificationAuthority Address of the verification authority which allows users to deposit
  /// @param _governance Address of governance for Batcher
  /// @param vaultAddress Address of the vault which will be used to deposit and withdraw want tokens
  /// @param maxAmount Maximum amount of tokens that can be deposited in the vault
  constructor(
    address _verificationAuthority,
    address _governance,
    address vaultAddress,
    uint256 maxAmount
  ) {
    verificationAuthority = _verificationAuthority;
    governance = _governance;

    require(vaultAddress != address(0), "NULL_ADDRESS");
    vaultInfo = VaultInfo({
      vaultAddress: vaultAddress,
      tokenAddress: IVault(vaultAddress).wantToken(),
      maxAmount: maxAmount
    });

    IERC20(vaultInfo.tokenAddress).approve(vaultAddress, type(uint256).max);
  }

  /*///////////////////////////////////////////////////////////////
                       USER DEPOSIT/WITHDRAWAL LOGIC
  //////////////////////////////////////////////////////////////*/

  /// @notice Ledger to maintain addresses and their amounts to be deposited into vault
  mapping(address => uint256) public depositLedger;

  /// @notice Ledger to maintain addresses and their amounts to be withdrawn from vault
  mapping(address => uint256) public withdrawLedger;

  /// @notice Address which authorises users to deposit into Batcher
  address public verificationAuthority;

  /// @notice Amount of want tokens pending to be deposited
  uint256 public pendingDeposit;

  /// @notice Amount of LP tokens pending to be exchanged back to want token
  uint256 public pendingWithdrawal;

  /**
   * @notice Stores the deposits for future batching via periphery
   * @param amountIn Value of token to be deposited
   * @param signature signature verifying that depositor has enough karma and is authorized to deposit by brahma
   */
  function depositFunds(uint256 amountIn, bytes memory signature)
    external
    override
    nonReentrant
  {
    validDeposit(signature);
    IERC20(vaultInfo.tokenAddress).safeTransferFrom(
      msg.sender,
      address(this),
      amountIn
    );

    require(
      IERC20(vaultInfo.vaultAddress).totalSupply() + pendingDeposit - pendingWithdrawal + amountIn <= vaultInfo.maxAmount,
      "MAX_LIMIT_EXCEEDED"
    );

    _completeDeposit(amountIn);
  }


  /**
   * @notice Stores the deposits for future batching via periphery
   * @param amountIn Value of token to be deposited
   */
  function withdrawFunds(uint256 amountIn) external override nonReentrant {
    require(
      depositLedger[msg.sender] == 0,
      "DEPOSIT_PENDING"
    );

    if (amountIn > userTokens[msg.sender]) {
      IERC20(vaultInfo.vaultAddress).safeTransferFrom(
        msg.sender,
        address(this),
        amountIn - userTokens[msg.sender]
      );
      userTokens[msg.sender] = 0;
    } else {
      userTokens[msg.sender] = userTokens[msg.sender] - amountIn;
    }

    withdrawLedger[msg.sender] = withdrawLedger[msg.sender] + (amountIn);

    pendingWithdrawal = pendingWithdrawal + amountIn;

    emit WithdrawRequest(msg.sender, vaultInfo.vaultAddress, amountIn);
  }

  /**
   * @notice Allows user to withdraw LP tokens
   * @param amount Amount of LP tokens to withdraw
   * @param recipient Address to receive the LP tokens
   */
  function claimTokens(uint256 amount, address recipient)
    public
    override
    nonReentrant
  {
    require(userTokens[msg.sender] >= amount, "NO_FUNDS");
    userTokens[msg.sender] = userTokens[msg.sender] - amount;
    IERC20(vaultInfo.vaultAddress).safeTransfer(recipient, amount);
  }

  /*///////////////////////////////////////////////////////////////
                    VAULT DEPOSIT/WITHDRAWAL LOGIC
  //////////////////////////////////////////////////////////////*/

  /// @notice Ledger to maintain addresses and vault tokens which batcher owes them
  mapping(address => uint256) public userTokens;

  /// @notice Priavte mapping used to check duplicate addresses while processing batch deposits and withdrawals
  mapping(address => bool) private processedAddresses;

  /**
   * @notice Performs deposits on the periphery for the supplied users in batch
   * @param users array of users whose deposits must be resolved
   */
  function batchDeposit(address[] memory users) external override nonReentrant {
    onlyKeeper();
    IVault vault = IVault(vaultInfo.vaultAddress);

    uint256 amountToDeposit = 0;
    uint256 oldLPBalance = IERC20(address(vault)).balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      if (!processedAddresses[users[i]]) {
        amountToDeposit = amountToDeposit + (depositLedger[users[i]]);
        processedAddresses[users[i]] = true;
      }
    }

    require(amountToDeposit > 0, "NO_DEPOSITS");

    uint256 lpTokensReportedByVault = vault.deposit(
      amountToDeposit,
      address(this)
    );

    uint256 lpTokensReceived = IERC20(address(vault)).balanceOf(address(this)) -
      (oldLPBalance);

    require(
      lpTokensReceived == lpTokensReportedByVault,
      "LP_TOKENS_MISMATCH"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = depositLedger[users[i]];
      if (processedAddresses[users[i]]) {
        if (userAmount > 0) {
          uint256 userShare = (userAmount * (lpTokensReceived)) /
            (amountToDeposit);
          userTokens[users[i]] = userTokens[users[i]] + userShare;
          depositLedger[users[i]] = 0;
        }
        processedAddresses[users[i]] = false;
      }
    }

    pendingDeposit = pendingDeposit - amountToDeposit;
  }

  /**
   * @notice Performs withdraws on the periphery for the supplied users in batch
   * @param users array of users whose deposits must be resolved
   */
  function batchWithdraw(address[] memory users)
    external
    override
    nonReentrant
  {
    onlyKeeper();
    IVault vault = IVault(vaultInfo.vaultAddress);

    IERC20 token = IERC20(vaultInfo.tokenAddress);

    uint256 amountToWithdraw = 0;
    uint256 oldWantBalance = token.balanceOf(address(this));

    for (uint256 i = 0; i < users.length; i++) {
      if (!processedAddresses[users[i]]) {
        amountToWithdraw = amountToWithdraw + (withdrawLedger[users[i]]);
        processedAddresses[users[i]] = true;
      }
    }

    require(amountToWithdraw > 0, "NO_WITHDRAWS");

    uint256 wantTokensReportedByVault = vault.withdraw(
      amountToWithdraw,
      address(this)
    );

    uint256 wantTokensReceived = token.balanceOf(address(this)) -
      (oldWantBalance);

    require(
      wantTokensReceived == wantTokensReportedByVault,
      "WANT_TOKENS_MISMATCH"
    );

    for (uint256 i = 0; i < users.length; i++) {
      uint256 userAmount = withdrawLedger[users[i]];
      if (processedAddresses[users[i]]) {
        if (userAmount > 0) {
          uint256 userShare = (userAmount * wantTokensReceived) /
            amountToWithdraw;
          token.safeTransfer(users[i], userShare);

          withdrawLedger[users[i]] = 0;
        }
        processedAddresses[users[i]] = false;
      }
    }

    pendingWithdrawal = pendingWithdrawal - amountToWithdraw;
  }

  /*///////////////////////////////////////////////////////////////
                    INTERNAL HELPERS
  //////////////////////////////////////////////////////////////*/

  /// @notice Helper to verify signature against verification authority
  /// @param signature Should be generated by verificationAuthority. Should contain msg.sender
  function validDeposit(bytes memory signature) internal view {
    require(
      verifySignatureAgainstAuthority(signature, verificationAuthority),
      "INVALID_SIGNATURE"
    );

    require(
      withdrawLedger[msg.sender] == 0,
      "WITHDRAW_PENDING"
    );
  }

  /// @notice Common internal helper to process deposit requests from both wantTokena and CurveLPToken
  /// @param amountIn Amount of want tokens deposited
  function _completeDeposit(uint256 amountIn) internal {
    depositLedger[msg.sender] = depositLedger[msg.sender] + (amountIn);
    pendingDeposit = pendingDeposit + amountIn;

    emit DepositRequest(msg.sender, vaultInfo.vaultAddress, amountIn);
  }



  /*///////////////////////////////////////////////////////////////
                    MAINTAINANCE ACTIONS
  //////////////////////////////////////////////////////////////*/

  /// @notice Function to set authority address
  /// @param authority New authority address
  function setAuthority(address authority) public {
    onlyGovernance();
    verificationAuthority = authority;
  }

  /// @inheritdoc IBatcher
  function setVaultLimit(uint256 maxAmount) external override {
    onlyKeeper();
    vaultInfo.maxAmount = maxAmount;
  }


  /// @notice Function to sweep funds out in case of emergency, can only be called by governance
  /// @param _token Address of token to sweep
  function sweep(address _token) public nonReentrant {
    onlyGovernance();
    IERC20(_token).transfer(
      msg.sender,
      IERC20(_token).balanceOf(address(this))
    );
  }

  /*///////////////////////////////////////////////////////////////
                    ACCESS MODIFERS
  //////////////////////////////////////////////////////////////*/

  /// @notice Governance address
  address public governance;

  /// @notice Pending governance address
  address public pendingGovernance;

  /// @notice Helper to get Keeper address from Vault contract
  /// @return Keeper address
  function keeper() public view returns (address) {
    require(vaultInfo.vaultAddress != address(0), "NULL_ADDRESS");
    return IVault(vaultInfo.vaultAddress).keeper();
  }

  /// @notice Helper to asset msg.sender as keeper address
  function onlyKeeper() internal view {
    require(msg.sender == keeper(), "ONLY_KEEPER");
  }

  /// @notice Helper to asset msg.sender as governance address
  function onlyGovernance() internal view {
    require(governance == msg.sender, "ONLY_GOV");
  }

  /// @notice Function to change governance. New address will need to accept the governance role
  /// @param _governance Address of new temporary governance
  function setGovernance(address _governance) external {
    onlyGovernance();
    pendingGovernance = _governance;
  }

  /// @notice Function to accept governance role. Only pending governance can accept this role
  function acceptGovernance() external {
    require(msg.sender == pendingGovernance, "ONLY_PENDING_GOV");
    governance = pendingGovernance;
  }
}
