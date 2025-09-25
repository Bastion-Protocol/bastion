// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BastionCore.sol";
import "./interfaces/IERC20.sol";

contract BastionCircles {
    BastionCore public immutable bastionCore;

    constructor(address coreAddress) {
        require(coreAddress != address(0), "Invalid core address");
        bastionCore = BastionCore(coreAddress);
    }
    enum CircleStatus { Active, Completed, Cancelled }

    struct Circle {
        bytes32 id;
        address[] members;
        uint256 monthlyAmount;
        uint256 interestRate;
        uint256 currentCycle;
        uint256 maxMembers;
        CircleStatus status;
        address token;
        mapping(address => uint256) stakes;
        mapping(uint256 => address) cycleWinners;
        mapping(uint256 => mapping(address => uint256)) cycleBids;
        mapping(address => bool) hasContributed;
    }

    struct CircleInfo {
        bytes32 id;
        address[] members;
        uint256 monthlyAmount;
        uint256 interestRate;
        uint256 currentCycle;
        uint256 maxMembers;
        CircleStatus status;
        address token;
    }

    mapping(bytes32 => Circle) public circles;
    bytes32[] public circleIds;
    
    // Events
    event CircleCreated(bytes32 indexed circleId, address indexed creator, uint256 monthlyAmount);
    event MemberJoined(bytes32 indexed circleId, address indexed member);
    event BidSubmitted(bytes32 indexed circleId, uint256 cycle, address indexed bidder, uint256 amount);
    event FundsDistributed(bytes32 indexed circleId, uint256 cycle, address indexed winner, uint256 amount);

    // Security: Reentrancy guard
    bool private locked;
    modifier noReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function createCircle(
        uint256 monthlyAmount, 
        uint256 interestRate, 
        uint256 maxMembers,
        address token,
        address[] memory initialMembers
    ) external noReentrant {
        require(monthlyAmount > 0, "Monthly amount must be > 0");
        require(maxMembers >= 2, "Must have at least 2 members");
        require(initialMembers.length <= maxMembers, "Too many initial members");
        
        bytes32 circleId = keccak256(abi.encodePacked(msg.sender, block.timestamp, circleIds.length));
        Circle storage circle = circles[circleId];
        
        circle.id = circleId;
        circle.monthlyAmount = monthlyAmount;
        circle.interestRate = interestRate;
        circle.maxMembers = maxMembers;
        circle.status = CircleStatus.Active;
        circle.token = token;
        circle.currentCycle = 0;
        
        // Add creator and initial members
        circle.members.push(msg.sender);
        bastionCore.incrementCircleActivity(msg.sender);
        for (uint i = 0; i < initialMembers.length; i++) {
            if (initialMembers[i] != msg.sender) {
                circle.members.push(initialMembers[i]);
                bastionCore.incrementCircleActivity(initialMembers[i]);
            }
        }
        
        circleIds.push(circleId);
        
        emit CircleCreated(circleId, msg.sender, monthlyAmount);
    }

    function joinCircle(bytes32 circleId, uint256 stake) external noReentrant {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        require(circle.members.length < circle.maxMembers, "Circle is full");
        
        // Check if already a member
        for (uint i = 0; i < circle.members.length; i++) {
            require(circle.members[i] != msg.sender, "Already a member");
        }
        
        // Transfer stake
        IERC20(circle.token).transferFrom(msg.sender, address(this), stake);
        
        circle.members.push(msg.sender);
        circle.stakes[msg.sender] = stake;
        
        // Update trust score for participation
        bastionCore.incrementCircleActivity(msg.sender);
        bastionCore.updateTrustScore(msg.sender, 0, 10, 0, 5);
        
        emit MemberJoined(circleId, msg.sender);
    }

    function submitBid(bytes32 circleId, uint256 amount) external {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        require(isMember(circleId, msg.sender), "Not a member");
        require(amount <= circle.monthlyAmount * circle.members.length, "Bid too high");
        
        circle.cycleBids[circle.currentCycle][msg.sender] = amount;
        
        emit BidSubmitted(circleId, circle.currentCycle, msg.sender, amount);
    }

    function distributeFunds(bytes32 circleId) external noReentrant {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        require(isMember(circleId, msg.sender), "Not a member");
        
        // Find winner (lowest bid wins)
        address winner = findCycleWinner(circleId, circle.currentCycle);
        require(winner != address(0), "No winner found");
        
        uint256 totalPool = circle.monthlyAmount * circle.members.length;
        
        // Transfer funds to winner
        IERC20(circle.token).transfer(winner, totalPool);
        
        circle.cycleWinners[circle.currentCycle] = winner;
        circle.currentCycle++;
        
        // Update trust scores for all participants
        for (uint i = 0; i < circle.members.length; i++) {
            bastionCore.updateTrustScore(circle.members[i], 0, 20, 0, 0);
        }
        
        // Check if circle is complete
        if (circle.currentCycle >= circle.members.length) {
            circle.status = CircleStatus.Completed;
        }
        
        emit FundsDistributed(circleId, circle.currentCycle - 1, winner, totalPool);
    }

    function findCycleWinner(bytes32 circleId, uint256 cycle) internal view returns (address) {
        Circle storage circle = circles[circleId];
        address winner = address(0);
        uint256 lowestBid = type(uint256).max;
        
        for (uint i = 0; i < circle.members.length; i++) {
            address member = circle.members[i];
            uint256 bid = circle.cycleBids[cycle][member];
            
            if (bid > 0 && bid < lowestBid) {
                lowestBid = bid;
                winner = member;
            }
        }
        
        return winner;
    }

    function isMember(bytes32 circleId, address user) public view returns (bool) {
        Circle storage circle = circles[circleId];
        for (uint i = 0; i < circle.members.length; i++) {
            if (circle.members[i] == user) {
                return true;
            }
        }
        return false;
    }

    function getCircleInfo(bytes32 circleId) external view returns (CircleInfo memory) {
        Circle storage circle = circles[circleId];
        return CircleInfo({
            id: circle.id,
            members: circle.members,
            monthlyAmount: circle.monthlyAmount,
            interestRate: circle.interestRate,
            currentCycle: circle.currentCycle,
            maxMembers: circle.maxMembers,
            status: circle.status,
            token: circle.token
        });
    }

    function getAllCircles() external view returns (bytes32[] memory) {
        return circleIds;
    }
}
