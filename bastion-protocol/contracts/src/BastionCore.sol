// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BastionCore {
    mapping(address => TrustProfile) public userTrustScores;
    mapping(address => UserProfile) public userProfiles;

    struct TrustProfile {
        uint256 overallScore;
        uint256 lendingHistory;
        uint256 borrowingHistory;
        uint256 circleParticipation;
        uint256 collateralRatio;
        uint256 lastUpdated;
    }

    struct UserProfile {
        string name;
        bool isVerified;
        uint256 joinDate;
        uint256 totalLoansGiven;
        uint256 totalLoansTaken;
        uint256 circlesJoined;
        uint256 defaultCount;
    }

    // Events
    event TrustScoreUpdated(address indexed user, uint256 newScore);
    event UserProfileUpdated(address indexed user);

    // Trust scoring logic (from v2 Page 4)
    function updateTrustScore(
        address user, 
        uint256 paymentReliability, 
        uint256 circleCompletion, 
        uint256 deFiExperience, 
        uint256 socialVerification
    ) public {
        TrustProfile storage profile = userTrustScores[user];
        
        // Weighted scoring: Payment 40%, Circle 30%, DeFi 20%, Social 10%
        uint256 newScore = (paymentReliability * 40 + circleCompletion * 30 + deFiExperience * 20 + socialVerification * 10) / 100;
        
        // Apply decay factor if score is old
        if (profile.lastUpdated > 0 && block.timestamp > profile.lastUpdated + 30 days) {
            newScore = (newScore * 90) / 100; // 10% decay
        }
        
        profile.overallScore = newScore;
        profile.lastUpdated = block.timestamp;
        
        emit TrustScoreUpdated(user, newScore);
    }

    function updateUserProfile(
        address user,
        string memory name,
        bool isVerified
    ) external {
        UserProfile storage profile = userProfiles[user];
        
        if (profile.joinDate == 0) {
            profile.joinDate = block.timestamp;
        }
        
        profile.name = name;
        profile.isVerified = isVerified;
        
        emit UserProfileUpdated(user);
    }

    function incrementLoanActivity(address user, bool isLender, bool isDefault) external {
        UserProfile storage profile = userProfiles[user];
        
        if (isLender) {
            profile.totalLoansGiven++;
        } else {
            profile.totalLoansTaken++;
            if (isDefault) {
                profile.defaultCount++;
            }
        }
    }

    function incrementCircleActivity(address user) external {
        UserProfile storage profile = userProfiles[user];
        profile.circlesJoined++;
    }

    function getTrustScore(address user) external view returns (uint256) {
        return userTrustScores[user].overallScore;
    }

    function getUserProfile(address user) external view returns (UserProfile memory) {
        return userProfiles[user];
    }

    function calculateRiskScore(address user) external view returns (uint256) {
        UserProfile memory profile = userProfiles[user];
        TrustProfile memory trustProfile = userTrustScores[user];
        
        if (profile.totalLoansTaken == 0) {
            return 50; // Neutral score for new users
        }
        
        uint256 defaultRate = (profile.defaultCount * 100) / profile.totalLoansTaken;
        uint256 experienceScore = profile.totalLoansGiven + profile.circlesJoined;
        
        // Lower risk score is better
        uint256 riskScore = defaultRate;
        if (experienceScore > 10) riskScore = riskScore / 2;
        if (trustProfile.overallScore > 80) riskScore = riskScore / 2;
        
        return riskScore;
    }
}
