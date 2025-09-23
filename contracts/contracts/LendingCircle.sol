// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./StateChannel.sol";
import "./AaveIntegration.sol";
import "./SocialVerification.sol";

/**
 * @title LendingCircle
 * @dev Core contract implementing Bastion Protocol lending circles with state channels
 */
contract LendingCircle is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant CIRCLE_ADMIN_ROLE = keccak256("CIRCLE_ADMIN_ROLE");
    bytes32 public constant VERIFIED_MEMBER_ROLE = keccak256("VERIFIED_MEMBER_ROLE");

    struct Circle {
        uint256 id;
        address creator;
        string name;
        uint256 contributionAmount;
        uint256 payoutAmount;
        uint256 duration;
        uint256 maxMembers;
        uint256 currentMembers;
        CircleStatus status;
        uint256 createdAt;
        uint256 startedAt;
        uint256 currentRound;
        uint256 totalRounds;
        address token; // ERC20 token address (address(0) for ETH)
        bool isPrivate;
        uint256 minReputationScore;
    }

    struct Member {
        address memberAddress;
        uint256 joinedAt;
        uint256 reputationScore;
        bool hasContributed;
        bool hasReceivedPayout;
        uint256 roundReceived;
        MemberStatus status;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
        string reason;
        bool isActive;
    }

    struct RoundInfo {
        uint256 roundNumber;
        address recipient;
        uint256 payoutAmount;
        uint256 contributionsReceived;
        uint256 timestamp;
        bool isCompleted;
        mapping(address => bool) hasContributed;
    }

    enum CircleStatus {
        Created,
        Recruiting,
        Active,
        Completed,
        Cancelled
    }

    enum MemberStatus {
        Invited,
        Joined,
        Verified,
        Active,
        Defaulted,
        Completed
    }

    // State variables
    mapping(uint256 => Circle) public circles;
    mapping(uint256 => mapping(address => Member)) public circleMembers;
    mapping(uint256 => address[]) public circleMembersList;
    mapping(uint256 => mapping(uint256 => RoundInfo)) public circleRounds;
    mapping(uint256 => mapping(uint256 => Bid[])) public roundBids;
    mapping(uint256 => mapping(address => bytes32)) public memberStateChannels;
    
    uint256 public nextCircleId = 1;
    uint256 public platformFeePercentage = 250; // 2.5%
    address public feeRecipient;
    
    // Contract references
    StateChannel public stateChannelContract;
    AaveIntegration public aaveIntegration;
    SocialVerification public socialVerification;

    // Events
    event CircleCreated(
        uint256 indexed circleId,
        address indexed creator,
        string name,
        uint256 contributionAmount,
        uint256 maxMembers
    );

    event MemberInvited(uint256 indexed circleId, address indexed member);
    event MemberJoined(uint256 indexed circleId, address indexed member);
    event MemberVerified(uint256 indexed circleId, address indexed member);
    
    event CircleStarted(uint256 indexed circleId, uint256 startTime);
    event RoundStarted(uint256 indexed circleId, uint256 roundNumber, address recipient);
    event ContributionMade(uint256 indexed circleId, uint256 roundNumber, address contributor, uint256 amount);
    event PayoutDistributed(uint256 indexed circleId, uint256 roundNumber, address recipient, uint256 amount);
    
    event BidPlaced(uint256 indexed circleId, uint256 roundNumber, address bidder, uint256 amount);
    event BidAccepted(uint256 indexed circleId, uint256 roundNumber, address winner, uint256 amount);
    
    event CircleCompleted(uint256 indexed circleId);
    event CircleCancelled(uint256 indexed circleId, string reason);
    
    event StateChannelCreated(uint256 indexed circleId, address member, bytes32 channelId);
    event YieldDeposited(uint256 indexed circleId, uint256 amount);
    event YieldWithdrawn(uint256 indexed circleId, uint256 amount);

    modifier onlyCircleAdmin(uint256 circleId) {
        require(
            circles[circleId].creator == msg.sender || hasRole(CIRCLE_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        _;
    }

    modifier onlyCircleMember(uint256 circleId) {
        require(circleMembers[circleId][msg.sender].memberAddress != address(0), "Not a member");
        _;
    }

    modifier circleExists(uint256 circleId) {
        require(circleId > 0 && circleId < nextCircleId, "Circle does not exist");
        _;
    }

    constructor(
        address _stateChannelContract,
        address _aaveIntegration,
        address _socialVerification,
        address _feeRecipient
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        stateChannelContract = StateChannel(_stateChannelContract);
        aaveIntegration = AaveIntegration(_aaveIntegration);
        socialVerification = SocialVerification(_socialVerification);
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Creates a new lending circle
     */
    function createCircle(
        string memory name,
        uint256 contributionAmount,
        uint256 payoutAmount,
        uint256 duration,
        uint256 maxMembers,
        address token,
        bool isPrivate,
        uint256 minReputationScore
    ) external returns (uint256 circleId) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(contributionAmount > 0, "Contribution amount must be positive");
        require(payoutAmount >= contributionAmount, "Payout must be >= contribution");
        require(maxMembers >= 3 && maxMembers <= 20, "Invalid member count");
        require(duration >= 1 days && duration <= 365 days, "Invalid duration");

        circleId = nextCircleId++;

        circles[circleId] = Circle({
            id: circleId,
            creator: msg.sender,
            name: name,
            contributionAmount: contributionAmount,
            payoutAmount: payoutAmount,
            duration: duration,
            maxMembers: maxMembers,
            currentMembers: 0,
            status: CircleStatus.Created,
            createdAt: block.timestamp,
            startedAt: 0,
            currentRound: 0,
            totalRounds: maxMembers,
            token: token,
            isPrivate: isPrivate,
            minReputationScore: minReputationScore
        });

        // Creator automatically joins as first member
        _addMember(circleId, msg.sender);
        
        emit CircleCreated(circleId, msg.sender, name, contributionAmount, maxMembers);
        return circleId;
    }

    /**
     * @dev Invites a member to join the circle
     */
    function inviteMember(uint256 circleId, address member) 
        external 
        circleExists(circleId) 
        onlyCircleAdmin(circleId) 
    {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Created || circle.status == CircleStatus.Recruiting, "Invalid circle status");
        require(circle.currentMembers < circle.maxMembers, "Circle is full");
        require(circleMembers[circleId][member].memberAddress == address(0), "Already invited");

        // Check reputation requirement
        if (circle.minReputationScore > 0) {
            uint256 reputation = socialVerification.getReputationScore(member);
            require(reputation >= circle.minReputationScore, "Insufficient reputation");
        }

        circleMembers[circleId][member] = Member({
            memberAddress: member,
            joinedAt: 0,
            reputationScore: socialVerification.getReputationScore(member),
            hasContributed: false,
            hasReceivedPayout: false,
            roundReceived: 0,
            status: MemberStatus.Invited
        });

        emit MemberInvited(circleId, member);
    }

    /**
     * @dev Joins a circle (public circles) or accepts invitation (private circles)
     */
    function joinCircle(uint256 circleId) external payable circleExists(circleId) nonReentrant {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Created || circle.status == CircleStatus.Recruiting, "Invalid circle status");
        require(circle.currentMembers < circle.maxMembers, "Circle is full");

        if (circle.isPrivate) {
            require(circleMembers[circleId][msg.sender].status == MemberStatus.Invited, "Not invited");
        } else {
            require(circleMembers[circleId][msg.sender].memberAddress == address(0), "Already a member");
            // Check reputation for public circles
            if (circle.minReputationScore > 0) {
                uint256 reputation = socialVerification.getReputationScore(msg.sender);
                require(reputation >= circle.minReputationScore, "Insufficient reputation");
            }
        }

        if (circleMembers[circleId][msg.sender].memberAddress == address(0)) {
            _addMember(circleId, msg.sender);
        } else {
            circleMembers[circleId][msg.sender].joinedAt = block.timestamp;
            circleMembers[circleId][msg.sender].status = MemberStatus.Joined;
        }

        // Create state channel for gasless transactions
        bytes32 channelId = stateChannelContract.openChannel{value: msg.value}(
            msg.sender,
            address(this),
            circle.contributionAmount,
            0,
            circle.duration * circle.maxMembers
        );
        memberStateChannels[circleId][msg.sender] = channelId;

        emit MemberJoined(circleId, msg.sender);
        emit StateChannelCreated(circleId, msg.sender, channelId);

        // Start circle if full
        if (circle.currentMembers == circle.maxMembers) {
            _startCircle(circleId);
        }
    }

    /**
     * @dev Verifies a member through social verification
     */
    function verifyMember(uint256 circleId, address member) 
        external 
        circleExists(circleId) 
        onlyCircleAdmin(circleId) 
    {
        require(circleMembers[circleId][member].status == MemberStatus.Joined, "Member not joined");
        require(socialVerification.isVerified(member), "Member not socially verified");

        circleMembers[circleId][member].status = MemberStatus.Verified;
        _grantRole(VERIFIED_MEMBER_ROLE, member);

        emit MemberVerified(circleId, member);
    }

    /**
     * @dev Starts the circle (manual start by admin or automatic when full)
     */
    function startCircle(uint256 circleId) external circleExists(circleId) onlyCircleAdmin(circleId) {
        _startCircle(circleId);
    }

    /**
     * @dev Places a bid for the current round
     */
    function placeBid(uint256 circleId, uint256 bidAmount, string memory reason) 
        external 
        circleExists(circleId) 
        onlyCircleMember(circleId) 
    {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        require(!circleMembers[circleId][msg.sender].hasReceivedPayout, "Already received payout");
        require(bidAmount <= circle.payoutAmount, "Bid exceeds maximum");

        uint256 currentRound = circle.currentRound;
        roundBids[circleId][currentRound].push(Bid({
            bidder: msg.sender,
            amount: bidAmount,
            timestamp: block.timestamp,
            reason: reason,
            isActive: true
        }));

        emit BidPlaced(circleId, currentRound, msg.sender, bidAmount);
    }

    /**
     * @dev Selects the winning bid for the current round
     */
    function selectWinningBid(uint256 circleId, uint256 bidIndex) 
        external 
        circleExists(circleId) 
        onlyCircleAdmin(circleId) 
    {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        
        uint256 currentRound = circle.currentRound;
        require(bidIndex < roundBids[circleId][currentRound].length, "Invalid bid index");
        
        Bid storage winningBid = roundBids[circleId][currentRound][bidIndex];
        require(winningBid.isActive, "Bid not active");

        address winner = winningBid.bidder;
        circleRounds[circleId][currentRound].recipient = winner;
        circleMembers[circleId][winner].hasReceivedPayout = true;
        circleMembers[circleId][winner].roundReceived = currentRound;

        emit BidAccepted(circleId, currentRound, winner, winningBid.amount);
        emit RoundStarted(circleId, currentRound, winner);
    }

    /**
     * @dev Makes a contribution to the current round
     */
    function contribute(uint256 circleId) external payable circleExists(circleId) onlyCircleMember(circleId) nonReentrant {
        Circle storage circle = circles[circleId];
        require(circle.status == CircleStatus.Active, "Circle not active");
        
        uint256 currentRound = circle.currentRound;
        RoundInfo storage round = circleRounds[circleId][currentRound];
        require(!round.hasContributed[msg.sender], "Already contributed this round");
        require(round.recipient != address(0), "No recipient selected");

        uint256 contributionAmount = circle.contributionAmount;
        
        if (circle.token == address(0)) {
            require(msg.value >= contributionAmount, "Insufficient ETH");
        } else {
            IERC20(circle.token).safeTransferFrom(msg.sender, address(this), contributionAmount);
        }

        round.hasContributed[msg.sender] = true;
        round.contributionsReceived += contributionAmount;
        circleMembers[circleId][msg.sender].hasContributed = true;

        emit ContributionMade(circleId, currentRound, msg.sender, contributionAmount);

        // Check if round is complete
        if (round.contributionsReceived >= contributionAmount * circle.currentMembers) {
            _completeRound(circleId);
        }
    }

    /**
     * @dev Distributes payout to round winner
     */
    function distributePayout(uint256 circleId) external circleExists(circleId) onlyCircleAdmin(circleId) nonReentrant {
        Circle storage circle = circles[circleId];
        uint256 currentRound = circle.currentRound;
        RoundInfo storage round = circleRounds[circleId][currentRound];
        
        require(round.recipient != address(0), "No recipient");
        require(!round.isCompleted, "Round already completed");
        require(round.contributionsReceived >= circle.contributionAmount * circle.currentMembers, "Insufficient contributions");

        uint256 totalPayout = round.contributionsReceived;
        uint256 fee = (totalPayout * platformFeePercentage) / 10000;
        uint256 netPayout = totalPayout - fee;

        // Transfer payout
        if (circle.token == address(0)) {
            payable(round.recipient).transfer(netPayout);
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
        } else {
            IERC20(circle.token).safeTransfer(round.recipient, netPayout);
            if (fee > 0) {
                IERC20(circle.token).safeTransfer(feeRecipient, fee);
            }
        }

        round.isCompleted = true;
        round.payoutAmount = netPayout;
        round.timestamp = block.timestamp;

        emit PayoutDistributed(circleId, currentRound, round.recipient, netPayout);

        // Move to next round or complete circle
        if (currentRound >= circle.totalRounds - 1) {
            _completeCircle(circleId);
        } else {
            circle.currentRound++;
        }
    }

    /**
     * @dev Deposits idle funds to Aave for yield generation
     */
    function depositToAave(uint256 circleId, uint256 amount) external circleExists(circleId) onlyCircleAdmin(circleId) {
        Circle storage circle = circles[circleId];
        require(circle.token != address(0), "ETH not supported for Aave");
        
        IERC20(circle.token).safeApprove(address(aaveIntegration), amount);
        aaveIntegration.deposit(circle.token, amount);
        
        emit YieldDeposited(circleId, amount);
    }

    /**
     * @dev Withdraws funds from Aave
     */
    function withdrawFromAave(uint256 circleId, uint256 amount) external circleExists(circleId) onlyCircleAdmin(circleId) {
        Circle storage circle = circles[circleId];
        require(circle.token != address(0), "ETH not supported for Aave");
        
        uint256 withdrawn = aaveIntegration.withdraw(circle.token, amount);
        
        emit YieldWithdrawn(circleId, withdrawn);
    }

    // Internal functions

    function _addMember(uint256 circleId, address member) internal {
        circles[circleId].currentMembers++;
        circleMembersList[circleId].push(member);
        
        if (circleMembers[circleId][member].memberAddress == address(0)) {
            circleMembers[circleId][member] = Member({
                memberAddress: member,
                joinedAt: block.timestamp,
                reputationScore: socialVerification.getReputationScore(member),
                hasContributed: false,
                hasReceivedPayout: false,
                roundReceived: 0,
                status: MemberStatus.Joined
            });
        }
    }

    function _startCircle(uint256 circleId) internal {
        Circle storage circle = circles[circleId];
        require(circle.currentMembers >= 3, "Need at least 3 members");
        require(circle.status == CircleStatus.Created || circle.status == CircleStatus.Recruiting, "Invalid status");

        circle.status = CircleStatus.Active;
        circle.startedAt = block.timestamp;
        circle.currentRound = 1;

        // Initialize first round
        circleRounds[circleId][1].roundNumber = 1;
        circleRounds[circleId][1].timestamp = block.timestamp;

        emit CircleStarted(circleId, block.timestamp);
    }

    function _completeRound(uint256 circleId) internal {
        // Round completion logic is handled in distributePayout
        // This function can be extended for additional round completion logic
    }

    function _completeCircle(uint256 circleId) internal {
        circles[circleId].status = CircleStatus.Completed;
        
        // Update member statuses
        address[] memory members = circleMembersList[circleId];
        for (uint256 i = 0; i < members.length; i++) {
            circleMembers[circleId][members[i]].status = MemberStatus.Completed;
            // Update reputation scores
            socialVerification.updateReputationScore(members[i], 10); // Bonus for completion
        }

        emit CircleCompleted(circleId);
    }

    // View functions

    function getCircle(uint256 circleId) external view returns (Circle memory) {
        return circles[circleId];
    }

    function getCircleMembers(uint256 circleId) external view returns (address[] memory) {
        return circleMembersList[circleId];
    }

    function getMember(uint256 circleId, address member) external view returns (Member memory) {
        return circleMembers[circleId][member];
    }

    function getRoundBids(uint256 circleId, uint256 roundNumber) external view returns (Bid[] memory) {
        return roundBids[circleId][roundNumber];
    }

    function getCurrentRoundInfo(uint256 circleId) external view returns (uint256 roundNumber, address recipient, uint256 contributionsReceived) {
        uint256 currentRound = circles[circleId].currentRound;
        RoundInfo storage round = circleRounds[circleId][currentRound];
        return (currentRound, round.recipient, round.contributionsReceived);
    }

    // Admin functions

    function setPlatformFee(uint256 newFeePercentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = newFeePercentage;
    }

    function setFeeRecipient(address newFeeRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeRecipient = newFeeRecipient;
    }

    function cancelCircle(uint256 circleId, string memory reason) external circleExists(circleId) onlyCircleAdmin(circleId) {
        Circle storage circle = circles[circleId];
        require(circle.status != CircleStatus.Completed, "Circle already completed");
        
        circle.status = CircleStatus.Cancelled;
        
        // Refund members if circle was active
        if (circle.status == CircleStatus.Active) {
            // Implementation for refunding contributions
        }

        emit CircleCancelled(circleId, reason);
    }
}