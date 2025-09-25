/// <reference types="react-scripts" />
/// <reference types="node" />

declare global {
  interface Window {
    ethereum?: any;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PUBLIC_URL: string;
      REACT_APP_BASTION_CORE_ADDRESS: string;
      REACT_APP_BASTION_LENDING_ADDRESS: string;
      REACT_APP_BASTION_CIRCLES_ADDRESS: string;
      REACT_APP_CHAIN_ID: string;
      REACT_APP_RPC_URL: string;
      REACT_APP_NITROLITE_WS_URL: string;
      REACT_APP_FAUCET_URL: string;
      REACT_APP_WEB3AUTH_CLIENT_ID?: string;
    }
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
    closeAppSession(appId: string, finalAllocations: any[]): Promise<void>;
    createChannel(config: {
      participants: string[];
      asset: string;
      amount: string;
    }): Promise<{ id: string }>;
    closeChannel(channelId: string, options: {
      fundsDestination: string;
      finalAllocations: Array<{ participant: string; amount: string }>;
    }): Promise<void>;
  }
}