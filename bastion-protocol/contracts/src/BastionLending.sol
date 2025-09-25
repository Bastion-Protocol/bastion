// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BastionCore.sol";
import "./interfaces/IERC20.sol";

contract BastionLending {
    BastionCore public immutable bastionCore;

    constructor(address coreAddress) {
        require(coreAddress != address(0), "Invalid core address");
        bastionCore = BastionCore(coreAddress);
    }
    enum LoanStatus { Pending, Active, Repaid, Liquidated }

    struct Loan {
        address borrower;
        address lender;
        uint256 principal;
        uint256 collateral;
        uint256 interestRate;
        uint256 duration;
        uint256 startTime;
        LoanStatus status;
        address collateralToken;
        address principalToken;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;
    
    // Events
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateral);
    event LoanFulfilled(uint256 indexed loanId, address indexed lender);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event CollateralLiquidated(uint256 indexed loanId);

    // Security: Reentrancy guard
    bool private locked;
    modifier noReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function createLoanRequest(
        uint256 principal, 
        uint256 collateral, 
        uint256 interestRate, 
        uint256 duration,
        address collateralToken,
        address principalToken
    ) external noReentrant {
        require(principal > 0, "Principal must be > 0");
        require(collateral > 0, "Collateral must be > 0");
        require(interestRate > 0, "Interest rate must be > 0");
        require(duration > 0, "Duration must be > 0");
        
        // Transfer collateral to contract
        IERC20(collateralToken).transferFrom(msg.sender, address(this), collateral);
        
        loanCount++;
        loans[loanCount] = Loan(
            msg.sender, 
            address(0), 
            principal, 
            collateral, 
            interestRate, 
            duration, 
            0, 
            LoanStatus.Pending,
            collateralToken,
            principalToken
        );
        
        emit LoanRequested(loanCount, msg.sender, principal, collateral);
    }

    function fulfillLoan(uint256 loanId) external noReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Pending, "Loan not pending");
        require(loan.borrower != msg.sender, "Cannot lend to self");
        
        // Transfer principal to borrower (or use Nitrolite state channel)
        IERC20(loan.principalToken).transferFrom(msg.sender, loan.borrower, loan.principal);
        
        loan.lender = msg.sender;
        loan.status = LoanStatus.Active;
        loan.startTime = block.timestamp;

        bastionCore.incrementLoanActivity(msg.sender, true, false);
        
        emit LoanFulfilled(loanId, msg.sender);
    }

    function repayLoan(uint256 loanId) external noReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");
        
        uint256 totalRepayment = calculateRepayment(loanId);
        
        // Transfer repayment to lender
        IERC20(loan.principalToken).transferFrom(msg.sender, loan.lender, totalRepayment);
        
        // Return collateral to borrower
        IERC20(loan.collateralToken).transfer(loan.borrower, loan.collateral);
        
        loan.status = LoanStatus.Repaid;
        
        // Update trust score
        bastionCore.incrementLoanActivity(loan.borrower, false, false);
        bastionCore.updateTrustScore(loan.borrower, 100, 0, 0, 0); // Good repayment
        
        emit LoanRepaid(loanId, totalRepayment);
    }

    function liquidateCollateral(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(block.timestamp > loan.startTime + loan.duration, "Loan not expired");
        
        // Transfer collateral to lender
        IERC20(loan.collateralToken).transfer(loan.lender, loan.collateral);
        
        loan.status = LoanStatus.Liquidated;
        
        // Update trust score negatively
        bastionCore.incrementLoanActivity(loan.borrower, false, true);
        bastionCore.updateTrustScore(loan.borrower, 0, 0, 0, 0); // Bad repayment
        
        emit CollateralLiquidated(loanId);
    }

    function calculateRepayment(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 interest = (loan.principal * loan.interestRate) / 10000; // Basis points
        return loan.principal + interest;
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }
}
