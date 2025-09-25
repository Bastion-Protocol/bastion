import { Web3Auth } from '@web3auth/modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { CHAIN_NAMESPACES, SafeEventEmitterProvider } from '@web3auth/base';
import { ethers } from 'ethers';
import { getEnvNumber, getEnvOrDefault } from '../utils/env';

export interface SocialConnection {
  provider: SafeEventEmitterProvider;
  web3Provider: ethers.providers.Web3Provider;
  signer: ethers.Signer;
  address: string;
}

class YellowSocialLoginService {
  private web3auth: Web3Auth | null = null;
  private provider: SafeEventEmitterProvider | null = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) {
      return !!this.web3auth;
    }

    const clientId = getEnvOrDefault('REACT_APP_WEB3AUTH_CLIENT_ID', '');
    if (!clientId) {
      this.initialized = true;
      return false;
    }

    const chainId = getEnvNumber('REACT_APP_CHAIN_ID') ?? 11155111;
    const rpcUrl = getEnvOrDefault('REACT_APP_RPC_URL', 'https://rpc.sepolia.org');
    const chainName = getEnvOrDefault('REACT_APP_CHAIN_NAME', 'Sepolia Testnet');

    this.web3auth = new Web3Auth({
      clientId,
      web3AuthNetwork: 'testnet',
      chainConfig: {
        chainNamespace: CHAIN_NAMESPACES.EIP155,
        chainId: `0x${chainId.toString(16)}`,
        rpcTarget: rpcUrl,
        displayName: chainName,
        ticker: 'ETH',
        tickerName: 'Ethereum',
      },
    });

    const openloginAdapter = new OpenloginAdapter({
      adapterSettings: {
        uxMode: 'popup',
      },
    });

    this.web3auth.configureAdapter(openloginAdapter);
    await this.web3auth.initModal();

    this.provider = this.web3auth.provider ?? null;
    this.initialized = true;
    return true;
  }

  hasActiveSession(): boolean {
    return !!this.provider;
  }

  async connect(options?: { silent?: boolean }): Promise<SocialConnection | null> {
    if (!this.web3auth) {
      return null;
    }

    const silent = options?.silent ?? false;

    if (!this.provider) {
      this.provider = silent ? this.web3auth.provider : await this.web3auth.connect();
    }

    if (!this.provider) {
      return null;
    }

    const web3Provider = new ethers.providers.Web3Provider(this.provider as any, 'any');
    const signer = web3Provider.getSigner();
    const address = await signer.getAddress();

    return { provider: this.provider, web3Provider, signer, address };
  }

  async disconnect(): Promise<void> {
    if (!this.web3auth) {
      return;
    }

    await this.web3auth.logout();
    this.provider = null;
  }
}

export const socialLoginService = new YellowSocialLoginService();
