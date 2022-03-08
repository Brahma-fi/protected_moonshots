/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../library/IterableMapping.sol";

import "../interfaces/ITradeExecutor.sol";
import "../interfaces/IMetaRouter.sol";


contract MetaRouter is IMetaRouter, ERC20 {

    using IterableMapping for IterableMapping.Map;


    // TODO Define this arbitrary limit
    uint constant BLOCK_LIMIT = 50;

    IterableMapping.Map private tradeExecutorsList;

    address public immutable wantToken;
    uint8 private immutable tokenDecimals;

    address public override keeper;
    address public override governance;
    address pendingGovernance;


    constructor(string memory _name, string memory _symbol, uint8 _decimals, address _wantToken, address _keeper, address _governance) ERC20(_name, _symbol) {
        tokenDecimals = _decimals;
        wantToken = _wantToken;
        keeper = _keeper;
        governance = _governance;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }


    function deposit(uint amountIn, address receiver) public returns (uint256 shares) {
        require(amountIn > 0);
        require(receiver != address(0));

        shares = totalSupply() * amountIn / totalRouterFunds();

        IERC20(wantToken).transferFrom(receiver, address(this), amountIn);
        _mint(receiver, shares);
    }

    function withdraw(uint sharesIn, address receiver) public returns (uint256 amountOut) {
        require(sharesIn > 0);
        require(receiver != address(0));

        amountOut = sharesIn * totalRouterFunds() / totalSupply();
        _burn(receiver, sharesIn);
        IERC20(wantToken).transfer(receiver, amountOut);
    }



    function totalRouterFunds() public view returns (uint) {
        return IERC20(wantToken).balanceOf(address(this)) + totalExecutorFunds();
    }

    function depositIntoExecutor(address _executor, uint _amount) public isActiveExecutor(_executor) onlyKeeper {
        require(_amount > 0);
        IERC20(wantToken).transfer(_executor, _amount);
    }

    function withdrawFromExecutor(address _executor, uint _amount) public isActiveExecutor(_executor) onlyKeeper {
        require(_amount > 0);
        IERC20(wantToken).transferFrom(_executor, address(this), _amount);
    }


    function totalExecutors() public view returns (uint) {
        return tradeExecutorsList.size();
    }

    function getExecutorStatus(address _executor) public view isValidAddress(_executor) returns (uint) {
        return tradeExecutorsList.get(_executor);
    }

    function executorByIndex(uint _index) public view returns (address, uint) {
        address executor = tradeExecutorsList.getKeyAtIndex(_index);
        uint status = getExecutorStatus(executor);
        return (executor, status);
    }

    function totalExecutorFunds() public view returns (uint) {
        uint totalFunds = 0;
        for (uint i = 0; i < tradeExecutorsList.size(); i++) {
            (address executor, uint status) = executorByIndex(i);
            if (status == 1) {
                (uint executorFunds, uint blockUpdated) = ITradeExecutor(executor).totalFunds();
                require (block.number <= blockUpdated + BLOCK_LIMIT, 'Executor funds are not up to date');
                totalFunds += executorFunds;
            }

        }
        return totalFunds;
    }


    /// EXECUTOR MANAGEMENT ///
    function addExecutor(address _tradeExecutor) public isValidAddress(_tradeExecutor) onlyKeeper {
        tradeExecutorsList.set(_tradeExecutor, 1);
    }

    function removeExecutor(address _tradeExecutor) public isValidAddress(_tradeExecutor) onlyKeeper {
        tradeExecutorsList.remove(_tradeExecutor);
    }

    function enableExecutor(address _tradeExecutor) public isValidAddress(_tradeExecutor) onlyKeeper {
        tradeExecutorsList.set(_tradeExecutor, 1);
    }

    function disableExecutor(address _tradeExecutor) public isValidAddress(_tradeExecutor) onlyKeeper {
        tradeExecutorsList.set(_tradeExecutor, 0);
    }

    // access modifiers - governance (only emergency)
    //✅ keeper - add, remove, 

    //✅ Iterable mapping of trade executors
    //✅ TE with their active flags (active or inactve) - controls all functions relevant to the TE 

    //✅ add TE 
    //✅ remove TE 
    //✅ deposit  - return LP tokens to user (needs updated totalfunds)
    //✅ withdraw  - burn LP tokens of a user (needs updated totalfunds)

    // TODO: discuss this with bapi - ideally a keeper job
    // ability to call initDeposit, confirmDeposit, initWithdraw, confirmWithdraw on active TE 

    function setGovernance(address _governance) public onlyGovernance{
        pendingGovernance = _governance;
    }

    function acceptGovernance() public {
        require(msg.sender == pendingGovernance);
        governance = pendingGovernance;
    }

    function setKeeper(address _keeper) public onlyGovernance {
        keeper = _keeper;
    }

    modifier onlyGovernance {
        require(msg.sender == governance);
        _;
    }

    modifier onlyKeeper {
        require(msg.sender == governance);
        _;
    }

    modifier isValidAddress(address _tradeExecutor) {
        require(_tradeExecutor!= address(0), 'Invalid address');
        _;
    }

    modifier isActiveExecutor(address _tradeExecutor) {
        require(getExecutorStatus(_tradeExecutor) == 1, "Executor is not active or doesnt exist");
        _;
    }

    

}


// TE Perp - totalFunds - x USDC, block - updated
 
// TE Convex - totalFunds - y USDC, block - updated

// deposit into metaRouter -  meta






// TotalFunds  Convex + Perp = 10010


// Idea arch
// 1 user deposits into metarouter, metaroputer checks totalfunds of all TEs and issues LP. USDC is kept in metarouter
// 2 backend later calls the async deposit functions on TEs with chosen USDC amounts

// Current arch

// 1 user deposits into metarouter, metaroputer checks totalfunds on specific TEs to priotritize L1 syncrobnous operation, and issue LP token in same txn as deposit
// 2. 


