// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/BastionCore.sol";
import "../src/BastionLending.sol";
import "../src/BastionCircles.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1000000 * 10**18;
    
    constructor() {
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract BastionTest is Test {
    BastionCore public core;
    BastionLending public lending;
    BastionCircles public circles;
    MockERC20 public token;
    
    address public borrower = address(0x1);
    address public lender = address(0x2);
    address public member1 = address(0x3);
    address public member2 = address(0x4);
    
    function setUp() public {
    core = new BastionCore();
    lending = new BastionLending(address(core));
    circles = new BastionCircles(address(core));
        token = new MockERC20();
        
        // Fund test accounts
        token.mint(borrower, 1000 * 10**18);
        token.mint(lender, 1000 * 10**18);
        token.mint(member1, 1000 * 10**18);
        token.mint(member2, 1000 * 10**18);
    }
    
    function testCreateLoan() public {
        vm.startPrank(borrower);
        token.approve(address(lending), 100 * 10**18);
        
        lending.createLoanRequest(
            50 * 10**18,   // principal
            100 * 10**18,  // collateral
            500,           // 5% interest
            30 days,       // duration
            address(token), // collateral token
            address(token)  // principal token
        );
        
        BastionLending.Loan memory loan = lending.getLoan(1);
        assertEq(loan.borrower, borrower);
        assertEq(loan.principal, 50 * 10**18);
        vm.stopPrank();
    }
    
    function testFulfillLoan() public {
        // First create a loan
        vm.startPrank(borrower);
        token.approve(address(lending), 100 * 10**18);
        lending.createLoanRequest(50 * 10**18, 100 * 10**18, 500, 30 days, address(token), address(token));
        vm.stopPrank();
        
        // Then fulfill it
        vm.startPrank(lender);
        token.approve(address(lending), 50 * 10**18);
        lending.fulfillLoan(1);
        
        BastionLending.Loan memory loan = lending.getLoan(1);
        assertEq(loan.lender, lender);
        assertTrue(loan.status == BastionLending.LoanStatus.Active);
        vm.stopPrank();
    }
    
    function testCreateCircle() public {
        address[] memory initialMembers = new address[](1);
        initialMembers[0] = member1;
        
        vm.startPrank(member1);
        circles.createCircle(100 * 10**18, 200, 4, address(token), initialMembers);
        
        bytes32[] memory circleIds = circles.getAllCircles();
        assertEq(circleIds.length, 1);
        vm.stopPrank();
    }
}