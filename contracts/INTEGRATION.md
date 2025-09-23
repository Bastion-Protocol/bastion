# Bastion Protocol Smart Contracts - Integration Guide

## Yellow Network Integration

The Bastion Protocol leverages Yellow Network's Nitrolite Protocol for fast, low-cost transactions through ERC-7824 state channels.

### State Channel Architecture

```solidity
// Example: Opening a state channel for a lending circle member
function joinCircle(uint256 circleId) external payable {
    // Create state channel for gasless transactions
    bytes32 channelId = stateChannelContract.openChannel{value: msg.value}(
        msg.sender,
        address(this),
        circle.contributionAmount,
        0,
        circle.duration * circle.maxMembers
    );
    memberStateChannels[circleId][msg.sender] = channelId;
}
```

### Gasless Transaction Flow

1. **Channel Opening**: When users join a lending circle, a state channel is automatically created
2. **Off-chain Updates**: Contributions and payments happen off-chain with cryptographic proofs
3. **Relayer Network**: Authorized relayers process transactions without gas costs to users
4. **On-chain Settlement**: Final balances are settled on-chain when the circle completes

### Relayer Integration

```solidity
// Authorized relayers can process gasless state updates
function relayTransaction(
    StateUpdate calldata update,
    address relayer,
    bytes calldata relayerSignature
) external {
    require(authorizedRelayers[relayer], "Unauthorized relayer");
    // Process the update without gas cost to users
    updateChannel(update);
    payable(relayer).transfer(relayerFee);
}
```

## Usage Examples

### Creating a Lending Circle

```javascript
// Frontend integration example
const lendingCircle = new ethers.Contract(contractAddress, abi, signer);

const tx = await lendingCircle.createCircle(
    "My Community Circle",        // name
    ethers.parseEther("100"),    // contribution amount (100 tokens)
    ethers.parseEther("100"),    // payout amount
    30 * 24 * 3600,             // 30 days duration
    5,                          // max 5 members
    "0x0000000000000000000000000000000000000000", // ETH
    false,                      // public circle
    50                          // minimum reputation score
);
```

### Joining a Circle

```javascript
// Join a lending circle with state channel creation
const contributionAmount = ethers.parseEther("100");
const stateChannelFee = ethers.parseEther("0.001");

const tx = await lendingCircle.joinCircle(circleId, {
    value: contributionAmount + stateChannelFee
});
```

### Social Verification Flow

```javascript
// Telegram verification example
const socialVerification = new ethers.Contract(verificationAddress, abi, signer);

// 1. User initiates Telegram verification through bot
// 2. Bot signs verification data
const signature = await telegramBot.signMessage(messageHash);

// 3. User submits verification on-chain
const tx = await socialVerification.verifyTelegram(
    telegramId,
    username,
    timestamp,
    signature
);
```

### Bidding Process

```javascript
// Place a bid for the current round
const tx = await lendingCircle.placeBid(
    circleId,
    ethers.parseEther("95"), // bid amount (5% discount)
    "Need funds for business expansion"
);

// Circle admin selects winning bid
const selectTx = await lendingCircle.selectWinningBid(circleId, bidIndex);
```

### Aave Yield Optimization

```javascript
// Deposit idle funds to Aave for yield
const aaveIntegration = new ethers.Contract(aaveAddress, abi, signer);

const tx = await lendingCircle.depositToAave(
    circleId,
    ethers.parseEther("500") // deposit amount
);

// Auto-compound yield
const compoundTx = await aaveIntegration.autoCompound(tokenAddress);
```

## Security Considerations

### State Channel Security

1. **Dispute Resolution**: Automated dispute mechanism with 24-hour timeout
2. **Signature Verification**: All state updates require signatures from both participants
3. **Timelock Protection**: Emergency withdrawal after dispute timeout

### Access Control

```solidity
// Role-based access control
bytes32 public constant CIRCLE_ADMIN_ROLE = keccak256("CIRCLE_ADMIN_ROLE");
bytes32 public constant VERIFIED_MEMBER_ROLE = keccak256("VERIFIED_MEMBER_ROLE");

modifier onlyCircleAdmin(uint256 circleId) {
    require(
        circles[circleId].creator == msg.sender || 
        hasRole(CIRCLE_ADMIN_ROLE, msg.sender),
        "Not authorized"
    );
    _;
}
```

### Reputation System

```solidity
// Reputation updates for circle completion
function recordCircleCompletion(address user) external onlyRole(VERIFIER_ROLE) {
    userVerifications[user].successfulCircles++;
    _updateReputationScore(user, 10, true); // Bonus for completion
}

// Penalties for defaults
function recordDefault(address user) external onlyRole(VERIFIER_ROLE) {
    userVerifications[user].defaultCount++;
    _updateReputationScore(user, 50, false); // Penalty for defaulting
    
    // Auto-ban if too many defaults
    if (userVerifications[user].defaultCount >= 3) {
        banUser(user, block.timestamp + 30 days, "Multiple defaults");
    }
}
```

## Event Monitoring

### Key Events to Monitor

```javascript
// Listen for circle lifecycle events
lendingCircle.on("CircleCreated", (circleId, creator, name) => {
    console.log(`New circle created: ${name} by ${creator}`);
});

lendingCircle.on("MemberJoined", (circleId, member) => {
    console.log(`Member ${member} joined circle ${circleId}`);
});

lendingCircle.on("PayoutDistributed", (circleId, round, recipient, amount) => {
    console.log(`Payout of ${amount} distributed to ${recipient}`);
});

// Monitor state channel events
stateChannel.on("ChannelOpened", (channelId, participant1, participant2) => {
    console.log(`State channel opened: ${channelId}`);
});

// Track social verification progress
socialVerification.on("UserVerified", (user, method, newScore) => {
    console.log(`User ${user} verified via ${method}, score: ${newScore}`);
});
```

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npx hardhat test test/LendingCircle.test.ts

# Run integration tests
npx hardhat test test/Integration.test.ts
```

### Test Coverage

The test suite covers:
- ✅ State channel operations (open, update, close, dispute)
- ✅ Lending circle lifecycle (create, join, bid, contribute, distribute)
- ✅ Social verification methods and reputation management
- ✅ Aave integration for yield optimization
- ✅ Access control and security mechanisms
- ✅ Edge cases and error handling

## Deployment

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy:testnet -- --network sepolia

# Verify contracts
npx hardhat verify DEPLOYED_ADDRESS --network sepolia
```

### Environment Configuration

```bash
# Required environment variables
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
TELEGRAM_BOT_SIGNER=telegram_bot_address
YELLOW_NETWORK_ORACLE=yellow_oracle_address
AAVE_ADDRESSES_PROVIDER=aave_provider_address
FEE_RECIPIENT=fee_recipient_address
```

## Support

For questions and support:
- GitHub Issues: [Bastion Protocol Repository](https://github.com/Bastion-Protocol/bastion)
- Documentation: [docs/contracts.md](../docs/contracts.md)
- Discord: [Join our community](https://discord.gg/bastion-protocol)