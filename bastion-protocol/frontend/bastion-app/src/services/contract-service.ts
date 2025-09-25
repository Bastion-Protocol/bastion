import { ethers } from 'ethers';
import { getEnvOrDefault } from '../utils/env';

// Contract ABIs (simplified for MVP)
export const BASTION_LENDING_ABI = [
  "function createLoanRequest(uint256 principal, uint256 collateral, uint256 interestRate, uint256 duration, address collateralToken, address principalToken) external returns (uint256)",
  "function fulfillLoan(uint256 loanId) external",
  "function repayLoan(uint256 loanId, uint256 amount) external",
  "function getLoan(uint256 loanId) external view returns (tuple(address borrower, address lender, uint256 principal, uint256 collateral, uint256 interestRate, uint256 duration, uint256 startTime, uint8 status, address collateralToken, address principalToken))",
  "function getPendingLoans() external view returns (uint256[] memory)",
  "function getBorrowerLoans(address borrower) external view returns (uint256[] memory)",
  "function getLenderLoans(address lender) external view returns (uint256[] memory)"
];

export const BASTION_CIRCLES_ABI = [
  "function createCircle(uint256 monthlyAmount, uint256 interestRate, address[] memory initialMembers, uint256 maxMembers, address token) external returns (bytes32)",
  "function joinCircle(bytes32 circleId, uint256 stake) external",
  "function submitBid(bytes32 circleId, uint256 amount) external",
  "function distributeFunds(bytes32 circleId) external",
  "function getCircle(bytes32 circleId) external view returns (tuple(bytes32 id, address[] members, uint256 monthlyAmount, uint256 interestRate, uint256 currentCycle, uint256 maxMembers, uint8 status, address token))",
  "function getActiveCircles() external view returns (bytes32[] memory)"
];

export const BASTION_CORE_ABI = [
  "function updateTrustScore(address user, uint256 paymentReliability, uint256 circleCompletion, uint256 deFiExperience, uint256 socialVerification) external",
  "function getTrustScore(address user) external view returns (uint256)",
  "function getUserProfile(address user) external view returns (tuple(string name, bool isVerified, uint256 joinDate, uint256 totalLoansGiven, uint256 totalLoansTaken, uint256 circlesJoined, uint256 defaultCount))",
  "function calculateRiskScore(address user) external view returns (uint256)"
];

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  BASTION_CORE: getEnvOrDefault('REACT_APP_BASTION_CORE_ADDRESS', '0x0000000000000000000000000000000000000000'),
  BASTION_LENDING: getEnvOrDefault('REACT_APP_BASTION_LENDING_ADDRESS', '0x0000000000000000000000000000000000000000'),
  BASTION_CIRCLES: getEnvOrDefault('REACT_APP_BASTION_CIRCLES_ADDRESS', '0x0000000000000000000000000000000000000000'),
};

export class BastionContractService {
  private provider: ethers.providers.Web3Provider;
  private signer: ethers.Signer;

  constructor(provider: ethers.providers.Web3Provider) {
    this.provider = provider;
    this.signer = provider.getSigner();
  }

  // Get contract instances
  getLendingContract() {
    return new ethers.Contract(CONTRACT_ADDRESSES.BASTION_LENDING, BASTION_LENDING_ABI, this.signer);
  }

  getCirclesContract() {
    return new ethers.Contract(CONTRACT_ADDRESSES.BASTION_CIRCLES, BASTION_CIRCLES_ABI, this.signer);
  }

  getCoreContract() {
    return new ethers.Contract(CONTRACT_ADDRESSES.BASTION_CORE, BASTION_CORE_ABI, this.signer);
  }

  // Lending functions
  async createLoanRequest(
    principal: string,
    collateral: string,
    interestRate: number,
    duration: number,
    collateralToken: string,
    principalToken: string
  ) {
    const contract = this.getLendingContract() as any;
    const principalWei = ethers.utils.parseEther(principal);
    const collateralWei = ethers.utils.parseEther(collateral);
    
    try {
      const tx = await contract.createLoanRequest(
        principalWei,
        collateralWei,
        interestRate,
        duration,
        collateralToken,
        principalToken
      );
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error creating loan request:', error);
      throw error;
    }
  }

  async fulfillLoan(loanId: number) {
    const contract = this.getLendingContract() as any;
    try {
      const tx = await contract.fulfillLoan(loanId);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error fulfilling loan:', error);
      throw error;
    }
  }

  async getPendingLoans() {
    const contract = this.getLendingContract() as any;
    try {
      return await contract.getPendingLoans();
    } catch (error) {
      console.error('Error getting pending loans:', error);
      return [];
    }
  }

  async getLoan(loanId: number) {
    const contract = this.getLendingContract() as any;
    try {
      return await contract.getLoan(loanId);
    } catch (error) {
      console.error('Error getting loan:', error);
      throw error;
    }
  }

  // Circle functions
  async createCircle(
    monthlyAmount: string,
    interestRate: number,
    initialMembers: string[],
    maxMembers: number,
    token: string
  ) {
    const contract = this.getCirclesContract() as any;
    const monthlyAmountWei = ethers.utils.parseEther(monthlyAmount);
    
    try {
      const tx = await contract.createCircle(
        monthlyAmountWei,
        interestRate,
        initialMembers,
        maxMembers,
        token
      );
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error creating circle:', error);
      throw error;
    }
  }

  async joinCircle(circleId: string, stake: string) {
    const contract = this.getCirclesContract() as any;
    const stakeWei = ethers.utils.parseEther(stake);
    
    try {
      const tx = await contract.joinCircle(circleId, stakeWei);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('Error joining circle:', error);
      throw error;
    }
  }

  async getActiveCircles() {
    const contract = this.getCirclesContract() as any;
    try {
      return await contract.getActiveCircles();
    } catch (error) {
      console.error('Error getting active circles:', error);
      return [];
    }
  }

  // Trust scoring functions
  async getTrustScore(address: string) {
    const contract = this.getCoreContract() as any;
    try {
      const score = await contract.getTrustScore(address);
      if (!score) return 0;
      if (typeof score === 'number') return score;
      if (typeof score === 'string') return Number(score);
      if (score.toNumber) return score.toNumber();
      if (score.toString) return Number(score.toString());
      return 0;
    } catch (error) {
      console.error('Error getting trust score:', error);
      return 0;
    }
  }

  async getUserProfile(address: string) {
    const contract = this.getCoreContract() as any;
    try {
      return await contract.getUserProfile(address);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }
}