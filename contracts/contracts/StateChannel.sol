// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC7824.sol";

/**
 * @title StateChannel
 * @dev Implementation of ERC-7824 state channels for gasless transactions
 * Integrates with Yellow Network's Nitrolite Protocol for fast, low-cost transactions
 */
contract StateChannel is IERC7824, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Channel storage
    mapping(bytes32 => ChannelData) public channels;
    mapping(bytes32 => uint256) public disputeTimeouts;
    mapping(bytes32 => bool) public inDispute;

    // Constants
    uint256 public constant DISPUTE_TIMEOUT = 1 days;
    uint256 public constant MIN_TIMEOUT = 1 hours;
    uint256 public constant MAX_TIMEOUT = 30 days;

    // Yellow Network integration
    address public yellowNetworkOracle;
    mapping(address => bool) public authorizedRelayers;

    // Fees
    uint256 public channelFee = 0.001 ether; // Fee for opening channel
    uint256 public relayerFee = 0.0001 ether; // Fee for relayed transactions

    event YellowNetworkOracleUpdated(address indexed newOracle);
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event FeesUpdated(uint256 channelFee, uint256 relayerFee);

    modifier onlyParticipant(bytes32 channelId) {
        ChannelData memory channel = channels[channelId];
        require(
            msg.sender == channel.participant1 || msg.sender == channel.participant2,
            "Not a channel participant"
        );
        _;
    }

    modifier onlyActive(bytes32 channelId) {
        require(channels[channelId].isActive, "Channel not active");
        _;
    }

    modifier notInDispute(bytes32 channelId) {
        require(!inDispute[channelId], "Channel in dispute");
        _;
    }

    constructor(address _yellowNetworkOracle) {
        yellowNetworkOracle = _yellowNetworkOracle;
    }

    /**
     * @dev Opens a new state channel between two participants
     */
    function openChannel(
        address participant1,
        address participant2,
        uint256 amount1,
        uint256 amount2,
        uint256 timeout
    ) external payable override nonReentrant returns (bytes32 channelId) {
        require(participant1 != participant2, "Participants must be different");
        require(participant1 != address(0) && participant2 != address(0), "Invalid participants");
        require(timeout >= MIN_TIMEOUT && timeout <= MAX_TIMEOUT, "Invalid timeout");
        require(msg.value >= amount1 + amount2 + channelFee, "Insufficient funds");

        channelId = keccak256(
            abi.encodePacked(participant1, participant2, block.timestamp, block.number)
        );

        channels[channelId] = ChannelData({
            participant1: participant1,
            participant2: participant2,
            balance1: amount1,
            balance2: amount2,
            nonce: 0,
            timeout: timeout,
            isActive: true
        });

        emit ChannelOpened(channelId, participant1, participant2, amount1, amount2);
        return channelId;
    }

    /**
     * @dev Updates channel state with new balances (off-chain transaction processing)
     */
    function updateChannel(StateUpdate calldata update) external override onlyActive(update.channelId) notInDispute(update.channelId) {
        ChannelData storage channel = channels[update.channelId];
        
        require(update.nonce > channel.nonce, "Invalid nonce");
        require(update.balance1 + update.balance2 == channel.balance1 + channel.balance2, "Invalid balance sum");

        // Verify signatures from both participants
        bytes32 messageHash = _getStateUpdateHash(update);
        require(
            _isValidSignature(messageHash, update.signature1, channel.participant1),
            "Invalid signature from participant1"
        );
        require(
            _isValidSignature(messageHash, update.signature2, channel.participant2),
            "Invalid signature from participant2"
        );

        // Update state
        channel.balance1 = update.balance1;
        channel.balance2 = update.balance2;
        channel.nonce = update.nonce;

        emit ChannelUpdated(update.channelId, update.nonce, update.balance1, update.balance2);
    }

    /**
     * @dev Closes channel with final state update
     */
    function closeChannel(bytes32 channelId, StateUpdate calldata finalUpdate) 
        external 
        override 
        onlyParticipant(channelId) 
        onlyActive(channelId) 
        notInDispute(channelId) 
        nonReentrant 
    {
        // Update to final state if provided
        if (finalUpdate.nonce > 0) {
            updateChannel(finalUpdate);
        }

        ChannelData storage channel = channels[channelId];
        channel.isActive = false;

        // Transfer final balances
        if (channel.balance1 > 0) {
            payable(channel.participant1).transfer(channel.balance1);
        }
        if (channel.balance2 > 0) {
            payable(channel.participant2).transfer(channel.balance2);
        }

        emit ChannelClosed(channelId, channel.balance1, channel.balance2);
    }

    /**
     * @dev Initiates a dispute for a channel
     */
    function disputeChannel(bytes32 channelId) 
        external 
        override 
        onlyParticipant(channelId) 
        onlyActive(channelId) 
    {
        require(!inDispute[channelId], "Already in dispute");
        
        inDispute[channelId] = true;
        disputeTimeouts[channelId] = block.timestamp + DISPUTE_TIMEOUT;

        emit ChannelDisputed(channelId, msg.sender, disputeTimeouts[channelId]);
    }

    /**
     * @dev Resolves a dispute with the latest valid state
     */
    function resolveDispute(bytes32 channelId, StateUpdate calldata update) 
        external 
        override 
        onlyParticipant(channelId) 
    {
        require(inDispute[channelId], "No active dispute");
        require(block.timestamp <= disputeTimeouts[channelId], "Dispute timeout exceeded");

        // Validate the state update
        updateChannel(update);
        
        inDispute[channelId] = false;
        delete disputeTimeouts[channelId];
    }

    /**
     * @dev Withdraws funds after dispute timeout
     */
    function withdrawTimelock(bytes32 channelId) 
        external 
        override 
        onlyParticipant(channelId) 
        nonReentrant 
    {
        require(inDispute[channelId], "No active dispute");
        require(block.timestamp > disputeTimeouts[channelId], "Dispute period not ended");

        ChannelData storage channel = channels[channelId];
        channel.isActive = false;
        inDispute[channelId] = false;

        // Equal split if dispute couldn't be resolved
        uint256 totalBalance = channel.balance1 + channel.balance2;
        uint256 splitAmount = totalBalance / 2;

        payable(channel.participant1).transfer(splitAmount);
        payable(channel.participant2).transfer(totalBalance - splitAmount);

        emit ChannelClosed(channelId, splitAmount, totalBalance - splitAmount);
    }

    /**
     * @dev Gets channel data
     */
    function getChannel(bytes32 channelId) external view override returns (ChannelData memory) {
        return channels[channelId];
    }

    /**
     * @dev Validates signature for state update
     */
    function isValidSignature(
        bytes32 channelId,
        uint256 nonce,
        uint256 balance1,
        uint256 balance2,
        bytes calldata signature,
        address signer
    ) external view override returns (bool) {
        StateUpdate memory update = StateUpdate({
            channelId: channelId,
            nonce: nonce,
            balance1: balance1,
            balance2: balance2,
            signature1: new bytes(0),
            signature2: new bytes(0)
        });
        
        bytes32 messageHash = _getStateUpdateHash(update);
        return _isValidSignature(messageHash, signature, signer);
    }

    // Yellow Network integration functions
    
    /**
     * @dev Sets Yellow Network oracle address
     */
    function setYellowNetworkOracle(address _oracle) external onlyOwner {
        yellowNetworkOracle = _oracle;
        emit YellowNetworkOracleUpdated(_oracle);
    }

    /**
     * @dev Authorizes/deauthorizes relayers for gasless transactions
     */
    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }

    /**
     * @dev Updates fees
     */
    function updateFees(uint256 _channelFee, uint256 _relayerFee) external onlyOwner {
        channelFee = _channelFee;
        relayerFee = _relayerFee;
        emit FeesUpdated(_channelFee, _relayerFee);
    }

    /**
     * @dev Processes relayed transaction (gasless)
     */
    function relayTransaction(
        StateUpdate calldata update,
        address relayer,
        bytes calldata relayerSignature
    ) external {
        require(authorizedRelayers[relayer], "Unauthorized relayer");
        
        // Verify relayer signature
        bytes32 relayHash = keccak256(abi.encodePacked(update.channelId, update.nonce, relayer));
        require(_isValidSignature(relayHash, relayerSignature, relayer), "Invalid relayer signature");

        // Process the update
        updateChannel(update);

        // Pay relayer fee
        payable(relayer).transfer(relayerFee);
    }

    // Internal functions

    function _getStateUpdateHash(StateUpdate memory update) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            update.channelId,
            update.nonce,
            update.balance1,
            update.balance2
        ));
    }

    function _isValidSignature(bytes32 messageHash, bytes memory signature, address signer) internal pure returns (bool) {
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        return ethSignedMessageHash.recover(signature) == signer;
    }

    /**
     * @dev Withdraws contract fees (only owner)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }

    /**
     * @dev Emergency function to handle stuck funds
     */
    function emergencyWithdraw(bytes32 channelId) external onlyOwner {
        ChannelData storage channel = channels[channelId];
        require(!channel.isActive, "Channel still active");
        
        uint256 totalBalance = channel.balance1 + channel.balance2;
        if (totalBalance > 0) {
            payable(channel.participant1).transfer(channel.balance1);
            payable(channel.participant2).transfer(channel.balance2);
            channel.balance1 = 0;
            channel.balance2 = 0;
        }
    }
}