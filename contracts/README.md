# Smart Contracts

Solidity smart contracts implementing the Bastion Protocol lending circles with ERC-7824 state channels.

## 🏗️ Architecture

The Bastion Protocol smart contract system consists of five main contracts:

### Core Contracts

1. **BastionProtocol.sol** - Main protocol contract providing system information
2. **LendingCircle.sol** - Core lending circle functionality with member management, bidding, and fund distribution
3. **StateChannel.sol** - ERC-7824 state channel implementation for gasless transactions
4. **SocialVerification.sol** - Social verification and reputation management system
5. **AaveIntegration.sol** - Integration with Aave Protocol v3 for yield optimization

### Contract Interactions

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LendingCircle │◄──►│   StateChannel   │◄──►│ Yellow Network  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│SocialVerification│    │  AaveIntegration │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Telegram Bot    │    │   Aave Protocol  │
└─────────────────┘    └──────────────────┘
```

## 📋 Features

### ERC-7824 State Channels
- **Gasless Transactions**: Off-chain transaction processing with on-chain settlement
- **Yellow Network Integration**: Compatible with Yellow Network's Nitrolite Protocol
- **Dispute Resolution**: Secure dispute mechanism with timelock protection
- **Relayer Support**: Authorized relayers for gasless transaction processing

### Lending Circles
- **Circle Creation**: Customizable lending circles with configurable parameters
- **Member Management**: Invitation system for private circles, open joining for public circles
- **Bidding System**: Democratic bidding process for fund distribution order
- **Automated Distributions**: Smart contract-based fund distribution with fee collection
- **Multi-token Support**: Support for ETH and ERC20 tokens

### Social Verification
- **Multi-method Verification**: Telegram, GitHub, Twitter, LinkedIn, KYC verification
- **Reputation Scoring**: Dynamic reputation system based on verification and performance
- **Attestation System**: Peer-to-peer attestations for enhanced trust
- **Ban Management**: Automated and manual user banning for misconduct

### Aave Integration
- **Yield Optimization**: Automatic deposit of idle funds into Aave lending pools
- **Auto-compounding**: Reinvestment of earned yield for maximum returns
- **Multi-token Support**: Support for all Aave-compatible tokens
- **Risk Management**: Conservative approach to yield farming

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Hardhat

### Installation

```bash
cd contracts
npm install
```

### Environment Setup

Create a `.env` file:

```bash
# Network Configuration
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_private_key

# API Keys for Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
OPTIMISM_API_KEY=your_optimism_api_key
BASESCAN_API_KEY=your_basescan_api_key

# Gas Reporting
REPORT_GAS=true
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# Contract Configuration
TELEGRAM_BOT_SIGNER=0x...
YELLOW_NETWORK_ORACLE=0x...
AAVE_ADDRESSES_PROVIDER=0x...
FEE_RECIPIENT=0x...
```

### Compilation

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx hardhat test test/LendingCircle.test.ts

# Run with gas reporting
REPORT_GAS=true npm test
```

### Local Development

```bash
# Start local Hardhat node
npm run dev

# Deploy to local network
npm run deploy:localhost
```

## 🌐 Deployment

### Testnet Deployment

```bash
# Deploy to Sepolia
npm run deploy:testnet -- --network sepolia

# Deploy to Polygon Mumbai
npm run deploy:testnet -- --network mumbai

# Deploy to Arbitrum Goerli
npm run deploy:testnet -- --network arbitrumGoerli

# Deploy to Optimism Goerli
npm run deploy:testnet -- --network optimismGoerli

# Deploy to Base Goerli
npm run deploy:testnet -- --network baseGoerli
```

### Mainnet Deployment

```bash
# Deploy to Ethereum Mainnet
npm run deploy:mainnet -- --network mainnet

# Deploy to Polygon
npm run deploy:mainnet -- --network polygon

# Deploy to Arbitrum
npm run deploy:mainnet -- --network arbitrum

# Deploy to Optimism
npm run deploy:mainnet -- --network optimism

# Deploy to Base
npm run deploy:mainnet -- --network base
```

### Contract Verification

After deployment, verify contracts on block explorers:

```bash
# Verify on Etherscan (example)
npx hardhat verify DEPLOYED_ADDRESS "CONSTRUCTOR_ARG1" "CONSTRUCTOR_ARG2" --network sepolia
```

## 📊 Test Coverage

The test suite aims for 100% code coverage across all contracts:

- **StateChannel.test.ts** - Tests state channel functionality, dispute resolution, Yellow Network integration
- **LendingCircle.test.ts** - Tests lending circle lifecycle, member management, bidding system
- **SocialVerification.test.ts** - Tests verification methods, reputation system, ban management
- **Integration.test.ts** - Tests full system integration and cross-contract interactions

### Running Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## 🔒 Security

### Audit Checklist

- [x] **ReentrancyGuard** - All external calls protected
- [x] **Access Control** - Role-based permissions implemented
- [x] **Input Validation** - All user inputs validated
- [x] **Integer Overflow** - Using Solidity 0.8.x built-in protection
- [x] **External Dependencies** - Using audited OpenZeppelin contracts
- [x] **State Management** - Proper state transitions enforced
- [x] **Error Handling** - Comprehensive error messages and revert conditions

### Known Considerations

1. **Oracle Dependencies** - Relies on external oracles for Telegram verification
2. **Aave Integration** - Subject to Aave protocol risks and changes
3. **Yellow Network** - Integration depends on Yellow Network infrastructure
4. **Gas Costs** - State channel operations require careful gas management

## 🛠️ Development

### Code Style

- Solidity 0.8.19
- OpenZeppelin contracts for security
- NatSpec documentation for all public functions
- Comprehensive error messages
- Gas-optimized code structure

### Testing Strategy

1. **Unit Tests** - Individual contract functionality
2. **Integration Tests** - Cross-contract interactions
3. **Edge Case Tests** - Boundary conditions and error states
4. **Gas Optimization Tests** - Gas usage analysis

### Linting

```bash
npm run lint
npm run lint:fix
```

## 📚 Contract Documentation

### LendingCircle.sol

Main contract managing lending circles with the following key functions:

- `createCircle()` - Create a new lending circle
- `joinCircle()` - Join an existing circle
- `placeBid()` - Place a bid for current round
- `contribute()` - Make contribution to current round
- `distributePayout()` - Distribute funds to round winner

### StateChannel.sol

ERC-7824 implementation providing:

- `openChannel()` - Open new state channel
- `updateChannel()` - Update channel state off-chain
- `closeChannel()` - Close channel and settle
- `disputeChannel()` - Initiate dispute resolution

### SocialVerification.sol

Social verification system with:

- `verifyUser()` - Verify user through specific method
- `createAttestation()` - Create peer attestation
- `verifyTelegram()` - Telegram bot integration
- `updateReputationScore()` - Manual reputation updates

### AaveIntegration.sol

Aave protocol integration for:

- `deposit()` - Deposit funds to Aave
- `withdraw()` - Withdraw funds from Aave
- `harvestYield()` - Collect earned yield
- `autoCompound()` - Reinvest yield automatically

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write comprehensive tests
4. Ensure all tests pass and coverage is maintained
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.