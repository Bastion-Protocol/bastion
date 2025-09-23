// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SocialVerification
 * @dev Manages social verification and reputation scoring for Bastion Protocol
 */
contract SocialVerification is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    struct VerificationMethod {
        string name;
        uint256 scoreWeight;
        bool isActive;
        address oracle; // Oracle for off-chain verification
    }

    struct UserVerification {
        bool isVerified;
        uint256 verificationTimestamp;
        uint256 reputationScore;
        mapping(string => bool) methodsCompleted;
        mapping(address => bool) attestedBy;
        uint256 attestationCount;
        uint256 defaultCount;
        uint256 successfulCircles;
        bool isBanned;
        uint256 banExpiry;
    }

    struct Attestation {
        address attestor;
        address user;
        string method;
        bool isPositive;
        uint256 timestamp;
        string ipfsHash; // For storing additional verification data
    }

    struct TelegramVerification {
        uint256 telegramId;
        string username;
        bool isVerified;
        uint256 verificationTime;
        bytes signature; // Signed by Telegram bot
    }

    // State variables
    mapping(address => UserVerification) public userVerifications;
    mapping(string => VerificationMethod) public verificationMethods;
    mapping(address => TelegramVerification) public telegramVerifications;
    mapping(uint256 => address) public telegramIdToAddress;
    
    Attestation[] public attestations;
    string[] public methodNames;
    
    uint256 public minVerificationScore = 100;
    uint256 public maxReputationScore = 1000;
    address public telegramBotSigner;

    // Events
    event VerificationMethodAdded(string name, uint256 scoreWeight, address oracle);
    event VerificationMethodUpdated(string name, uint256 scoreWeight, bool isActive);
    event UserVerified(address indexed user, string method, uint256 newScore);
    event AttestationCreated(
        address indexed attestor,
        address indexed user,
        string method,
        bool isPositive,
        string ipfsHash
    );
    event ReputationScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event TelegramVerified(address indexed user, uint256 telegramId, string username);
    event UserBanned(address indexed user, uint256 banExpiry, string reason);
    event UserUnbanned(address indexed user);

    modifier notBanned(address user) {
        require(!userVerifications[user].isBanned || block.timestamp > userVerifications[user].banExpiry, "User is banned");
        _;
    }

    constructor(address _telegramBotSigner) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(ATTESTOR_ROLE, msg.sender);
        
        telegramBotSigner = _telegramBotSigner;
        
        // Initialize default verification methods
        _addVerificationMethod("telegram", 30, address(0));
        _addVerificationMethod("github", 25, address(0));
        _addVerificationMethod("twitter", 20, address(0));
        _addVerificationMethod("linkedin", 25, address(0));
        _addVerificationMethod("kyc", 100, address(0));
    }

    /**
     * @dev Adds a new verification method
     */
    function addVerificationMethod(string memory name, uint256 scoreWeight, address oracle) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _addVerificationMethod(name, scoreWeight, oracle);
    }

    function _addVerificationMethod(string memory name, uint256 scoreWeight, address oracle) internal {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(scoreWeight > 0, "Score weight must be positive");
        require(!verificationMethods[name].isActive, "Method already exists");

        verificationMethods[name] = VerificationMethod({
            name: name,
            scoreWeight: scoreWeight,
            isActive: true,
            oracle: oracle
        });
        
        methodNames.push(name);
        emit VerificationMethodAdded(name, scoreWeight, oracle);
    }

    /**
     * @dev Updates an existing verification method
     */
    function updateVerificationMethod(string memory name, uint256 scoreWeight, bool isActive, address oracle)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(verificationMethods[name].scoreWeight > 0, "Method does not exist");
        
        verificationMethods[name].scoreWeight = scoreWeight;
        verificationMethods[name].isActive = isActive;
        verificationMethods[name].oracle = oracle;
        
        emit VerificationMethodUpdated(name, scoreWeight, isActive);
    }

    /**
     * @dev Verifies a user through a specific method
     */
    function verifyUser(address user, string memory method) 
        external 
        onlyRole(VERIFIER_ROLE) 
        notBanned(user)
    {
        require(verificationMethods[method].isActive, "Method not active");
        require(!userVerifications[user].methodsCompleted[method], "Already verified with this method");

        userVerifications[user].methodsCompleted[method] = true;
        
        uint256 scoreIncrease = verificationMethods[method].scoreWeight;
        _updateReputationScore(user, scoreIncrease, true);

        // Check if user meets minimum verification requirements
        if (userVerifications[user].reputationScore >= minVerificationScore && !userVerifications[user].isVerified) {
            userVerifications[user].isVerified = true;
            userVerifications[user].verificationTimestamp = block.timestamp;
        }

        emit UserVerified(user, method, userVerifications[user].reputationScore);
    }

    /**
     * @dev Creates an attestation from one user to another
     */
    function createAttestation(
        address user,
        string memory method,
        bool isPositive,
        string memory ipfsHash
    ) external onlyRole(ATTESTOR_ROLE) notBanned(msg.sender) notBanned(user) {
        require(userVerifications[msg.sender].isVerified, "Attestor must be verified");
        require(!userVerifications[user].attestedBy[msg.sender], "Already attested by this user");
        require(bytes(method).length > 0, "Method cannot be empty");

        userVerifications[user].attestedBy[msg.sender] = true;
        userVerifications[user].attestationCount++;

        attestations.push(Attestation({
            attestor: msg.sender,
            user: user,
            method: method,
            isPositive: isPositive,
            timestamp: block.timestamp,
            ipfsHash: ipfsHash
        }));

        // Update reputation based on attestation
        uint256 scoreChange = isPositive ? 5 : 0; // Small positive impact for positive attestations
        if (scoreChange > 0) {
            _updateReputationScore(user, scoreChange, true);
        }

        emit AttestationCreated(msg.sender, user, method, isPositive, ipfsHash);
    }

    /**
     * @dev Verifies Telegram account with signed message from bot
     */
    function verifyTelegram(
        uint256 telegramId,
        string memory username,
        uint256 timestamp,
        bytes memory signature
    ) external notBanned(msg.sender) {
        require(telegramVerifications[msg.sender].telegramId == 0, "Already verified Telegram");
        require(telegramIdToAddress[telegramId] == address(0), "Telegram ID already used");
        require(block.timestamp <= timestamp + 300, "Signature expired"); // 5 minute window

        // Verify signature from Telegram bot
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, telegramId, username, timestamp));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        require(ethSignedMessageHash.recover(signature) == telegramBotSigner, "Invalid signature");

        telegramVerifications[msg.sender] = TelegramVerification({
            telegramId: telegramId,
            username: username,
            isVerified: true,
            verificationTime: block.timestamp,
            signature: signature
        });

        telegramIdToAddress[telegramId] = msg.sender;

        // Auto-verify with telegram method
        if (verificationMethods["telegram"].isActive && !userVerifications[msg.sender].methodsCompleted["telegram"]) {
            verifyUser(msg.sender, "telegram");
        }

        emit TelegramVerified(msg.sender, telegramId, username);
    }

    /**
     * @dev Updates reputation score
     */
    function updateReputationScore(address user, uint256 scoreChange) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        _updateReputationScore(user, scoreChange, true);
    }

    /**
     * @dev Records a successful circle completion
     */
    function recordCircleCompletion(address user) external onlyRole(VERIFIER_ROLE) {
        userVerifications[user].successfulCircles++;
        _updateReputationScore(user, 10, true); // Bonus for completing circles
    }

    /**
     * @dev Records a default (penalty)
     */
    function recordDefault(address user) external onlyRole(VERIFIER_ROLE) {
        userVerifications[user].defaultCount++;
        _updateReputationScore(user, 50, false); // Penalty for defaulting
        
        // Auto-ban if too many defaults
        if (userVerifications[user].defaultCount >= 3) {
            banUser(user, block.timestamp + 30 days, "Multiple defaults");
        }
    }

    /**
     * @dev Bans a user
     */
    function banUser(address user, uint256 banExpiry, string memory reason) public onlyRole(DEFAULT_ADMIN_ROLE) {
        userVerifications[user].isBanned = true;
        userVerifications[user].banExpiry = banExpiry;
        emit UserBanned(user, banExpiry, reason);
    }

    /**
     * @dev Unbans a user
     */
    function unbanUser(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        userVerifications[user].isBanned = false;
        userVerifications[user].banExpiry = 0;
        emit UserUnbanned(user);
    }

    /**
     * @dev Sets minimum verification score
     */
    function setMinVerificationScore(uint256 score) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minVerificationScore = score;
    }

    /**
     * @dev Sets Telegram bot signer
     */
    function setTelegramBotSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        telegramBotSigner = signer;
    }

    // Internal functions

    function _updateReputationScore(address user, uint256 scoreChange, bool isIncrease) internal {
        uint256 oldScore = userVerifications[user].reputationScore;
        uint256 newScore;

        if (isIncrease) {
            newScore = oldScore + scoreChange;
            if (newScore > maxReputationScore) {
                newScore = maxReputationScore;
            }
        } else {
            if (scoreChange >= oldScore) {
                newScore = 0;
            } else {
                newScore = oldScore - scoreChange;
            }
        }

        userVerifications[user].reputationScore = newScore;
        emit ReputationScoreUpdated(user, oldScore, newScore);
    }

    // View functions

    /**
     * @dev Checks if a user is verified
     */
    function isVerified(address user) external view returns (bool) {
        return userVerifications[user].isVerified && !userVerifications[user].isBanned;
    }

    /**
     * @dev Gets user's reputation score
     */
    function getReputationScore(address user) external view returns (uint256) {
        if (userVerifications[user].isBanned && block.timestamp <= userVerifications[user].banExpiry) {
            return 0; // Banned users have 0 reputation
        }
        return userVerifications[user].reputationScore;
    }

    /**
     * @dev Gets user verification details
     */
    function getUserVerification(address user) external view returns (
        bool isVerified,
        uint256 verificationTimestamp,
        uint256 reputationScore,
        uint256 attestationCount,
        uint256 defaultCount,
        uint256 successfulCircles,
        bool isBanned,
        uint256 banExpiry
    ) {
        UserVerification storage verification = userVerifications[user];
        return (
            verification.isVerified,
            verification.verificationTimestamp,
            verification.reputationScore,
            verification.attestationCount,
            verification.defaultCount,
            verification.successfulCircles,
            verification.isBanned,
            verification.banExpiry
        );
    }

    /**
     * @dev Checks if user completed a specific verification method
     */
    function hasCompletedMethod(address user, string memory method) external view returns (bool) {
        return userVerifications[user].methodsCompleted[method];
    }

    /**
     * @dev Gets all verification methods
     */
    function getVerificationMethods() external view returns (string[] memory) {
        return methodNames;
    }

    /**
     * @dev Gets verification method details
     */
    function getVerificationMethod(string memory name) external view returns (
        uint256 scoreWeight,
        bool isActive,
        address oracle
    ) {
        VerificationMethod storage method = verificationMethods[name];
        return (method.scoreWeight, method.isActive, method.oracle);
    }

    /**
     * @dev Gets total number of attestations
     */
    function getAttestationCount() external view returns (uint256) {
        return attestations.length;
    }

    /**
     * @dev Gets attestation details by index
     */
    function getAttestation(uint256 index) external view returns (
        address attestor,
        address user,
        string memory method,
        bool isPositive,
        uint256 timestamp,
        string memory ipfsHash
    ) {
        require(index < attestations.length, "Index out of bounds");
        Attestation storage attestation = attestations[index];
        return (
            attestation.attestor,
            attestation.user,
            attestation.method,
            attestation.isPositive,
            attestation.timestamp,
            attestation.ipfsHash
        );
    }

    /**
     * @dev Gets Telegram verification details
     */
    function getTelegramVerification(address user) external view returns (
        uint256 telegramId,
        string memory username,
        bool isVerified,
        uint256 verificationTime
    ) {
        TelegramVerification storage telegram = telegramVerifications[user];
        return (telegram.telegramId, telegram.username, telegram.isVerified, telegram.verificationTime);
    }

    /**
     * @dev Gets address from Telegram ID
     */
    function getAddressFromTelegramId(uint256 telegramId) external view returns (address) {
        return telegramIdToAddress[telegramId];
    }

    /**
     * @dev Calculates verification score for user
     */
    function calculateVerificationScore(address user) external view returns (uint256 score) {
        score = 0;
        for (uint256 i = 0; i < methodNames.length; i++) {
            string memory methodName = methodNames[i];
            if (userVerifications[user].methodsCompleted[methodName] && verificationMethods[methodName].isActive) {
                score += verificationMethods[methodName].scoreWeight;
            }
        }
        return score;
    }
}