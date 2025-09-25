import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { BastionContractService } from './services/contract-service';
import { nitroliteClient } from './services/nitrolite-client';
import LendingInterface from './components/LendingInterface';
import CircleInterface from './components/CircleInterface';
import UserProfile from './components/UserProfile';
import { getEnvOrDefault, getEnvNumber } from './utils/env';
import { socialLoginService } from './services/social-login';
import './App.css';

const RPC_URL = getEnvOrDefault('REACT_APP_RPC_URL', 'https://rpc.sepolia.org');
const BLOCK_EXPLORER_URL = getEnvOrDefault('REACT_APP_BLOCK_EXPLORER_URL', 'https://sepolia.etherscan.io');
const CHAIN_NAME = getEnvOrDefault('REACT_APP_CHAIN_NAME', 'Sepolia Test Network');

const chainIdDecimal = getEnvNumber('REACT_APP_CHAIN_ID') ?? 11155111;
const CHAIN_ID_HEX = `0x${chainIdDecimal.toString(16)}`;

function App() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [contractService, setContractService] = useState<BastionContractService | null>(null);
  const [activeTab, setActiveTab] = useState<'lending' | 'circles' | 'profile'>('lending');
  const [userBalance, setUserBalance] = useState<string>('0');
  const [trustScore, setTrustScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginMethod, setLoginMethod] = useState<'metamask' | 'social' | null>(null);
  const [socialReady, setSocialReady] = useState<boolean>(false);

  const loadUserData = useCallback(async (address: string, service?: BastionContractService) => {
    const contractSvc = service ?? contractService;
    if (!contractSvc) return;

    try {
      const score = await contractSvc.getTrustScore(address);
      setTrustScore(score);

      const balance = await nitroliteClient.getBalance(address);
      setUserBalance(balance.balance || '0');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [contractService]);

  const bootstrapConnection = useCallback(async (
    web3Provider: ethers.providers.Web3Provider,
    method: 'metamask' | 'social'
  ) => {
    setIsLoading(true);
    try {
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();

      const newService = new BastionContractService(web3Provider);
      setAccount(address);
      setProvider(web3Provider);
      setContractService(newService);
      setLoginMethod(method);

      await nitroliteClient.authenticate(signer);
      await nitroliteClient.requestTestTokens(address);
      await loadUserData(address, newService);
    } catch (error) {
      console.error('Error initializing connection:', error);
      alert('Failed to initialize connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadUserData]);

  const checkWalletConnection = useCallback(async () => {
    if (window.ethereum) {
      const injectedProvider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await injectedProvider.listAccounts();
      if (accounts.length > 0) {
        await bootstrapConnection(injectedProvider, 'metamask');
        return;
      }
    }
  }, [bootstrapConnection]);

  useEffect(() => {
    const init = async () => {
      await checkWalletConnection();

      const ready = await socialLoginService.init();
      setSocialReady(ready);

      if (ready) {
        const connection = await socialLoginService.connect({ silent: true });
        if (connection) {
          await bootstrapConnection(connection.web3Provider, 'social');
        }
      }
    };

    void init();
  }, [bootstrapConnection, checkWalletConnection]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    setIsLoading(true);
    
    try {
      const injectedProvider = new ethers.providers.Web3Provider(window.ethereum);
      await injectedProvider.send('eth_requestAccounts', []);
      await bootstrapConnection(injectedProvider, 'metamask');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const connectWithSocialLogin = async () => {
    setIsLoading(true);
    try {
      const connection = await socialLoginService.connect();
      if (!connection) {
        alert('Social login failed to initialize.');
        return;
      }
      await bootstrapConnection(connection.web3Provider, 'social');
    } catch (error) {
      console.error('Error with social login:', error);
      alert('Failed to sign in with social login.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setProvider(null);
    setContractService(null);
    setUserBalance('0');
    setTrustScore(0);
    setLoginMethod(null);

    if (loginMethod === 'social') {
      void socialLoginService.disconnect();
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (error: any) {
      // If network doesn't exist, add it
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: CHAIN_NAME,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [BLOCK_EXPLORER_URL],
            },
          ],
        });
      }
    }
  };

  if (!account) {
    return (
      <div className="App">
        <div className="connect-container">
          <div className="connect-card">
            <h1>🏛️ Bastion Protocol</h1>
            <p>Decentralized P2P Lending & ROSCA Platform</p>
            <p className="subtitle">Powered by Yellow Network & Nitrolite SDK</p>
            
            <div className="features">
              <div className="feature">
                <h3>⚡ Instant Transactions</h3>
                <p>State channels for gasless operations</p>
              </div>
              <div className="feature">
                <h3>🤝 P2P Lending</h3>
                <p>Direct peer-to-peer loans with collateral</p>
              </div>
              <div className="feature">
                <h3>👥 ROSCA Circles</h3>
                <p>Social lending circles with bidding</p>
              </div>
              <div className="feature">
                <h3>🎯 Trust Scoring</h3>
                <p>Multi-dimensional reputation system</p>
              </div>
            </div>

            <button 
              onClick={connectWallet} 
              disabled={isLoading}
              className="connect-button"
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet & Get Test Tokens'}
            </button>

            {socialReady && (
              <button
                onClick={connectWithSocialLogin}
                disabled={isLoading}
                className="connect-button secondary"
              >
                {isLoading ? 'Signing In...' : 'Sign in with Social Login'}
              </button>
            )}

            {!socialReady && (
              <p className="helper-text">
                Social login unavailable. Set <code>REACT_APP_WEB3AUTH_CLIENT_ID</code> to enable.
              </p>
            )}
            
            <button onClick={switchNetwork} className="network-button">
              Switch to Sepolia Testnet
            </button>
            
            <div className="testnet-info">
              <h4>🧪 Testnet Instructions:</h4>
              <ol>
                <li>Connect MetaMask to Sepolia testnet</li>
                <li>Get Sepolia ETH from <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer">faucet</a></li>
                <li>Click "Connect Wallet" to get Yellow Test USD</li>
                <li>Start lending or create circles!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <h1>🏛️ Bastion Protocol</h1>
          
          <div className="user-info">
            <div className="balance-info">
              <span>Yellow Test USD: {userBalance}</span>
              <span>Trust Score: {trustScore}/100</span>
            </div>
            <div className="account-info">
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
              <button onClick={disconnectWallet} className="disconnect-btn">Disconnect</button>
            </div>
          </div>
        </div>
        
        <nav className="nav-tabs">
          <button 
            className={activeTab === 'lending' ? 'active' : ''}
            onClick={() => setActiveTab('lending')}
          >
            💰 P2P Lending
          </button>
          <button 
            className={activeTab === 'circles' ? 'active' : ''}
            onClick={() => setActiveTab('circles')}
          >
            👥 ROSCA Circles
          </button>
          <button 
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
        </nav>
      </header>

      <main className="main-content">
        {activeTab === 'lending' && contractService && (
          <LendingInterface 
            contractService={contractService}
            nitroliteClient={nitroliteClient}
            userAddress={account}
          />
        )}
        
        {activeTab === 'circles' && contractService && (
          <CircleInterface 
            contractService={contractService}
            nitroliteClient={nitroliteClient}
            userAddress={account}
          />
        )}
        
        {activeTab === 'profile' && contractService && (
          <UserProfile 
            contractService={contractService}
            userAddress={account}
            trustScore={trustScore}
          />
        )}
      </main>
    </div>
  );
}

export default App;