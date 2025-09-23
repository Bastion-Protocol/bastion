// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

/**
 * @title AaveIntegration
 * @dev Integrates with Aave Protocol v3 for yield optimization of idle funds
 */
contract AaveIntegration is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Aave v3 interfaces
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    // Mapping to track deposits by lending circle
    mapping(address => mapping(address => uint256)) public deposits; // circle => token => amount
    mapping(address => mapping(address => uint256)) public aTokenBalances; // circle => token => aToken balance

    // Events
    event FundsDeposited(
        address indexed circle,
        address indexed token,
        uint256 amount,
        uint256 aTokensReceived
    );

    event FundsWithdrawn(
        address indexed circle,
        address indexed token,
        uint256 amount,
        uint256 aTokensBurned
    );

    event YieldHarvested(
        address indexed circle,
        address indexed token,
        uint256 yieldAmount
    );

    // Only authorized lending circles can interact
    mapping(address => bool) public authorizedCircles;

    modifier onlyAuthorizedCircle() {
        require(authorizedCircles[msg.sender], "Unauthorized circle");
        _;
    }

    constructor(address _addressesProvider) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressesProvider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
    }

    /**
     * @dev Authorizes a lending circle to use Aave integration
     */
    function authorizeCircle(address circle) external onlyOwner {
        authorizedCircles[circle] = true;
    }

    /**
     * @dev Revokes authorization for a lending circle
     */
    function revokeCircleAuthorization(address circle) external onlyOwner {
        authorizedCircles[circle] = false;
    }

    /**
     * @dev Deposits tokens to Aave for yield generation
     * @param token The token to deposit
     * @param amount The amount to deposit
     */
    function deposit(address token, uint256 amount) external onlyAuthorizedCircle nonReentrant {
        require(amount > 0, "Amount must be positive");
        
        address circle = msg.sender;
        
        // Get aToken before deposit for balance calculation
        (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 aTokenBalanceBefore = aToken.balanceOf(address(this));

        // Transfer tokens from circle to this contract
        IERC20(token).safeTransferFrom(circle, address(this), amount);

        // Approve Aave pool to spend tokens
        IERC20(token).safeApprove(address(POOL), amount);

        // Deposit to Aave
        POOL.supply(token, amount, address(this), 0);

        // Calculate aTokens received
        uint256 aTokenBalanceAfter = aToken.balanceOf(address(this));
        uint256 aTokensReceived = aTokenBalanceAfter - aTokenBalanceBefore;

        // Update tracking
        deposits[circle][token] += amount;
        aTokenBalances[circle][token] += aTokensReceived;

        emit FundsDeposited(circle, token, amount, aTokensReceived);
    }

    /**
     * @dev Withdraws tokens from Aave
     * @param token The token to withdraw
     * @param amount The amount to withdraw (use type(uint256).max for all)
     * @return actualAmount The actual amount withdrawn
     */
    function withdraw(address token, uint256 amount) external onlyAuthorizedCircle nonReentrant returns (uint256 actualAmount) {
        address circle = msg.sender;
        require(deposits[circle][token] > 0, "No deposits for this token");

        // Get current aToken balance
        (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 currentATokenBalance = aTokenBalances[circle][token];
        
        require(currentATokenBalance > 0, "No aTokens to withdraw");

        uint256 withdrawAmount = amount;
        if (amount == type(uint256).max) {
            withdrawAmount = currentATokenBalance;
        }

        require(withdrawAmount <= currentATokenBalance, "Insufficient aToken balance");

        // Withdraw from Aave
        actualAmount = POOL.withdraw(token, withdrawAmount, circle);

        // Update tracking
        uint256 proportionalDeposit = (deposits[circle][token] * withdrawAmount) / currentATokenBalance;
        deposits[circle][token] -= proportionalDeposit;
        aTokenBalances[circle][token] -= withdrawAmount;

        emit FundsWithdrawn(circle, token, actualAmount, withdrawAmount);
        return actualAmount;
    }

    /**
     * @dev Harvests yield generated from Aave deposits
     * @param token The token to harvest yield for
     * @return yieldAmount The amount of yield harvested
     */
    function harvestYield(address token) external onlyAuthorizedCircle nonReentrant returns (uint256 yieldAmount) {
        address circle = msg.sender;
        require(deposits[circle][token] > 0, "No deposits for this token");

        // Get current aToken balance
        (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 currentATokenBalance = aToken.balanceOf(address(this));
        
        // Calculate yield as difference between current balance and tracked balance
        uint256 trackedBalance = aTokenBalances[circle][token];
        if (currentATokenBalance > trackedBalance) {
            yieldAmount = currentATokenBalance - trackedBalance;
            
            // Withdraw only the yield
            uint256 actualYield = POOL.withdraw(token, yieldAmount, circle);
            
            emit YieldHarvested(circle, token, actualYield);
            return actualYield;
        }
        
        return 0;
    }

    /**
     * @dev Gets the current yield accumulated for a circle's deposits
     * @param circle The lending circle address
     * @param token The token to check yield for
     * @return yieldAmount The current yield amount
     */
    function getCurrentYield(address circle, address token) external view returns (uint256 yieldAmount) {
        if (deposits[circle][token] == 0) {
            return 0;
        }

        // Get current aToken balance
        (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 currentATokenBalance = aToken.balanceOf(address(this));
        
        uint256 trackedBalance = aTokenBalances[circle][token];
        if (currentATokenBalance > trackedBalance) {
            yieldAmount = currentATokenBalance - trackedBalance;
        }
        
        return yieldAmount;
    }

    /**
     * @dev Gets total deposited amount for a circle and token
     * @param circle The lending circle address
     * @param token The token address
     * @return depositAmount The total deposited amount
     */
    function getDeposits(address circle, address token) external view returns (uint256 depositAmount) {
        return deposits[circle][token];
    }

    /**
     * @dev Gets aToken balance for a circle and token
     * @param circle The lending circle address
     * @param token The token address
     * @return aTokenAmount The aToken balance
     */
    function getATokenBalance(address circle, address token) external view returns (uint256 aTokenAmount) {
        return aTokenBalances[circle][token];
    }

    /**
     * @dev Gets the current APY for a token on Aave
     * @param token The token address
     * @return currentLiquidityRate The current liquidity rate (APY)
     */
    function getCurrentAPY(address token) external view returns (uint256 currentLiquidityRate) {
        (, , , , , , , , , , currentLiquidityRate, ) = POOL.getReserveData(token);
        return currentLiquidityRate;
    }

    /**
     * @dev Checks if a token is supported by Aave
     * @param token The token address to check
     * @return isSupported True if the token is supported
     */
    function isTokenSupported(address token) external view returns (bool isSupported) {
        try POOL.getReserveData(token) returns (
            uint256,
            uint128,
            uint128,
            uint128,
            uint128,
            uint128,
            uint40,
            address aTokenAddress,
            address,
            address,
            address,
            uint8
        ) {
            return aTokenAddress != address(0);
        } catch {
            return false;
        }
    }

    /**
     * @dev Emergency function to withdraw all funds from Aave
     * @param token The token to emergency withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner nonReentrant {
        (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        
        if (aTokenBalance > 0) {
            POOL.withdraw(token, type(uint256).max, owner());
        }
    }

    /**
     * @dev Withdraws any stuck tokens from the contract
     * @param token The token to withdraw
     * @param amount The amount to withdraw
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Auto-compound yield back into Aave for a circle
     * @param token The token to compound
     * @return compoundedAmount The amount that was compounded
     */
    function autoCompound(address token) external onlyAuthorizedCircle nonReentrant returns (uint256 compoundedAmount) {
        address circle = msg.sender;
        
        // First harvest the yield
        compoundedAmount = harvestYield(token);
        
        if (compoundedAmount > 0) {
            // Transfer the harvested yield back to this contract
            IERC20(token).safeTransferFrom(circle, address(this), compoundedAmount);
            
            // Approve and deposit back to Aave
            IERC20(token).safeApprove(address(POOL), compoundedAmount);
            
            // Get aToken before deposit
            (, , , , , , , address aTokenAddress, , , , ) = POOL.getReserveData(token);
            IERC20 aToken = IERC20(aTokenAddress);
            uint256 aTokenBalanceBefore = aToken.balanceOf(address(this));
            
            // Re-deposit to Aave
            POOL.supply(token, compoundedAmount, address(this), 0);
            
            // Update tracking
            uint256 aTokenBalanceAfter = aToken.balanceOf(address(this));
            uint256 aTokensReceived = aTokenBalanceAfter - aTokenBalanceBefore;
            
            deposits[circle][token] += compoundedAmount;
            aTokenBalances[circle][token] += aTokensReceived;
        }
        
        return compoundedAmount;
    }

    /**
     * @dev Batch operation to auto-compound multiple tokens
     * @param tokens Array of token addresses to compound
     * @return compoundedAmounts Array of amounts that were compounded
     */
    function batchAutoCompound(address[] calldata tokens) external onlyAuthorizedCircle returns (uint256[] memory compoundedAmounts) {
        compoundedAmounts = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            compoundedAmounts[i] = autoCompound(tokens[i]);
        }
        
        return compoundedAmounts;
    }
}