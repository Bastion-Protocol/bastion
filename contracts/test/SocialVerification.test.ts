import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SocialVerification } from "../typechain-types";

describe("SocialVerification", function () {
  let socialVerification: SocialVerification;
  let owner: SignerWithAddress;
  let telegramBot: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let attestor: SignerWithAddress;
  let verifier: SignerWithAddress;

  beforeEach(async function () {
    [owner, telegramBot, user1, user2, attestor, verifier] = await ethers.getSigners();

    const SocialVerificationFactory = await ethers.getContractFactory("SocialVerification");
    socialVerification = await SocialVerificationFactory.deploy(telegramBot.address);
    await socialVerification.waitForDeployment();

    // Grant roles
    await socialVerification.grantRole(await socialVerification.VERIFIER_ROLE(), verifier.address);
    await socialVerification.grantRole(await socialVerification.ATTESTOR_ROLE(), attestor.address);
  });

  describe("Verification Methods", function () {
    it("Should have default verification methods", async function () {
      const methods = await socialVerification.getVerificationMethods();
      expect(methods).to.include("telegram");
      expect(methods).to.include("github");
      expect(methods).to.include("twitter");
      expect(methods).to.include("linkedin");
      expect(methods).to.include("kyc");
    });

    it("Should add new verification method", async function () {
      await expect(
        socialVerification.addVerificationMethod("discord", 15, ethers.ZeroAddress)
      )
        .to.emit(socialVerification, "VerificationMethodAdded")
        .withArgs("discord", 15, ethers.ZeroAddress);

      const method = await socialVerification.getVerificationMethod("discord");
      expect(method.scoreWeight).to.equal(15);
      expect(method.isActive).to.be.true;
    });

    it("Should update verification method", async function () {
      await socialVerification.updateVerificationMethod("telegram", 35, true, user1.address);

      const method = await socialVerification.getVerificationMethod("telegram");
      expect(method.scoreWeight).to.equal(35);
      expect(method.isActive).to.be.true;
      expect(method.oracle).to.equal(user1.address);
    });

    it("Should restrict method management to admin", async function () {
      await expect(
        socialVerification.connect(user1).addVerificationMethod("test", 10, ethers.ZeroAddress)
      ).to.be.reverted;

      await expect(
        socialVerification.connect(user1).updateVerificationMethod("telegram", 50, true, ethers.ZeroAddress)
      ).to.be.reverted;
    });
  });

  describe("User Verification", function () {
    it("Should verify user with telegram method", async function () {
      await expect(
        socialVerification.connect(verifier).verifyUser(user1.address, "telegram")
      )
        .to.emit(socialVerification, "UserVerified")
        .withArgs(user1.address, "telegram", 30); // Default telegram weight

      const hasCompleted = await socialVerification.hasCompletedMethod(user1.address, "telegram");
      expect(hasCompleted).to.be.true;

      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(30);
    });

    it("Should verify user with multiple methods", async function () {
      await socialVerification.connect(verifier).verifyUser(user1.address, "telegram");
      await socialVerification.connect(verifier).verifyUser(user1.address, "github");
      await socialVerification.connect(verifier).verifyUser(user1.address, "twitter");

      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(75); // 30 + 25 + 20

      const isVerified = await socialVerification.isVerified(user1.address);
      expect(isVerified).to.be.true; // Should be verified as score >= 100
    });

    it("Should achieve verified status with sufficient score", async function () {
      // KYC method gives 100 points
      await socialVerification.connect(verifier).verifyUser(user1.address, "kyc");

      const isVerified = await socialVerification.isVerified(user1.address);
      expect(isVerified).to.be.true;

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.isVerified).to.be.true;
      expect(userVerification.reputationScore).to.equal(100);
    });

    it("Should prevent double verification with same method", async function () {
      await socialVerification.connect(verifier).verifyUser(user1.address, "telegram");

      await expect(
        socialVerification.connect(verifier).verifyUser(user1.address, "telegram")
      ).to.be.revertedWith("Already verified with this method");
    });

    it("Should restrict verification to verifier role", async function () {
      await expect(
        socialVerification.connect(user1).verifyUser(user2.address, "telegram")
      ).to.be.reverted;
    });
  });

  describe("Telegram Verification", function () {
    it("Should verify Telegram account with valid signature", async function () {
      const telegramId = 123456789;
      const username = "testuser";
      const timestamp = Math.floor(Date.now() / 1000);

      // Create signature
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [user1.address, telegramId, username, timestamp]
      );
      const signature = await telegramBot.signMessage(ethers.getBytes(messageHash));

      await expect(
        socialVerification.connect(user1).verifyTelegram(telegramId, username, timestamp, signature)
      )
        .to.emit(socialVerification, "TelegramVerified")
        .withArgs(user1.address, telegramId, username);

      const telegramVerification = await socialVerification.getTelegramVerification(user1.address);
      expect(telegramVerification.telegramId).to.equal(telegramId);
      expect(telegramVerification.username).to.equal(username);
      expect(telegramVerification.isVerified).to.be.true;

      const addressFromId = await socialVerification.getAddressFromTelegramId(telegramId);
      expect(addressFromId).to.equal(user1.address);
    });

    it("Should reject expired signature", async function () {
      const telegramId = 123456789;
      const username = "testuser";
      const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [user1.address, telegramId, username, timestamp]
      );
      const signature = await telegramBot.signMessage(ethers.getBytes(messageHash));

      await expect(
        socialVerification.connect(user1).verifyTelegram(telegramId, username, timestamp, signature)
      ).to.be.revertedWith("Signature expired");
    });

    it("Should reject invalid signature", async function () {
      const telegramId = 123456789;
      const username = "testuser";
      const timestamp = Math.floor(Date.now() / 1000);

      // Wrong signer
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [user1.address, telegramId, username, timestamp]
      );
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      await expect(
        socialVerification.connect(user1).verifyTelegram(telegramId, username, timestamp, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should prevent duplicate Telegram ID usage", async function () {
      const telegramId = 123456789;
      const username1 = "user1";
      const username2 = "user2";
      const timestamp = Math.floor(Date.now() / 1000);

      // First user verifies
      const messageHash1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [user1.address, telegramId, username1, timestamp]
      );
      const signature1 = await telegramBot.signMessage(ethers.getBytes(messageHash1));

      await socialVerification.connect(user1).verifyTelegram(telegramId, username1, timestamp, signature1);

      // Second user tries to use same Telegram ID
      const messageHash2 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "uint256"],
        [user2.address, telegramId, username2, timestamp]
      );
      const signature2 = await telegramBot.signMessage(ethers.getBytes(messageHash2));

      await expect(
        socialVerification.connect(user2).verifyTelegram(telegramId, username2, timestamp, signature2)
      ).to.be.revertedWith("Telegram ID already used");
    });
  });

  describe("Attestations", function () {
    beforeEach(async function () {
      // Make attestor verified first
      await socialVerification.connect(verifier).verifyUser(attestor.address, "kyc");
    });

    it("Should create positive attestation", async function () {
      const method = "personal_knowledge";
      const ipfsHash = "QmTest123";

      await expect(
        socialVerification.connect(attestor).createAttestation(user1.address, method, true, ipfsHash)
      )
        .to.emit(socialVerification, "AttestationCreated")
        .withArgs(attestor.address, user1.address, method, true, ipfsHash);

      const attestationCount = await socialVerification.getAttestationCount();
      expect(attestationCount).to.equal(1);

      const attestation = await socialVerification.getAttestation(0);
      expect(attestation.attestor).to.equal(attestor.address);
      expect(attestation.user).to.equal(user1.address);
      expect(attestation.method).to.equal(method);
      expect(attestation.isPositive).to.be.true;
      expect(attestation.ipfsHash).to.equal(ipfsHash);

      // Should increase reputation slightly
      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(5);
    });

    it("Should create negative attestation", async function () {
      await socialVerification.connect(attestor).createAttestation(
        user1.address, 
        "dispute", 
        false, 
        "QmNegative123"
      );

      const attestation = await socialVerification.getAttestation(0);
      expect(attestation.isPositive).to.be.false;

      // Should not increase reputation
      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(0);
    });

    it("Should prevent duplicate attestations", async function () {
      await socialVerification.connect(attestor).createAttestation(
        user1.address, 
        "test", 
        true, 
        "QmTest"
      );

      await expect(
        socialVerification.connect(attestor).createAttestation(user1.address, "test2", true, "QmTest2")
      ).to.be.revertedWith("Already attested by this user");
    });

    it("Should require attestor to be verified", async function () {
      await expect(
        socialVerification.connect(user2).createAttestation(user1.address, "test", true, "QmTest")
      ).to.be.revertedWith("Attestor must be verified");
    });
  });

  describe("Reputation Management", function () {
    it("Should update reputation score manually", async function () {
      const initialScore = await socialVerification.getReputationScore(user1.address);
      
      await socialVerification.connect(verifier).updateReputationScore(user1.address, 50);
      
      const newScore = await socialVerification.getReputationScore(user1.address);
      expect(newScore).to.equal(initialScore + 50n);
    });

    it("Should record circle completion", async function () {
      await socialVerification.connect(verifier).recordCircleCompletion(user1.address);

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.successfulCircles).to.equal(1);
      expect(userVerification.reputationScore).to.equal(10); // Bonus for completion
    });

    it("Should record default and apply penalty", async function () {
      // Give user some initial reputation
      await socialVerification.connect(verifier).updateReputationScore(user1.address, 100);
      
      await socialVerification.connect(verifier).recordDefault(user1.address);

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.defaultCount).to.equal(1);
      expect(userVerification.reputationScore).to.equal(50); // 100 - 50 penalty
    });

    it("Should auto-ban user after multiple defaults", async function () {
      // Give user some reputation first
      await socialVerification.connect(verifier).updateReputationScore(user1.address, 200);

      // Record 3 defaults
      await socialVerification.connect(verifier).recordDefault(user1.address);
      await socialVerification.connect(verifier).recordDefault(user1.address);
      
      await expect(
        socialVerification.connect(verifier).recordDefault(user1.address)
      ).to.emit(socialVerification, "UserBanned");

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.isBanned).to.be.true;
      expect(userVerification.defaultCount).to.equal(3);
    });

    it("Should cap reputation at maximum", async function () {
      await socialVerification.connect(verifier).updateReputationScore(user1.address, 1500);

      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(1000); // Max cap
    });

    it("Should not allow negative reputation", async function () {
      // Start with some reputation
      await socialVerification.connect(verifier).updateReputationScore(user1.address, 30);
      
      // Apply large penalty
      await socialVerification.connect(verifier).recordDefault(user1.address);

      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(0); // Should not go negative
    });
  });

  describe("Ban Management", function () {
    it("Should ban user manually", async function () {
      const banExpiry = Math.floor(Date.now() / 1000) + 86400; // 1 day
      const reason = "Fraudulent activity";

      await expect(
        socialVerification.banUser(user1.address, banExpiry, reason)
      ).to.emit(socialVerification, "UserBanned")
      .withArgs(user1.address, banExpiry, reason);

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.isBanned).to.be.true;
      expect(userVerification.banExpiry).to.equal(banExpiry);

      // Banned user should not be considered verified
      const isVerified = await socialVerification.isVerified(user1.address);
      expect(isVerified).to.be.false;

      // Banned user should have 0 reputation
      const reputationScore = await socialVerification.getReputationScore(user1.address);
      expect(reputationScore).to.equal(0);
    });

    it("Should unban user", async function () {
      const banExpiry = Math.floor(Date.now() / 1000) + 86400;
      await socialVerification.banUser(user1.address, banExpiry, "Test ban");

      await expect(
        socialVerification.unbanUser(user1.address)
      ).to.emit(socialVerification, "UserUnbanned")
      .withArgs(user1.address);

      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.isBanned).to.be.false;
      expect(userVerification.banExpiry).to.equal(0);
    });

    it("Should prevent banned users from creating attestations", async function () {
      // First make user verified and an attestor
      await socialVerification.connect(verifier).verifyUser(user1.address, "kyc");
      await socialVerification.grantRole(await socialVerification.ATTESTOR_ROLE(), user1.address);

      // Ban the user
      const banExpiry = Math.floor(Date.now() / 1000) + 86400;
      await socialVerification.banUser(user1.address, banExpiry, "Test ban");

      // Should not be able to create attestations
      await expect(
        socialVerification.connect(user1).createAttestation(user2.address, "test", true, "hash")
      ).to.be.revertedWith("User is banned");
    });

    it("Should prevent verification of banned users", async function () {
      const banExpiry = Math.floor(Date.now() / 1000) + 86400;
      await socialVerification.banUser(user1.address, banExpiry, "Test ban");

      await expect(
        socialVerification.connect(verifier).verifyUser(user1.address, "telegram")
      ).to.be.revertedWith("User is banned");
    });
  });

  describe("Configuration", function () {
    it("Should update minimum verification score", async function () {
      await socialVerification.setMinVerificationScore(150);
      expect(await socialVerification.minVerificationScore()).to.equal(150);
    });

    it("Should update Telegram bot signer", async function () {
      await socialVerification.setTelegramBotSigner(user1.address);
      expect(await socialVerification.telegramBotSigner()).to.equal(user1.address);
    });

    it("Should restrict configuration to admin", async function () {
      await expect(
        socialVerification.connect(user1).setMinVerificationScore(200)
      ).to.be.reverted;

      await expect(
        socialVerification.connect(user1).setTelegramBotSigner(user2.address)
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Set up some test data
      await socialVerification.connect(verifier).verifyUser(user1.address, "telegram");
      await socialVerification.connect(verifier).verifyUser(user1.address, "github");
    });

    it("Should calculate verification score correctly", async function () {
      const calculatedScore = await socialVerification.calculateVerificationScore(user1.address);
      expect(calculatedScore).to.equal(55); // 30 + 25
    });

    it("Should return user verification details", async function () {
      const userVerification = await socialVerification.getUserVerification(user1.address);
      expect(userVerification.reputationScore).to.equal(55);
      expect(userVerification.attestationCount).to.equal(0);
      expect(userVerification.defaultCount).to.equal(0);
      expect(userVerification.successfulCircles).to.equal(0);
      expect(userVerification.isBanned).to.be.false;
    });

    it("Should check method completion", async function () {
      const hasTelegram = await socialVerification.hasCompletedMethod(user1.address, "telegram");
      const hasTwitter = await socialVerification.hasCompletedMethod(user1.address, "twitter");
      
      expect(hasTelegram).to.be.true;
      expect(hasTwitter).to.be.false;
    });

    it("Should return verification methods list", async function () {
      const methods = await socialVerification.getVerificationMethods();
      expect(methods.length).to.be.greaterThan(0);
      expect(methods).to.include("telegram");
    });

    it("Should return method details", async function () {
      const method = await socialVerification.getVerificationMethod("telegram");
      expect(method.scoreWeight).to.equal(30);
      expect(method.isActive).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty method names", async function () {
      await expect(
        socialVerification.addVerificationMethod("", 10, ethers.ZeroAddress)
      ).to.be.revertedWith("Name cannot be empty");

      await expect(
        socialVerification.connect(attestor).createAttestation(user1.address, "", true, "hash")
      ).to.be.revertedWith("Method cannot be empty");
    });

    it("Should handle non-existent methods", async function () {
      await expect(
        socialVerification.connect(verifier).verifyUser(user1.address, "nonexistent")
      ).to.be.revertedWith("Method not active");
    });

    it("Should handle array bounds for attestations", async function () {
      await expect(
        socialVerification.getAttestation(999)
      ).to.be.revertedWith("Index out of bounds");
    });

    it("Should prevent self-attestation indirectly", async function () {
      // Make user1 verified and an attestor
      await socialVerification.connect(verifier).verifyUser(user1.address, "kyc");
      await socialVerification.grantRole(await socialVerification.ATTESTOR_ROLE(), user1.address);

      // User can technically attest to themselves (business logic should prevent this in frontend)
      await socialVerification.connect(user1).createAttestation(user1.address, "self", true, "hash");
      
      // But they can't do it twice
      await expect(
        socialVerification.connect(user1).createAttestation(user1.address, "self2", true, "hash2")
      ).to.be.revertedWith("Already attested by this user");
    });
  });
});