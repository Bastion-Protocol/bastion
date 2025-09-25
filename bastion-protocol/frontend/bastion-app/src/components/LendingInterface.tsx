import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BastionContractService } from '../services/contract-service';
import { BastionNitroliteClient } from '../services/nitrolite-client';

interface LendingInterfaceProps {
  contractService: BastionContractService;
  nitroliteClient: BastionNitroliteClient;
  userAddress: string;
}

interface Loan {
  id: number;
  borrower: string;
  lender: string;
  principal: string;
  collateral: string;
  interestRate: number;
  duration: number;
  status: number;
}

const LendingInterface: React.FC<LendingInterfaceProps> = ({
  contractService,
  nitroliteClient,
  userAddress,
}) => {
  const [pendingLoans, setPendingLoans] = useState<Loan[]>([]);
  const [userLoans, setUserLoans] = useState<Loan[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [principal, setPrincipal] = useState('');
  const [collateral, setCollateral] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      const pending = await contractService.getPendingLoans();
      const pendingLoanDetails = await Promise.all(
        pending.map(async (id: any) => {
          const loan = await contractService.getLoan(id.toNumber());
          return {
            id: id.toNumber(),
            borrower: loan.borrower,
            lender: loan.lender,
            principal: ethers.utils.formatEther(loan.principal),
            collateral: ethers.utils.formatEther(loan.collateral),
            interestRate: loan.interestRate,
            duration: loan.duration,
            status: loan.status,
          };
        })
      );
      setPendingLoans(pendingLoanDetails);
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  const createLoanRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal || !collateral || !interestRate || !duration) {
      alert('Please fill all fields');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create loan on-chain
      await contractService.createLoanRequest(
        principal,
        collateral,
        parseInt(interestRate),
        parseInt(duration) * 24 * 3600, // Convert days to seconds
        '0x0000000000000000000000000000000000000000', // Test token placeholder
        '0x0000000000000000000000000000000000000000'  // Test token placeholder
      );

      alert('Loan request created successfully!');
      setShowCreateForm(false);
      setPrincipal('');
      setCollateral('');
      setInterestRate('');
      setDuration('');
      loadLoans();
    } catch (error) {
      console.error('Error creating loan:', error);
      alert('Failed to create loan request');
    } finally {
      setIsLoading(false);
    }
  };

  const fulfillLoan = async (loanId: number, borrower: string, amount: string) => {
    setIsLoading(true);
    
    try {
      // Create Nitrolite session for instant transfer
      const session = await nitroliteClient.createLoanSession(
        borrower,
        userAddress,
        amount
      );

      // Fulfill loan on-chain
      await contractService.fulfillLoan(loanId);

      alert('Loan fulfilled successfully! Funds transferred via state channel.');
      loadLoans();
    } catch (error) {
      console.error('Error fulfilling loan:', error);
      alert('Failed to fulfill loan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lending-interface">
      <div className="section-header">
        <h2>💰 P2P Lending Marketplace</h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="primary-button"
        >
          {showCreateForm ? 'Cancel' : 'Request Loan'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h3>Create Loan Request</h3>
          <form onSubmit={createLoanRequest}>
            <div className="form-row">
              <div className="form-group">
                <label>Principal Amount (Test USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="100.00"
                />
              </div>
              
              <div className="form-group">
                <label>Collateral Amount (Test USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="5.0"
                />
              </div>
              
              <div className="form-group">
                <label>Duration (days)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? 'Creating...' : 'Create Loan Request'}
            </button>
          </form>
        </div>
      )}

      <div className="loans-grid">
        <div className="loans-section">
          <h3>Available Loan Requests</h3>
          {pendingLoans.length === 0 ? (
            <p>No pending loan requests</p>
          ) : (
            <div className="loans-list">
              {pendingLoans.map((loan) => (
                <div key={loan.id} className="loan-card">
                  <div className="loan-header">
                    <span className="loan-id">Loan #{loan.id}</span>
                    <span className="borrower">
                      {loan.borrower === userAddress ? 'Your Request' : 
                       `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}`}
                    </span>
                  </div>
                  
                  <div className="loan-details">
                    <div className="detail-row">
                      <span>Principal:</span>
                      <span>{loan.principal} Test USD</span>
                    </div>
                    <div className="detail-row">
                      <span>Collateral:</span>
                      <span>{loan.collateral} Test USD</span>
                    </div>
                    <div className="detail-row">
                      <span>Interest:</span>
                      <span>{loan.interestRate}%</span>
                    </div>
                    <div className="detail-row">
                      <span>Duration:</span>
                      <span>{Math.floor(loan.duration / (24 * 3600))} days</span>
                    </div>
                  </div>

                  {loan.borrower !== userAddress && (
                    <button
                      onClick={() => fulfillLoan(loan.id, loan.borrower, loan.principal)}
                      disabled={isLoading}
                      className="fulfill-button"
                    >
                      {isLoading ? 'Processing...' : 'Lend Money'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="info-section">
        <h4>🚀 How It Works</h4>
        <ol>
          <li><strong>Request:</strong> Borrowers post loan requests with collateral</li>
          <li><strong>Match:</strong> Lenders review and fulfill loans</li>
          <li><strong>Transfer:</strong> Funds move instantly via Nitrolite state channels</li>
          <li><strong>Repay:</strong> Borrowers repay with interest to unlock collateral</li>
        </ol>
        
        <div className="benefits">
          <div className="benefit">⚡ Instant transfers</div>
          <div className="benefit">🔒 Overcollateralized</div>
          <div className="benefit">💰 No gas fees</div>
          <div className="benefit">🎯 Trust-based matching</div>
        </div>
      </div>
    </div>
  );
};

export default LendingInterface;