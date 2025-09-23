import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { LendingCircle, StateChannel, AaveIntegration, SocialVerification } from "../typechain-types";

describe("LendingCircle", function () {
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
  const MAX_MEMBERS = 5;
  const MIN_REPUTATION = 50;

  beforeEach(async function () {
    [owner, creator, member1, member2, member3, feeRecipient, telegramBot] = await ethers.getSigners();

    // Deploy StateChannel
    const StateChannelFactory = await ethers.getContractFactory("StateChannel");
    stateChannel = await StateChannelFactory.deploy(owner.address);
    await stateChannel.waitForDeployment();

    // Deploy SocialVerification
    const SocialVerificationFactory = await ethers.getContractFactory("SocialVerification");
    socialVerification = await SocialVerificationFactory.deploy(telegramBot.address);
    await socialVerification.waitForDeployment();

    // Deploy mock AaveIntegration (simplified for testing)
    const AaveIntegrationFactory = await ethers.getContractFactory("AaveIntegration");
    aaveIntegration = await AaveIntegrationFactory.deploy(owner.address); // Mock addresses provider
    await aaveIntegration.waitForDeployment();

    // Deploy LendingCircle
    const LendingCircleFactory = await ethers.getContractFactory("LendingCircle");
    lendingCircle = await LendingCircleFactory.deploy(
      await stateChannel.getAddress(),
      await aaveIntegration.getAddress(),
      await socialVerification.getAddress(),
      feeRecipient.address
    );
    await lendingCircle.waitForDeployment();

    // Authorize lending circle in AaveIntegration
    await aaveIntegration.authorizeCircle(await lendingCircle.getAddress());

    // Set up social verification for members
    await socialVerification.verifyUser(creator.address, "telegram");
    await socialVerification.verifyUser(member1.address, "telegram");
    await socialVerification.verifyUser(member2.address, "telegram");
    await socialVerification.verifyUser(member3.address, "telegram");
  });

  describe("Circle Creation", function () {
    it("Should create a lending circle successfully", async function () {
      const tx = await lendingCircle.connect(creator).createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress, // ETH
        false, // public
        MIN_REPUTATION
      );

      await expect(tx)
        .to.emit(lendingCircle, "CircleCreated")
        .withArgs(1, creator.address, "Test Circle", CONTRIBUTION_AMOUNT, MAX_MEMBERS);

      const circle = await lendingCircle.getCircle(1);
      expect(circle.creator).to.equal(creator.address);
      expect(circle.name).to.equal("Test Circle");
      expect(circle.contributionAmount).to.equal(CONTRIBUTION_AMOUNT);
      expect(circle.maxMembers).to.equal(MAX_MEMBERS);
      expect(circle.currentMembers).to.equal(1); // Creator auto-joins
      expect(circle.status).to.equal(0); // Created
    });

    it("Should reject invalid circle parameters", async function () {
      // Empty name
      await expect(
        lendingCircle.connect(creator).createCircle(
          "",
          CONTRIBUTION_AMOUNT,
          PAYOUT_AMOUNT,
          DURATION,
          MAX_MEMBERS,
          ethers.ZeroAddress,
          false,
          MIN_REPUTATION
        )
      ).to.be.revertedWith("Name cannot be empty");

      // Invalid contribution amount
      await expect(
        lendingCircle.connect(creator).createCircle(
          "Test Circle",
          0,
          PAYOUT_AMOUNT,
          DURATION,
          MAX_MEMBERS,
          ethers.ZeroAddress,
          false,
          MIN_REPUTATION
        )
      ).to.be.revertedWith("Contribution amount must be positive");

      // Invalid member count
      await expect(
        lendingCircle.connect(creator).createCircle(
          "Test Circle",
          CONTRIBUTION_AMOUNT,
          PAYOUT_AMOUNT,
          DURATION,
          2, // Too few
          ethers.ZeroAddress,
          false,
          MIN_REPUTATION
        )
      ).to.be.revertedWith("Invalid member count");

      // Invalid duration
      await expect(
        lendingCircle.connect(creator).createCircle(
          "Test Circle",
          CONTRIBUTION_AMOUNT,
          PAYOUT_AMOUNT,
          3600, // Too short
          MAX_MEMBERS,
          ethers.ZeroAddress,
          false,
          MIN_REPUTATION
        )
      ).to.be.revertedWith("Invalid duration");
    });
  });

  describe("Member Management", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;
    });

    it("Should allow public circle joining", async function () {
      await expect(
        lendingCircle.connect(member1).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001") // Include state channel fee
        })
      )
        .to.emit(lendingCircle, "MemberJoined")
        .withArgs(circleId, member1.address);

      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.currentMembers).to.equal(2);

      const member = await lendingCircle.getMember(circleId, member1.address);
      expect(member.memberAddress).to.equal(member1.address);
      expect(member.status).to.equal(1); // Joined
    });

    it("Should invite members to private circles", async function () {
      // Create private circle
      await lendingCircle.connect(creator).createCircle(
        "Private Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        true, // private
        MIN_REPUTATION
      );
      const privateCircleId = 2;

      await expect(
        lendingCircle.connect(creator).inviteMember(privateCircleId, member1.address)
      )
        .to.emit(lendingCircle, "MemberInvited")
        .withArgs(privateCircleId, member1.address);

      // Member can now join
      await expect(
        lendingCircle.connect(member1).joinCircle(privateCircleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      )
        .to.emit(lendingCircle, "MemberJoined")
        .withArgs(privateCircleId, member1.address);
    });

    it("Should verify members", async function () {
      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      await expect(
        lendingCircle.connect(creator).verifyMember(circleId, member1.address)
      )
        .to.emit(lendingCircle, "MemberVerified")
        .withArgs(circleId, member1.address);

      const member = await lendingCircle.getMember(circleId, member1.address);
      expect(member.status).to.equal(2); // Verified
    });

    it("Should reject joining when circle is full", async function () {
      // Fill up the circle
      const members = [member1, member2, member3];
      for (let i = 0; i < 3; i++) {
        await lendingCircle.connect(members[i]).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        });
      }

      // Try to add one more member (circle has 4 members now, max is 5)
      const [, , , , , , extraMember] = await ethers.getSigners();
      await socialVerification.verifyUser(extraMember.address, "telegram");
      
      await lendingCircle.connect(extraMember).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      // Now circle should be full, one more should fail
      const [, , , , , , , anotherMember] = await ethers.getSigners();
      await socialVerification.verifyUser(anotherMember.address, "telegram");
      
      await expect(
        lendingCircle.connect(anotherMember).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Circle is full");
    });
  });

  describe("Circle Operations", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        4, // Smaller circle for testing
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;

      // Add members
      const members = [member1, member2, member3];
      for (const member of members) {
        await lendingCircle.connect(member).joinCircle(circleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        });
      }
    });

    it("Should start circle automatically when full", async function () {
      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(2); // Active
      expect(circle.currentRound).to.equal(1);
    });

    it("Should allow manual circle start", async function () {
      // Create another circle that won't auto-start
      await lendingCircle.connect(creator).createCircle(
        "Manual Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        5, // Larger circle
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      const manualCircleId = 2;

      // Add only 3 members (minimum)
      await lendingCircle.connect(member1).joinCircle(manualCircleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
      await lendingCircle.connect(member2).joinCircle(manualCircleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      await expect(
        lendingCircle.connect(creator).startCircle(manualCircleId)
      )
        .to.emit(lendingCircle, "CircleStarted")
        .withArgs(manualCircleId, await ethers.provider.getBlockNumber() + 1);
    });

    it("Should allow bidding", async function () {
      const bidAmount = ethers.parseEther("0.9");
      const reason = "Need funds for emergency";

      await expect(
        lendingCircle.connect(member1).placeBid(circleId, bidAmount, reason)
      )
        .to.emit(lendingCircle, "BidPlaced")
        .withArgs(circleId, 1, member1.address, bidAmount);

      const bids = await lendingCircle.getRoundBids(circleId, 1);
      expect(bids.length).to.equal(1);
      expect(bids[0].bidder).to.equal(member1.address);
      expect(bids[0].amount).to.equal(bidAmount);
      expect(bids[0].reason).to.equal(reason);
    });

    it("Should select winning bid", async function () {
      // Place bids
      await lendingCircle.connect(member1).placeBid(circleId, ethers.parseEther("0.9"), "Emergency");
      await lendingCircle.connect(member2).placeBid(circleId, ethers.parseEther("0.8"), "Business");

      await expect(
        lendingCircle.connect(creator).selectWinningBid(circleId, 0) // Select first bid
      )
        .to.emit(lendingCircle, "BidAccepted")
        .withArgs(circleId, 1, member1.address, ethers.parseEther("0.9"));

      const (roundNumber, recipient) = await lendingCircle.getCurrentRoundInfo(circleId);
      expect(recipient).to.equal(member1.address);
    });

    it("Should handle contributions", async function () {
      // Set up round with winner
      await lendingCircle.connect(member1).placeBid(circleId, ethers.parseEther("0.9"), "Emergency");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      // Make contributions
      await expect(
        lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT })
      )
        .to.emit(lendingCircle, "ContributionMade")
        .withArgs(circleId, 1, creator.address, CONTRIBUTION_AMOUNT);

      await lendingCircle.connect(member2).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member3).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      // member1 (winner) should also contribute
      await lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      const (roundNumber, recipient, contributionsReceived) = await lendingCircle.getCurrentRoundInfo(circleId);
      expect(contributionsReceived).to.equal(CONTRIBUTION_AMOUNT * 4n);
    });

    it("Should distribute payout", async function () {
      // Set up round with winner and contributions
      await lendingCircle.connect(member1).placeBid(circleId, ethers.parseEther("0.9"), "Emergency");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      // All members contribute
      await lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member2).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member3).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      const member1BalanceBefore = await ethers.provider.getBalance(member1.address);

      await expect(
        lendingCircle.connect(creator).distributePayout(circleId)
      )
        .to.emit(lendingCircle, "PayoutDistributed");

      const member1BalanceAfter = await ethers.provider.getBalance(member1.address);
      expect(member1BalanceAfter).to.be.gt(member1BalanceBefore);

      // Check circle progressed to next round
      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.currentRound).to.equal(2);
    });
  });

  describe("Access Control", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;
    });

    it("Should restrict admin functions to circle creator", async function () {
      await expect(
        lendingCircle.connect(member1).inviteMember(circleId, member2.address)
      ).to.be.revertedWith("Not authorized");

      await expect(
        lendingCircle.connect(member1).startCircle(circleId)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should restrict member functions to members only", async function () {
      await expect(
        lendingCircle.connect(member1).placeBid(circleId, PAYOUT_AMOUNT, "reason")
      ).to.be.revertedWith("Not a member");

      await expect(
        lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT })
      ).to.be.revertedWith("Not a member");
    });

    it("Should allow platform admin functions", async function () {
      const newFeePercentage = 300; // 3%
      
      await lendingCircle.setPlatformFee(newFeePercentage);
      expect(await lendingCircle.platformFeePercentage()).to.equal(newFeePercentage);

      await lendingCircle.setFeeRecipient(member1.address);
      expect(await lendingCircle.feeRecipient()).to.equal(member1.address);
    });
  });

  describe("Circle Lifecycle", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "Lifecycle Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        3, // Small circle for quick testing
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;

      // Add members
      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
      await lendingCircle.connect(member2).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
    });

    it("Should complete full circle lifecycle", async function () {
      // Circle should auto-start with 3 members
      let circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(2); // Active

      // Round 1: member1 wins
      await lendingCircle.connect(member1).placeBid(circleId, PAYOUT_AMOUNT, "Round 1");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      // All contribute
      await lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member2).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      // Distribute payout
      await lendingCircle.connect(creator).distributePayout(circleId);

      // Round 2: member2 wins
      circle = await lendingCircle.getCircle(circleId);
      expect(circle.currentRound).to.equal(2);

      await lendingCircle.connect(member2).placeBid(circleId, PAYOUT_AMOUNT, "Round 2");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      await lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member2).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      await lendingCircle.connect(creator).distributePayout(circleId);

      // Round 3: creator wins (final round)
      circle = await lendingCircle.getCircle(circleId);
      expect(circle.currentRound).to.equal(3);

      await lendingCircle.connect(creator).placeBid(circleId, PAYOUT_AMOUNT, "Final round");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      await lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member1).contribute(circleId, { value: CONTRIBUTION_AMOUNT });
      await lendingCircle.connect(member2).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      await expect(
        lendingCircle.connect(creator).distributePayout(circleId)
      ).to.emit(lendingCircle, "CircleCompleted")
      .withArgs(circleId);

      // Circle should be completed
      circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(3); // Completed
    });

    it("Should allow circle cancellation", async function () {
      const reason = "Not enough participants";
      
      await expect(
        lendingCircle.connect(creator).cancelCircle(circleId, reason)
      )
        .to.emit(lendingCircle, "CircleCancelled")
        .withArgs(circleId, reason);

      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.status).to.equal(4); // Cancelled
    });
  });

  describe("Edge Cases and Error Handling", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;
    });

    it("Should prevent double contributions", async function () {
      // Setup active circle with winner
      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
      await lendingCircle.connect(member2).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
      await lendingCircle.connect(member3).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      await lendingCircle.connect(member1).placeBid(circleId, PAYOUT_AMOUNT, "Test");
      await lendingCircle.connect(creator).selectWinningBid(circleId, 0);

      // First contribution should work
      await lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT });

      // Second contribution should fail
      await expect(
        lendingCircle.connect(creator).contribute(circleId, { value: CONTRIBUTION_AMOUNT })
      ).to.be.revertedWith("Already contributed this round");
    });

    it("Should prevent bidding with excessive amounts", async function () {
      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      await expect(
        lendingCircle.connect(member1).placeBid(circleId, PAYOUT_AMOUNT + 1n, "Too much")
      ).to.be.revertedWith("Bid exceeds maximum");
    });

    it("Should handle insufficient reputation", async function () {
      // Create circle with high reputation requirement
      await lendingCircle.connect(creator).createCircle(
        "High Rep Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        500 // High reputation requirement
      );
      
      const highRepCircleId = 2;
      
      // Member with low reputation should be rejected
      const [, , , , , , , lowRepMember] = await ethers.getSigners();
      
      await expect(
        lendingCircle.connect(lowRepMember).joinCircle(highRepCircleId, { 
          value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Insufficient reputation");
    });
  });

  describe("View Functions", function () {
    let circleId: number;

    beforeEach(async function () {
      await lendingCircle.connect(creator).createCircle(
        "View Test Circle",
        CONTRIBUTION_AMOUNT,
        PAYOUT_AMOUNT,
        DURATION,
        MAX_MEMBERS,
        ethers.ZeroAddress,
        false,
        MIN_REPUTATION
      );
      circleId = 1;

      await lendingCircle.connect(member1).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
    });

    it("Should return correct circle information", async function () {
      const circle = await lendingCircle.getCircle(circleId);
      expect(circle.id).to.equal(circleId);
      expect(circle.creator).to.equal(creator.address);
      expect(circle.name).to.equal("View Test Circle");
      expect(circle.contributionAmount).to.equal(CONTRIBUTION_AMOUNT);
      expect(circle.maxMembers).to.equal(MAX_MEMBERS);
    });

    it("Should return circle members", async function () {
      const members = await lendingCircle.getCircleMembers(circleId);
      expect(members.length).to.equal(2);
      expect(members[0]).to.equal(creator.address);
      expect(members[1]).to.equal(member1.address);
    });

    it("Should return member information", async function () {
      const member = await lendingCircle.getMember(circleId, member1.address);
      expect(member.memberAddress).to.equal(member1.address);
      expect(member.status).to.equal(1); // Joined
      expect(member.hasContributed).to.be.false;
      expect(member.hasReceivedPayout).to.be.false;
    });

    it("Should return round information", async function () {
      // Need to start circle and set up round
      await lendingCircle.connect(member2).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });
      await lendingCircle.connect(member3).joinCircle(circleId, { 
        value: CONTRIBUTION_AMOUNT + ethers.parseEther("0.001")
      });

      const (roundNumber, recipient, contributionsReceived) = await lendingCircle.getCurrentRoundInfo(circleId);
      expect(roundNumber).to.equal(1);
      expect(recipient).to.equal(ethers.ZeroAddress); // No winner selected yet
      expect(contributionsReceived).to.equal(0);
    });
  });
});