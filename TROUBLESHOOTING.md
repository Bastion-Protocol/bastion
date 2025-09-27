# Troubleshooting Guide

This guide helps resolve common issues when setting up and using Bastion Protocol.

## 🔧 Setup Issues

### Missing Foundry (forge command not found)
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
```

### Missing Docker/Docker Compose
```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker compose version
```

### Node.js Version Issues
```bash
# Use Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## 🏗️ Build Issues

### Contract Build Failures
```bash
# Clean and rebuild
cd bastion-protocol/contracts
rm -rf out/ cache/
forge clean
forge install
forge build
```

### SDK Build Failures
```bash
# Build Nitrolite contracts first
cd nitrolite/contract
make install
make build

# Then build SDK
cd ../sdk
npm install
npm run build
```

### Frontend Build Issues
**Error: Can't resolve 'crypto'**
```bash
# Install crypto polyfill
cd bastion-protocol/frontend/bastion-app
npm install crypto-browserify buffer process
```

Add to `webpack.config.js`:
```javascript
module.exports = {
  resolve: {
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser')
    }
  }
}
```

## 🌐 Network Issues

### Sepolia RPC Issues
```bash
# Try alternative RPC endpoints
export SEPOLIA_RPC="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
# or
export SEPOLIA_RPC="https://sepolia.infura.io/v3/YOUR_KEY"
```

### MetaMask Connection Issues
1. Ensure MetaMask is installed and unlocked
2. Add Sepolia network manually:
   - Network Name: Sepolia
   - RPC URL: https://rpc.sepolia.org
   - Chain ID: 11155111
   - Symbol: ETH

### Yellow Network Faucet Issues
```bash
# Manual faucet request
curl -X POST https://clearnet-sandbox.yellow.com/faucet/requestTokens \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "YOUR_WALLET_ADDRESS"}'
```

## 💰 Token Issues

### Insufficient Test ETH
- Get ETH from [Sepolia Faucet](https://sepoliafaucet.com)
- Alternative: [Alchemy Faucet](https://sepoliafaucet.com)
- Backup: [Infura Faucet](https://infura.io/faucet/sepolia)

### Yellow Test USD Not Received
1. Check wallet address is correct
2. Wait 1-2 minutes for processing
3. Check Clearnode balance in app
4. Try manual faucet request (see above)

## 🔒 Security Issues

### Private Key Warnings
- Never use mainnet private keys in development
- Create dedicated testnet wallet
- Use environment variables, not hardcoded keys
- Add `.env` to `.gitignore`

### Transaction Failures
```bash
# Check nonce issues
# Increase gas limit
# Verify contract addresses
# Check allowances for ERC20 operations
```

## ⚡ State Channel Issues

### Clearnode Connection Failed
1. Check network connectivity
2. Verify Clearnode is running (if local)
3. Try different Clearnode endpoint
4. Check firewall settings

### Channel Creation Failed
- Ensure sufficient balance
- Check participant addresses
- Verify contract deployment
- Monitor gas usage

## 🧪 Testing Issues

### Contract Tests Failing
```bash
# Run specific test
forge test --match-test testCreateLoan -vvvv

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

### Frontend Tests Failing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests in watch mode
npm test -- --watchAll=false
```

## 📱 Frontend Issues

### Page Not Loading
1. Check console for JavaScript errors
2. Verify all dependencies installed
3. Check port 3000 is available
4. Try clearing browser cache

### Wallet Not Connecting
1. Refresh page
2. Check MetaMask is unlocked
3. Switch to correct network (Sepolia)
4. Clear browser storage
5. Try incognito/private mode

### State Not Updating
1. Check network connectivity
2. Verify transaction succeeded
3. Look for error messages in console
4. Try refreshing the page

## 📊 Performance Issues

### Slow Transaction Times
- Check Sepolia network status
- Increase gas price
- Verify RPC endpoint health
- Try different RPC provider

### High Gas Costs
- Use state channels for frequent operations
- Batch operations where possible
- Optimize contract calls
- Use view functions when possible

## 🐛 Common Error Messages

### "insufficient funds for gas * price + value"
- Get more Sepolia ETH from faucet
- Check wallet balance
- Reduce transaction value

### "nonce too low"
- Reset MetaMask account
- Wait for pending transactions
- Manually set nonce

### "execution reverted"
- Check contract function requirements
- Verify input parameters
- Look at contract events/logs
- Check allowances

## 📞 Getting Help

### Before Asking for Help
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Check Discord for similar questions
4. Try the solution in a clean environment

### How to Report Issues
Include:
- Operating system and version
- Node.js version (`node --version`)
- Browser and version
- Exact error messages
- Steps to reproduce
- What you expected to happen

### Community Support
- **Discord**: Real-time help from community
- **GitHub Issues**: Bug reports and feature requests
- **Stack Overflow**: Tag with `bastion-protocol`
- **Twitter**: @BastionProtocol for updates

### Emergency Issues
For security vulnerabilities or critical bugs:
- Email: security@bastionprotocol.com
- PGP Key: Available on website
- Response time: <24 hours

---

Still having issues? Join our [Discord community](https://discord.gg/bastionprotocol) for real-time support!