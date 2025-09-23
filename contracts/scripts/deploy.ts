import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Bastion Protocol contract deployment...");
  
  // Get the deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Configuration
  const TELEGRAM_BOT_SIGNER = process.env.TELEGRAM_BOT_SIGNER || deployer.address;
  const YELLOW_NETWORK_ORACLE = process.env.YELLOW_NETWORK_ORACLE || deployer.address;
  const AAVE_ADDRESSES_PROVIDER = process.env.AAVE_ADDRESSES_PROVIDER || deployer.address; // Mock for testnets
  const FEE_RECIPIENT = process.env.FEE_RECIPIENT || deployer.address;

  console.log("\n📋 Deployment Configuration:");
  console.log("- Telegram Bot Signer:", TELEGRAM_BOT_SIGNER);
  console.log("- Yellow Network Oracle:", YELLOW_NETWORK_ORACLE);
  console.log("- Aave Addresses Provider:", AAVE_ADDRESSES_PROVIDER);
  console.log("- Fee Recipient:", FEE_RECIPIENT);

  // Deploy SocialVerification
  console.log("\n🔐 Deploying SocialVerification...");
  const SocialVerificationFactory = await ethers.getContractFactory("SocialVerification");
  const socialVerification = await SocialVerificationFactory.deploy(TELEGRAM_BOT_SIGNER);
  await socialVerification.waitForDeployment();
  const socialVerificationAddress = await socialVerification.getAddress();
  console.log("✅ SocialVerification deployed to:", socialVerificationAddress);

  // Deploy StateChannel
  console.log("\n⚡ Deploying StateChannel...");
  const StateChannelFactory = await ethers.getContractFactory("StateChannel");
  const stateChannel = await StateChannelFactory.deploy(YELLOW_NETWORK_ORACLE);
  await stateChannel.waitForDeployment();
  const stateChannelAddress = await stateChannel.getAddress();
  console.log("✅ StateChannel deployed to:", stateChannelAddress);

  // Deploy AaveIntegration
  console.log("\n🏦 Deploying AaveIntegration...");
  const AaveIntegrationFactory = await ethers.getContractFactory("AaveIntegration");
  const aaveIntegration = await AaveIntegrationFactory.deploy(AAVE_ADDRESSES_PROVIDER);
  await aaveIntegration.waitForDeployment();
  const aaveIntegrationAddress = await aaveIntegration.getAddress();
  console.log("✅ AaveIntegration deployed to:", aaveIntegrationAddress);

  // Deploy LendingCircle
  console.log("\n🔄 Deploying LendingCircle...");
  const LendingCircleFactory = await ethers.getContractFactory("LendingCircle");
  const lendingCircle = await LendingCircleFactory.deploy(
    stateChannelAddress,
    aaveIntegrationAddress,
    socialVerificationAddress,
    FEE_RECIPIENT
  );
  await lendingCircle.waitForDeployment();
  const lendingCircleAddress = await lendingCircle.getAddress();
  console.log("✅ LendingCircle deployed to:", lendingCircleAddress);

  // Authorize LendingCircle in AaveIntegration
  console.log("\n🔗 Setting up contract integrations...");
  await aaveIntegration.authorizeCircle(lendingCircleAddress);
  console.log("✅ Authorized LendingCircle in AaveIntegration");

  // Deploy BastionProtocol (main contract)
  console.log("\n🏰 Deploying BastionProtocol...");
  const BastionProtocolFactory = await ethers.getContractFactory("BastionProtocol");
  const bastionProtocol = await BastionProtocolFactory.deploy();
  await bastionProtocol.waitForDeployment();
  const bastionProtocolAddress = await bastionProtocol.getAddress();
  console.log("✅ BastionProtocol deployed to:", bastionProtocolAddress);

  // Summary
  console.log("\n🎉 Deployment Summary:");
  console.log("=====================================");
  console.log("🏰 BastionProtocol:", bastionProtocolAddress);
  console.log("🔄 LendingCircle:", lendingCircleAddress);
  console.log("⚡ StateChannel:", stateChannelAddress);
  console.log("🏦 AaveIntegration:", aaveIntegrationAddress);
  console.log("🔐 SocialVerification:", socialVerificationAddress);
  console.log("=====================================");

  // Verification instructions
  console.log("\n📋 Contract Verification Commands:");
  console.log(`npx hardhat verify ${bastionProtocolAddress} --network ${(await ethers.provider.getNetwork()).name}`);
  console.log(`npx hardhat verify ${socialVerificationAddress} ${TELEGRAM_BOT_SIGNER} --network ${(await ethers.provider.getNetwork()).name}`);
  console.log(`npx hardhat verify ${stateChannelAddress} ${YELLOW_NETWORK_ORACLE} --network ${(await ethers.provider.getNetwork()).name}`);
  console.log(`npx hardhat verify ${aaveIntegrationAddress} ${AAVE_ADDRESSES_PROVIDER} --network ${(await ethers.provider.getNetwork()).name}`);
  console.log(`npx hardhat verify ${lendingCircleAddress} ${stateChannelAddress} ${aaveIntegrationAddress} ${socialVerificationAddress} ${FEE_RECIPIENT} --network ${(await ethers.provider.getNetwork()).name}`);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      BastionProtocol: bastionProtocolAddress,
      LendingCircle: lendingCircleAddress,
      StateChannel: stateChannelAddress,
      AaveIntegration: aaveIntegrationAddress,
      SocialVerification: socialVerificationAddress
    },
    configuration: {
      telegramBotSigner: TELEGRAM_BOT_SIGNER,
      yellowNetworkOracle: YELLOW_NETWORK_ORACLE,
      aaveAddressesProvider: AAVE_ADDRESSES_PROVIDER,
      feeRecipient: FEE_RECIPIENT
    }
  };

  console.log("\n💾 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });