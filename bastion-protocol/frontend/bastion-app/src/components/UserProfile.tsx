import React, { useState, useEffect } from 'react';
import { BastionContractService } from '../services/contract-service';

interface UserProfileProps {
  contractService: BastionContractService;
  userAddress: string;
  trustScore: number;
}

const UserProfile: React.FC<UserProfileProps> = ({
  contractService,
  userAddress,
  trustScore,
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userAddress]);

  const loadProfile = async () => {
    try {
      const userProfile = await contractService.getUserProfile(userAddress);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  return (
    <div className="profile-interface">
      <h2>👤 User Profile</h2>
      
      <div className="profile-card">
        <div className="profile-header">
          <div className="address">
            <h3>{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</h3>
            <span className="full-address">{userAddress}</span>
          </div>
          
          <div className="trust-score">
            <div className="score-circle">
              <span className="score">{trustScore}</span>
              <span className="score-label">Trust Score</span>
            </div>
          </div>
        </div>

        {profile && (
          <div className="profile-stats">
            <div className="stat">
              <span className="label">Loans Given:</span>
              <span className="value">{profile.totalLoansGiven?.toString() || '0'}</span>
            </div>
            <div className="stat">
              <span className="label">Loans Taken:</span>
              <span className="value">{profile.totalLoansTaken?.toString() || '0'}</span>
            </div>
            <div className="stat">
              <span className="label">Circles Joined:</span>
              <span className="value">{profile.circlesJoined?.toString() || '0'}</span>
            </div>
            <div className="stat">
              <span className="label">Defaults:</span>
              <span className="value">{profile.defaultCount?.toString() || '0'}</span>
            </div>
            <div className="stat">
              <span className="label">Member Since:</span>
              <span className="value">
                {profile.joinDate && profile.joinDate > 0 
                  ? new Date(profile.joinDate * 1000).toLocaleDateString()
                  : 'New User'
                }
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="trust-info">
        <h3>🎯 Trust Score Breakdown</h3>
        <div className="trust-factors">
          <div className="factor">
            <span className="factor-name">Payment Reliability</span>
            <span className="factor-weight">40%</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{width: `${Math.min(trustScore * 0.4, 40)}%`}}></div>
            </div>
          </div>
          
          <div className="factor">
            <span className="factor-name">Circle Completion</span>
            <span className="factor-weight">30%</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{width: `${Math.min(trustScore * 0.3, 30)}%`}}></div>
            </div>
          </div>
          
          <div className="factor">
            <span className="factor-name">DeFi Experience</span>
            <span className="factor-weight">20%</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{width: `${Math.min(trustScore * 0.2, 20)}%`}}></div>
            </div>
          </div>
          
          <div className="factor">
            <span className="factor-name">Social Verification</span>
            <span className="factor-weight">10%</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{width: `${Math.min(trustScore * 0.1, 10)}%`}}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h4>📈 Improve Your Trust Score</h4>
        <ul>
          <li>Complete loan repayments on time</li>
          <li>Participate in ROSCA circles consistently</li>
          <li>Build a history of successful transactions</li>
          <li>Maintain good collateral ratios</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfile;