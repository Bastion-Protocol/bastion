#!/bin/bash

# 🚀 Bastion Protocol - One-Click Deployment Script
# This script deploys the complete Bastion Protocol MVP

set -e  # Exit on any error

echo "🏛️ Bastion Protocol Deployment Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if foundry is installed
if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Foundry not found. Installing...${NC}"
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check complete${NC}"

# Get deployment parameters
echo -e "${YELLOW}📝 Deployment Configuration${NC}"

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${YELLOW}Enter your deployment wallet private key (starts with 0x):${NC}"
    read -s PRIVATE_KEY
    export PRIVATE_KEY
fi

if [ -z "$SEPOLIA_RPC_URL" ]; then
  echo -e "${YELLOW}Enter Sepolia RPC URL:${NC}"
  read SEPOLIA_RPC_URL
  export SEPOLIA_RPC_URL
fi

# Derive wallet address from private key
WALLET_ADDRESS=$(cast wallet address $PRIVATE_KEY)
echo -e "${BLUE}Deployment wallet: $WALLET_ADDRESS${NC}"

# Check wallet balance
BALANCE=$(cast balance $WALLET_ADDRESS --rpc-url $SEPOLIA_RPC_URL)
BALANCE_ETH=$(cast --to-unit $BALANCE ether)
echo -e "${BLUE}Wallet balance: $BALANCE_ETH ETH${NC}"

if (( $(echo "$BALANCE_ETH < 0.05" | bc -l) )); then
    echo -e "${RED}❌ Insufficient balance. Need at least 0.05 ETH for deployment.${NC}"
    echo -e "${YELLOW}Get Sepolia ETH from: https://sepoliafaucet.com${NC}"
    exit 1
fi

# Deploy Smart Contracts
echo -e "${YELLOW}🔨 Deploying Smart Contracts...${NC}"

cd bastion-protocol/contracts

# Install dependencies
forge install --no-commit

# Build contracts
echo -e "${BLUE}Building contracts...${NC}"
forge build

# Deploy BastionCore
echo -e "${BLUE}Deploying BastionCore...${NC}"
BASTION_CORE_ADDRESS=$(forge create --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY src/BastionCore.sol:BastionCore --json | jq -r '.deployedTo')
echo -e "${GREEN}✅ BastionCore deployed at: $BASTION_CORE_ADDRESS${NC}"

# Deploy BastionLending
echo -e "${BLUE}Deploying BastionLending...${NC}"
BASTION_LENDING_ADDRESS=$(forge create --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY src/BastionLending.sol:BastionLending --json | jq -r '.deployedTo')
echo -e "${GREEN}✅ BastionLending deployed at: $BASTION_LENDING_ADDRESS${NC}"

# Deploy BastionCircles
echo -e "${BLUE}Deploying BastionCircles...${NC}"
BASTION_CIRCLES_ADDRESS=$(forge create --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY src/BastionCircles.sol:BastionCircles --json | jq -r '.deployedTo')
echo -e "${GREEN}✅ BastionCircles deployed at: $BASTION_CIRCLES_ADDRESS${NC}"

# Update Frontend Configuration
echo -e "${YELLOW}⚙️ Configuring Frontend...${NC}"

cd ../frontend/bastion-app

# Update .env file with deployed addresses
cat > .env << EOF
# 🏛️ Bastion Protocol - Deployed Configuration
REACT_APP_BASTION_CORE_ADDRESS=$BASTION_CORE_ADDRESS
REACT_APP_BASTION_LENDING_ADDRESS=$BASTION_LENDING_ADDRESS
REACT_APP_BASTION_CIRCLES_ADDRESS=$BASTION_CIRCLES_ADDRESS
REACT_APP_CHAIN_ID=11155111
REACT_APP_CHAIN_NAME=Sepolia Test Network
REACT_APP_RPC_URL=$SEPOLIA_RPC_URL
REACT_APP_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
REACT_APP_NITROLITE_WS_URL=wss://clearnet-sandbox.yellow.com/ws
REACT_APP_FAUCET_URL=https://clearnet-sandbox.yellow.com/faucet/requestTokens
REACT_APP_YELLOW_TEST_ASSET=yellow-test-usd
REACT_APP_WEB3AUTH_CLIENT_ID=
REACT_APP_NAME=Bastion Protocol
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
EOF

echo -e "${GREEN}✅ Frontend configuration updated${NC}"

# Install dependencies and build
echo -e "${BLUE}Installing frontend dependencies...${NC}"
npm install

echo -e "${BLUE}Building frontend application...${NC}"
npm run build

# Deployment Summary
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}======================${NC}"
echo -e "${BLUE}Smart Contracts:${NC}"
echo -e "  BastionCore: $BASTION_CORE_ADDRESS"
echo -e "  BastionLending: $BASTION_LENDING_ADDRESS" 
echo -e "  BastionCircles: $BASTION_CIRCLES_ADDRESS"
echo -e ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Verify contracts on Etherscan:"
echo -e "   https://sepolia.etherscan.io/address/$BASTION_CORE_ADDRESS"
echo -e ""
echo -e "2. Deploy frontend to hosting platform:"
echo -e "   ${YELLOW}IPFS:${NC} ipfs add -r build/"
echo -e "   ${YELLOW}Vercel:${NC} vercel --prod"
echo -e "   ${YELLOW}Netlify:${NC} netlify deploy --prod --dir=build"
echo -e ""
echo -e "3. Test the application:"
echo -e "   - Connect MetaMask to Sepolia testnet"
echo -e "   - Get test tokens from Yellow Network faucet"
echo -e "   - Create loans and circles"
echo -e ""
echo -e "${GREEN}🏛️ Bastion Protocol is ready for users! 🚀${NC}"

# Save deployment info
cat > deployment-info.json << EOF
{
  "network": "sepolia",
  "chainId": 11155111,
  "deployer": "$WALLET_ADDRESS",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "BastionCore": "$BASTION_CORE_ADDRESS",
    "BastionLending": "$BASTION_LENDING_ADDRESS",
    "BastionCircles": "$BASTION_CIRCLES_ADDRESS"
  },
  "explorer": {
    "BastionCore": "https://sepolia.etherscan.io/address/$BASTION_CORE_ADDRESS",
    "BastionLending": "https://sepolia.etherscan.io/address/$BASTION_LENDING_ADDRESS",
    "BastionCircles": "https://sepolia.etherscan.io/address/$BASTION_CIRCLES_ADDRESS"
  }
}
EOF

echo -e "${BLUE}📄 Deployment info saved to deployment-info.json${NC}"