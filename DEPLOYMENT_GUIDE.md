# Bastion Protocol MVP - Complete Deployment Guide

## Overview

This is the complete Bastion Protocol MVP featuring:
- **P2P Lending**: Direct peer-to-peer loans with collateral
- **ROSCA Circles**: Social lending circles with bidding
- **Trust Scoring**: Multi-dimensional reputation system
- **Nitrolite Integration**: Instant, gasless state channel operations
- **Sepolia Testnet**: Safe testing environment with Yellow Test USD

## Prerequisites

1. **MetaMask** with Sepolia testnet configured
2. **Sepolia ETH** from [Sepolia Faucet](https://sepoliafaucet.com)
3. **Node.js** v16+ and npm
4. **Foundry** for smart contracts

## Step 1: Deploy Smart Contracts

### 1.1 Install Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 1.2 Set Environment Variables
```bash
# In bastion-protocol/contracts/
export PRIVATE_KEY="your_private_key_here"
export SEPOLIA_RPC_URL="https://rpc.sepolia.org"
```

### 1.3 Build and Deploy Contracts
```bash
cd bastion-protocol/contracts
forge build
forge script script/DeployBastion.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

**Note:** Save the deployed contract addresses - you'll need them for the frontend!

### 1.4 Verify Contracts (Optional)
```bash
forge verify-contract [CONTRACT_ADDRESS] src/BastionCore.sol:BastionCore --chain-id 11155111
# Repeat for BastionLending and BastionCircles
```

## Step 2: Frontend Setup

### 2.1 Install Dependencies
```bash
cd bastion-protocol/frontend/bastion-app
npm install
```

### 2.2 Configure Contract Addresses
Edit `src/services/contract-service.ts` and update:
```typescript
export const CONTRACT_ADDRESSES = {
  BASTION_CORE: 'YOUR_DEPLOYED_CORE_ADDRESS',
  BASTION_LENDING: 'YOUR_DEPLOYED_LENDING_ADDRESS', 
  BASTION_CIRCLES: 'YOUR_DEPLOYED_CIRCLES_ADDRESS',
};
```

### 2.3 Start Development Server
```bash
npm start
```

The app will open at http://localhost:3000

## Step 3: Get Test Tokens

### 3.1 Connect Wallet
1. Click "Connect Wallet & Get Test Tokens"
2. This automatically requests Yellow Test USD from the faucet
3. Tokens go to your Clearnode unified balance (off-chain)

### 3.2 Manual Faucet Request
```bash
curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
-H "Content-Type: application/json" \
-d '{"userAddress": "YOUR_WALLET_ADDRESS"}'
```

### 3.3 Check Your Balance
The app displays your Yellow Test USD balance in the header.

## Step 4: Test the MVP Features

### 4.1 P2P Lending Flow
1. **Request Loan**: Click "Request Loan" and fill details
2. **Review Requests**: Browse available loan requests
3. **Fulfill Loan**: Click "Lend Money" to fulfill a request
4. **State Channel**: Funds transfer instantly via Nitrolite
5. **Settlement**: On-chain settlement when needed

### 4.2 ROSCA Circles Flow
1. **Create Circle**: Set monthly amount and invite members
2. **Join Circle**: Members stake funds to participate
3. **Submit Bids**: Bid for early access to the pool
4. **Distribution**: Lowest bidder wins monthly distribution
5. **Repeat**: Cycle continues until all members get turns

### 4.3 Trust Scoring
- Scores update based on payment history
- View breakdown in the Profile tab
- Better scores = better lending terms

## Architecture Details

### Smart Contracts (On-Chain)
- **BastionCore**: Trust scoring and user profiles
- **BastionLending**: P2P loan management
- **BastionCircles**: ROSCA circle operations

### State Channels (Off-Chain)
- **Instant Transfers**: No gas fees for payments
- **Bidding**: Real-time circle bidding
- **Settlements**: Efficient batch settlements

### Frontend
- **React + TypeScript**: Modern web interface
- **Ethers.js**: Blockchain connectivity
- **Nitrolite SDK**: State channel integration

## Testing Guide

### Test Loan Flow
1. Create loan request: 100 Test USD principal, 150 collateral, 5% rate
2. Switch to another account and fulfill the loan
3. Verify instant fund transfer via Nitrolite
4. Test repayment functionality

### Test Circle Flow
1. Create circle: 50 Test USD monthly, 2% rate, 5 members max
2. Invite friends or use multiple accounts
3. Submit bids for the first cycle
4. Verify distribution to lowest bidder

### Trust Score Testing
1. Complete successful loan repayments
2. Participate in circle cycles
3. Watch trust score increase over time
4. Test how higher scores affect loan terms

## Troubleshooting

### Common Issues

**"Insufficient funds"**
- Request more test tokens from faucet
- Ensure you have Sepolia ETH for gas

**"Transaction failed"**
- Check Sepolia network connection
- Verify contract addresses are correct
- Ensure sufficient allowances

**"State channel error"**
- Verify Nitrolite SDK connection
- Check Clearnode sandbox status
- Retry after a few seconds

### Development Tips

**Local Testing**
- Use Anvil for faster local testing: `anvil --fork-url $SEPOLIA_RPC_URL`
- Deploy contracts to local network first
- Test with multiple local accounts

**Production Readiness**
- Add comprehensive error handling
- Implement proper loading states
- Add transaction confirmation flows
- Integrate with ENS for better UX
- Add comprehensive test coverage

### Gas Optimization
- Batch operations where possible
- Use Nitrolite for frequent operations
- Only settle on-chain when necessary

## Security Considerations

This is an MVP for testing purposes. For production:

1. **Security Audits**: Full smart contract audits required
2. **Reentrancy Protection**: Already implemented in contracts
3. **Oracle Integration**: Add Chainlink for price feeds
4. **Multi-signature**: Use multi-sig for admin functions
5. **Timelocks**: Add timelocks for critical operations

## Next Steps

1. **Enhanced UI**: Improve user experience and design
2. **Mobile App**: React Native mobile application
3. **Advanced Features**: Liquidation mechanics, cross-chain support
4. **Analytics**: User behavior and protocol metrics
5. **Governance**: DAO for protocol upgrades

## Resources

- [Nitrolite Documentation](https://erc7824.org)
- [Yellow Network](https://yellow.org)
- [Sepolia Testnet](https://sepolia.dev)
- [Foundry Book](https://book.getfoundry.sh)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review contract events in block explorer
3. Test with minimal amounts first
4. Verify network connectivity

---

**Success!** 🎉 You now have a fully functional Bastion Protocol MVP with P2P lending, ROSCA circles, and instant state channel operations powered by Nitrolite SDK.