import React, { useState, useEffect } from 'react';
import { BastionContractService } from '../services/contract-service';
import { BastionNitroliteClient } from '../services/nitrolite-client';

interface CircleInterfaceProps {
  contractService: BastionContractService;
  nitroliteClient: BastionNitroliteClient;
  userAddress: string;
}

const CircleInterface: React.FC<CircleInterfaceProps> = ({
  contractService,
  nitroliteClient,
  userAddress,
}) => {
  const [activeCircles, setActiveCircles] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [memberAddresses, setMemberAddresses] = useState('');

  useEffect(() => {
    loadCircles();
  }, []);

  const loadCircles = async () => {
    try {
      const circles = await contractService.getActiveCircles();
      // Load circle details would go here
      setActiveCircles([]);
    } catch (error) {
      console.error('Error loading circles:', error);
    }
  };

  const createCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthlyAmount || !interestRate || !maxMembers) {
      alert('Please fill all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const initialMembers = memberAddresses 
        ? memberAddresses.split(',').map(addr => addr.trim())
        : [userAddress];

      await contractService.createCircle(
        monthlyAmount,
        parseInt(interestRate),
        initialMembers,
        parseInt(maxMembers),
        '0x0000000000000000000000000000000000000000' // Test token
      );

      alert('ROSCA circle created successfully!');
      setShowCreateForm(false);
      loadCircles();
    } catch (error) {
      console.error('Error creating circle:', error);
      alert('Failed to create circle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="circle-interface">
      <div className="section-header">
        <h2>👥 ROSCA Circles</h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="primary-button"
        >
          {showCreateForm ? 'Cancel' : 'Create Circle'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Create ROSCA Circle</h3>
          <form onSubmit={createCircle}>
            <div className="form-row">
              <div className="form-group">
                <label>Monthly Contribution (Test USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="50.00"
                />
              </div>
              
              <div className="form-group">
                <label>Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="2.0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Maximum Members</label>
              <input
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="form-group">
              <label>Initial Member Addresses (optional, comma-separated)</label>
              <textarea
                value={memberAddresses}
                onChange={(e) => setMemberAddresses(e.target.value)}
                placeholder="0x123..., 0x456..."
                rows={3}
              />
            </div>

            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? 'Creating...' : 'Create Circle'}
            </button>
          </form>
        </div>
      )}

      <div className="info-section">
        <h4>💫 How ROSCA Circles Work</h4>
        <ol>
          <li><strong>Create:</strong> Set monthly amount and invite members</li>
          <li><strong>Contribute:</strong> All members contribute each month</li>
          <li><strong>Bid:</strong> Members bid for the monthly pool</li>
          <li><strong>Win:</strong> Lowest bidder gets the pool early</li>
          <li><strong>Repeat:</strong> Continue until everyone gets a turn</li>
        </ol>
        
        <div className="benefits">
          <div className="benefit">🚀 Early access to funds</div>
          <div className="benefit">🤝 Community-based</div>
          <div className="benefit">⚡ Instant payouts</div>
          <div className="benefit">📈 Build trust score</div>
        </div>
      </div>
    </div>
  );
};

export default CircleInterface;