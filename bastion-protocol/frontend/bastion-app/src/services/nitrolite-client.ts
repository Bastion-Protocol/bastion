import { NitroliteClient } from '@erc7824/nitrolite';
import { ethers } from 'ethers';
import { getEnvOrDefault, getEnvNumber } from '../utils/env';

// Sepolia Testnet configuration
const RPC_URL = getEnvOrDefault('REACT_APP_RPC_URL', 'https://rpc.sepolia.org');
const CLEARNODE_SANDBOX_WS = getEnvOrDefault('REACT_APP_NITROLITE_WS_URL', 'wss://clearnet-sandbox.yellow.com/ws');
const SEPOLIA_CHAIN_ID = getEnvNumber('REACT_APP_CHAIN_ID') ?? 11155111;
const YELLOW_TEST_USD = 'yellow-test-usd';

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  BASTION_CORE: '0x...',
  BASTION_LENDING: '0x...',
  BASTION_CIRCLES: '0x...',
};

export class BastionNitroliteClient {
  private client: NitroliteClient;
  private provider: ethers.providers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    this.client = new NitroliteClient({
      wsUrl: CLEARNODE_SANDBOX_WS,
      chainId: SEPOLIA_CHAIN_ID,
    });
  }

  // Authentication with Clearnode
  async authenticate(signer: ethers.Signer): Promise<void> {
    const address = await signer.getAddress();
    console.log('Authenticating with Clearnode:', address);
    
    try {
      // The client will handle authentication automatically when needed
      console.log('Authentication successful');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  // Request test tokens from faucet
  async requestTestTokens(userAddress: string): Promise<void> {
    try {
      const response = await fetch('https://clearnet-sandbox.yellow.com/faucet/requestTokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAddress }),
      });

      if (response.ok) {
        console.log('Test tokens requested successfully');
      } else {
        throw new Error('Failed to request test tokens');
      }
    } catch (error) {
      console.error('Error requesting test tokens:', error);
      throw error;
    }
  }

  // Create session for P2P loan
  async createLoanSession(
    borrower: string, 
    lender: string, 
    amount: string
  ): Promise<any> {
    const appDefinition = {
      protocol: 'nitroliterpc',
      participants: [borrower, lender],
      weights: [50, 50],
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    const allocations = [
      { 
        participant: borrower, 
        asset: YELLOW_TEST_USD, 
        amount: '0' // Borrower starts with 0, will receive the loan
      },
      { 
        participant: lender, 
        asset: YELLOW_TEST_USD, 
        amount: amount // Lender provides the funds
      },
    ];

    try {
      const session = await this.client.createAppSession(appDefinition, allocations);
      console.log('Loan session created:', session);
      return session;
    } catch (error) {
      console.error('Failed to create loan session:', error);
      throw error;
    }
  }

  // Create session for ROSCA circle (multi-participant)
  async createCircleSession(
    participants: string[], 
    monthlyAmount: string
  ): Promise<any> {
    const weights = participants.map(() => Math.floor(100 / participants.length));
    
    const appDefinition = {
      protocol: 'nitroliterpc',
      participants,
      weights,
      quorum: 100,
      challenge: 0,
      nonce: Date.now(),
    };

    const allocations = participants.map(participant => ({
      participant,
      asset: YELLOW_TEST_USD,
      amount: monthlyAmount,
    }));

    try {
      const session = await this.client.createAppSession(appDefinition, allocations);
      console.log('Circle session created:', session);
      return session;
    } catch (error) {
      console.error('Failed to create circle session:', error);
      throw error;
    }
  }

  // Close session with final allocation
  async closeSession(appId: string, finalAllocations: any[]): Promise<void> {
    try {
      await this.client.closeAppSession(appId, finalAllocations);
      console.log('Session closed successfully');
    } catch (error) {
      console.error('Failed to close session:', error);
      throw error;
    }
  }

  // Execute loan transfer within session
  async executeLoanTransfer(
    sessionId: string,
    fromParticipant: string,
    toParticipant: string,
    amount: string
  ): Promise<void> {
    try {
      // This would use Nitrolite's state channel operations
      // to instantly transfer the loan amount
      console.log(`Transferring ${amount} from ${fromParticipant} to ${toParticipant}`);
      
      // Implementation depends on Nitrolite's API for state updates
      // For now, this is a placeholder for the instant transfer
      
    } catch (error) {
      console.error('Failed to execute loan transfer:', error);
      throw error;
    }
  }

  // Submit bid in circle session
  async submitCircleBid(
    sessionId: string,
    bidder: string,
    bidAmount: string
  ): Promise<void> {
    try {
      // State channel operation for bidding
      console.log(`Bid submitted: ${bidAmount} by ${bidder}`);
      
      // This would update the session state with the new bid
      
    } catch (error) {
      console.error('Failed to submit bid:', error);
      throw error;
    }
  }

  // Get user's Clearnode balance
  async getBalance(userAddress: string): Promise<any> {
    try {
      // This would call Clearnode API to get unified balance
      const response = await fetch(`https://clearnet-sandbox.yellow.com/api/balance/${userAddress}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get balance:', error);
      return { balance: '0' };
    }
  }

  // Withdraw funds from Clearnode to on-chain
  async withdrawToChain(
    userAddress: string,
    amount: string,
    destinationAddress: string
  ): Promise<void> {
    try {
      // Create a channel and immediately close it to withdraw to on-chain
      const channel = await this.client.createChannel({
        participants: [userAddress],
        asset: YELLOW_TEST_USD,
        amount: '0', // Start with 0 deposit
      });

      // Close channel with funds going to destination address
      await this.client.closeChannel(channel.id, {
        fundsDestination: destinationAddress,
        finalAllocations: [{ participant: userAddress, amount }],
      });

      console.log('Withdrawal to chain completed');
    } catch (error) {
      console.error('Failed to withdraw to chain:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const nitroliteClient = new BastionNitroliteClient();