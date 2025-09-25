// Type declarations for Bastion Protocol frontend

declare module 'react/jsx-runtime' {
  export * from 'react';
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Nitrolite SDK types
declare module '@erc7824/nitrolite' {
  export class NitroliteClient {
    constructor(config: {
      wsUrl: string;
      chainId: number;
    });
    
    createAppSession(definition: any, allocations: any[]): Promise<any>;
    getBalance(address: string): Promise<{ balance: string }>;
    authenticate(signer: any): Promise<void>;
  }
}

// Ethers.js types augmentation
declare module 'ethers' {
  export interface Contract {
    getTrustScore(address: string): Promise<number>;
    createLoanRequest(amount: string, interestRate: number, duration: number, collateralAmount: string): Promise<any>;
    fulfillLoan(loanId: number): Promise<any>;
    repayLoan(loanId: number): Promise<any>;
    createCircle(name: string, maxMembers: number, monthlyAmount: string, duration: number): Promise<any>;
    joinCircle(circleId: number): Promise<any>;
    submitBid(circleId: number, bidAmount: string): Promise<any>;
  }
}

export {};