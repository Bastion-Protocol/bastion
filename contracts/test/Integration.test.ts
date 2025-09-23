import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  BastionProtocol, 
  LendingCircle, 
  StateChannel, 
  AaveIntegration, 
  SocialVerification 
} from "../typechain-types";

describe("Bastion Protocol Integration", function () {
  let bastionProtocol: BastionProtocol;
  let lendingCircle: LendingCircle;
  let stateChannel: StateChannel;
  let aaveIntegration: AaveIntegration;
  let socialVerification: SocialVerification;
  
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let member1: SignerWithAddress;
  let member2: SignerWithAddress;
  let member3: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let telegramBot: SignerWithAddress;

  const CONTRIBUTION_AMOUNT = ethers.parseEther("1");
  const PAYOUT_AMOUNT = ethers.parseEther("1");
  const DURATION = 30 * 24 * 3600; // 30 days
  const MAX_MEMBERS = 4;

  before(async function () {
    [owner, creator, member1, member2, member3, feeRecipient, telegramBot] = await ethers.getSigners();

    // Deploy all contracts
    const SocialVerificationFactory = await ethers.getContractFactory("SocialVerification");
    socialVerification = await SocialVerificationFactory.deploy(telegramBot.address);
    await socialVerification.waitForDeployment();

    const StateChannelFactory = await ethers.getContractFactory("StateChannel");
    stateChannel = await StateChannelFactory.deploy(owner.address);
    await stateChannel.waitForDeployment();

    const AaveIntegrationFactory = await ethers.getContractFactory("AaveIntegration");
    aaveIntegration = await AaveIntegrationFactory.deploy(owner.address);
    await aaveIntegration.waitForDeployment();

    const LendingCircleFactory = await ethers.getContractFactory("LendingCircle");
    lendingCircle = await LendingCircleFactory.deploy(
      await stateChannel.getAddress(),
      await aaveIntegration.getAddress(),
      await socialVerification.getAddress(),
      feeRecipient.address
    );
    await lendingCircle.waitForDeployment();

    const BastionProtocolFactory = await ethers.getContractFactory("BastionProtocol");
    bastionProtocol = await BastionProtocolFactory.deploy();
    await bastionProtocol.waitForDeployment();

    // Set up integrations
    await aaveIntegration.authorizeCircle(await lendingCircle.getAddress());

    // Verify all users
    const users = [creator, member1, member2, member3];
    for (const user of users) {
      await socialVerification.verifyUser(user.address, "telegram");
      await socialVerification.verifyUser(user.address, "github");
      await socialVerification.verifyUser(user.address, "twitter");
    }
  });

  describe("Full Lending Circle Lifecycle with State Channels", function () {
    it("Should complete a full lending circle with gasless transactions", async function () {
      // 1. Create a lending circle
      const tx = await lendingCircle.connect(creator).createCircle(
        "Integration Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress, // ETH
        false, // public
        50 // min reputation
      );

      await expect(tx)
        .to.emit(lendingCircle, "CircleCreated")
        .withArgs(1, creator.address, "Integration Test Circle", CONTRIBUTION_AMOUNT, MAX_MEMBERS);

      const circleId = 1;

      // 2. Members join the circle (creates state channels)
      const members = [member1, member2, member3];
      for (const member of members) {
        const joinTx = await lendingCircle.connect(member).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001") // Include state channel fee
        });

        await expect(joinTx)
          .to.emit(lendingCircle, "MemberJoined")
          .withArgs(circleId, member.address)
          .and.to.emit(lendingCircle, "StateChannelCreated");
      }

      // 3. Circle should auto-start when full
      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(2); // Active
      expect(circle.currentMembers).to.equal(4);

      // 4. Round 1: member1 wins
      await lendingCircle.connect(member1).placeBid(circleId, PAYOUT_AMOUNT, "Need funds for startup");
      await lendingCircle.connect(member2).placeBid(circleId, ethers.parseEther("0.9"), "Emergency funds");
      
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0); // Select member1's bid

      // 5. All members contribute
      const allMembers = [creator, member1, member2, member3];
      for (const member of allMembers) {
        await lendingCircle.connect(member).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      }

      // 6. Distribute payout
      const member1BalanceBefore = await ethers.provider.getBalance(member1.address);
      
      await lendingCircle.connect(creator).distributePayout(circleId);

      const member1BalanceAfter = await ethers.provider.getBalance(member1.address);
      expect(member1BalanceAfter).to.be.gt(member1BalanceBefore);

      // 7. Verify progression to round 2
      const updatedCircle = await lendingCircle.getCircle(circleId);
      expect(updatedCircle.currentRound).to.equal(2);

      // 8. Complete remaining rounds quickly
      for (let round = 2; round <= 4; round++) {
        const winner = allMembers[round - 1];
        
        // Place bids and select winner
        await lendingCircle.connect(winner).placeBid(circleId, PAYOUT_AMOUNT, `Round ${round}`);
        await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

        // All contribute
        for (const member of allMembers) {
          await lendingCircle.connect(member).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
        }

        // Distribute payout
        if (round === 4) {
          // Final round should complete the circle
          await expect(lendingCircle.connect(creator).distributePayout(circleId))
            .to.emit(lendingCircle, "CircleCompleted")
            .withArgs(circleId);
        } else {
          await lendingCircle.connect(creator).distributePayout(circleId);
        }
      }

      // 9. Verify circle completion
      const finalCircle = await lendingCircle.getCircle(circleId);
      expect(finalCircle.status).to.equal(3); // Completed

      // 10. Verify reputation updates
      for (const member of allMembers) {
        const reputation = await socialVerification.getReputationScore(member.address);
        expect(reputation).to.be.gt(75); // Should have gained reputation from verification + completion bonus
      }
    });
  });

  describe("Social Verification Integration", function () {
    it("Should integrate Telegram verification with reputation system", async function () {
      const [, , , , , , newUser] = await ethers.getSigners();
      const telegramId = 987654321;
      const username = "newuser";
      const timestamp = Math.floor(Date.now() / 1000);

      // Create and verify Telegram signature
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [newUser.address, telegramId, username, timestamp]
      );
      const signature = await telegramBot.signMessage(ethers.getBytes(messageHash));

      // Verify Telegram account
      await socialVerification.connect(newUser).verifyTelegram(telegramId, username, timestamp, signature);

      // Check that user was auto-verified with telegram method
      const hasCompleted = await socialVerification.hasCompletedMethod(newUser.address, "telegram");
      expect(hasCompleted).to.be.true;

      const reputation = await socialVerification.getReputationScore(newUser.address);
      expect(reputation).to.equal(30); // Telegram method score

      // Verify the user can join circles with reputation requirement
      await lendingCircle.connect(creator).createCircle(
        "Reputation Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        25 // min reputation (user has 30)
      );

      const circleId = 2;
      await expect(
        lendingCircle.connect(newUser).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      ).to.emit(lendingCircle, "MemberJoined");
    });

    it("Should reject users with insufficient reputation", async function () {
      const [, , , , , , , lowRepUser] = await ethers.getSigners();

      // Create circle with high reputation requirement
      await lendingCircle.connect(creator).createCircle(
        "High Rep Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        100 // High reputation requirement
      );

      const circleId = 3;

      // User with no verification should be rejected
      await expect(
        lendingCircle.connect(lowRepUser).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Insufficient reputation");
    });
  });

  describe("State Channel Gasless Transactions", function () {
    it("Should handle gasless state updates through relayers", async function () {
      // Open a direct state channel
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = 3600 * 24; // 1 day
      const totalAmount = amount1 + amount2 + ethers.parseEther("0.001"); // Include fee

      const tx = await stateChannel.openChannel(
        member1.address,
        member2.address,
        amount1,
        amount2,
        timeout,
        { value: totalAmount }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          return stateChannel.interface.parseLog(log)?.name === "ChannelOpened";
        } catch {
          return false;
        }
      });

      if (!event) throw new Error("ChannelOpened event not found");
      
      const parsedEvent = stateChannel.interface.parseLog(event);
      const channelId = parsedEvent?.args[0];

      // Create state update with new balances
      const newBalance1 = ethers.parseEther("0.3");
      const newBalance2 = ethers.parseEther("1.7");
      const nonce = 1;

      // Create signatures from participants
      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256", "uint256"],
        [channelId, nonce, newBalance1, newBalance2]
      );

      const signature1 = await member1.signMessage(ethers.getBytes(messageHash));
      const signature2 = await member2.signMessage(ethers.getBytes(messageHash));

      // Relayer signature for the transaction
      const relayHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address"],
        [channelId, nonce, owner.address]
      );
      const relayerSignature = await owner.signMessage(ethers.getBytes(relayHash));

      const update = {
        channelId: channelId,
        nonce: nonce,
        balance1: newBalance1,
        balance2: newBalance2,
        signature1: signature1,
        signature2: signature2
      };

      // Process relayed transaction
      await expect(
        stateChannel.relayTransaction(update, owner.address, relayerSignature)
      ).to.emit(stateChannel, "ChannelUpdated")
      .withArgs(channelId, nonce, newBalance1, newBalance2);

      // Verify the state was updated
      const channel = await stateChannel.getChannel(channelId);
      expect(channel.balance1).to.equal(newBalance1);
      expect(channel.balance2).to.equal(newBalance2);
      expect(channel.nonce).to.equal(nonce);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle banned users correctly", async function () {
      const [, , , , , , , bannedUser] = await ethers.getSigners();
      
      // First verify the user
      await socialVerification.verifyUser(bannedUser.address, "kyc");
      
      // Then ban them
      const banExpiry = Math.floor(Date.now() / 1000) + 86400; // 1 day
      await socialVerification.banUser(bannedUser.address, banExpiry, "Test ban");

      // Create a circle
      await lendingCircle.connect(creator).createCircle(
        "Ban Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        50
      );

      const circleId = 4;

      // Banned user should not be able to join
      await expect(
        lendingCircle.connect(bannedUser).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Insufficient reputation"); // Banned users have 0 reputation
    });

    it("Should handle circle cancellation with refunds", async function () {
      // Create and populate a circle
      await lendingCircle.connect(creator).createCircle(
        "Cancellation Test",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        50
      );

      const circleId = 5;

      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      // Cancel the circle
      const reason = "Not enough participants";
      await expect(
        lendingCircle.connect(creator).cancelCircle(circleId, reason)
      ).to.emit(lendingCircle, "CircleCancelled")
      .withArgs(circleId, reason);

      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(4); // Cancelled
    });
  });

  describe("Contract Information", function () {
    it("Should return correct protocol information", async function () {
      const info = await bastionProtocol.getInfo();
      expect(info[0]).to.equal("Bastion Protocol");
      expect(info[1]).to.equal("1.0.0");
    });

    it("Should have correct contract addresses linked", async function () {
      expect(await lendingCircle.stateChannelContract()).to.equal(await stateChannel.getAddress());
      expect(await lendingCircle.aaveIntegration()).to.equal(await aaveIntegration.getAddress());
      expect(await lendingCircle.socialVerification()).to.equal(await socialVerification.getAddress());
    });
  });
});