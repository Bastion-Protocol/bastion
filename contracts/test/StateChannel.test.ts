import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StateChannel, IERC7824 } from "../typechain-types";

describe("StateChannel", function () {
  let stateChannel: StateChannel;
  let owner: SignerWithAddress;
  let participant1: SignerWithAddress;
  let participant2: SignerWithAddress;
  let relayer: SignerWithAddress;
  let yellowOracle: SignerWithAddress;

  const CHANNEL_FEE = ethers.parseEther("0.001");
  const RELAYER_FEE = ethers.parseEther("0.0001");
  const MIN_TIMEOUT = 3600; // 1 hour
  const DISPUTE_TIMEOUT = 86400; // 1 day

  beforeEach(async function () {
    [owner, participant1, participant2, relayer, yellowOracle] = await ethers.getSigners();

    const StateChannelFactory = await ethers.getContractFactory("StateChannel");
    stateChannel = await StateChannelFactory.deploy(yellowOracle.address);
    await stateChannel.waitForDeployment();

    // Set up relayer authorization
    await stateChannel.setRelayerAuthorization(relayer.address, true);
  });

  describe("Channel Operations", function () {
    it("Should open a channel successfully", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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

      expect(event).to.not.be.undefined;
      
      if (event) {
        const parsedEvent = stateChannel.interface.parseLog(event);
        const channelId = parsedEvent?.args[0];
        
        const channel = await stateChannel.getChannel(channelId);
        expect(channel.participant1).to.equal(participant1.address);
        expect(channel.participant2).to.equal(participant2.address);
        expect(channel.balance1).to.equal(amount1);
        expect(channel.balance2).to.equal(amount2);
        expect(channel.isActive).to.be.true;
      }
    });

    it("Should reject channel with invalid parameters", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      
      // Same participants
      await expect(
        stateChannel.openChannel(
          participant1.address,
          participant1.address,
          amount1,
          amount2,
          MIN_TIMEOUT,
          { value: amount1 + amount2 + CHANNEL_FEE }
        )
      ).to.be.revertedWith("Participants must be different");

      // Invalid timeout
      await expect(
        stateChannel.openChannel(
          participant1.address,
          participant2.address,
          amount1,
          amount2,
          100, // Too short
          { value: amount1 + amount2 + CHANNEL_FEE }
        )
      ).to.be.revertedWith("Invalid timeout");

      // Insufficient funds
      await expect(
        stateChannel.openChannel(
          participant1.address,
          participant2.address,
          amount1,
          amount2,
          MIN_TIMEOUT,
          { value: amount1 } // Missing amount2 and fee
        )
      ).to.be.revertedWith("Insufficient funds");
    });

    it("Should update channel state with valid signatures", async function () {
      // First open a channel
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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

      // Create state update
      const newBalance1 = ethers.parseEther("0.5");
      const newBalance2 = ethers.parseEther("1.5");
      const nonce = 1;

      // Create message to sign
      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256", "uint256"],
        [channelId, nonce, newBalance1, newBalance2]
      );

      const signature1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const signature2 = await participant2.signMessage(ethers.getBytes(messageHash));

      const update: IERC7824.StateUpdateStruct = {
        channelId: channelId,
        nonce: nonce,
        balance1: newBalance1,
        balance2: newBalance2,
        signature1: signature1,
        signature2: signature2
      };

      await expect(stateChannel.updateChannel(update))
        .to.emit(stateChannel, "ChannelUpdated")
        .withArgs(channelId, nonce, newBalance1, newBalance2);

      const updatedChannel = await stateChannel.getChannel(channelId);
      expect(updatedChannel.balance1).to.equal(newBalance1);
      expect(updatedChannel.balance2).to.equal(newBalance2);
      expect(updatedChannel.nonce).to.equal(nonce);
    });

    it("Should close channel and distribute funds", async function () {
      // Open and update channel first
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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

      // Check balances before closing
      const balance1Before = await ethers.provider.getBalance(participant1.address);
      const balance2Before = await ethers.provider.getBalance(participant2.address);

      // Close channel with empty final update
      const emptyUpdate: IERC7824.StateUpdateStruct = {
        channelId: ethers.ZeroHash,
        nonce: 0,
        balance1: 0,
        balance2: 0,
        signature1: "0x",
        signature2: "0x"
      };

      await expect(stateChannel.connect(participant1).closeChannel(channelId, emptyUpdate))
        .to.emit(stateChannel, "ChannelClosed")
        .withArgs(channelId, amount1, amount2);

      // Check that channel is no longer active
      const closedChannel = await stateChannel.getChannel(channelId);
      expect(closedChannel.isActive).to.be.false;

      // Check balances increased (accounting for gas costs)
      const balance1After = await ethers.provider.getBalance(participant1.address);
      const balance2After = await ethers.provider.getBalance(participant2.address);
      
      expect(balance2After).to.be.gt(balance2Before); // participant2 should receive their balance
    });
  });

  describe("Dispute Mechanism", function () {
    let channelId: string;

    beforeEach(async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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
      channelId = parsedEvent?.args[0];
    });

    it("Should initiate dispute", async function () {
      await expect(stateChannel.connect(participant1).disputeChannel(channelId))
        .to.emit(stateChannel, "ChannelDisputed")
        .withArgs(channelId, participant1.address, await ethers.provider.getBlockNumber() + 1);

      const inDispute = await stateChannel.inDispute(channelId);
      expect(inDispute).to.be.true;
    });

    it("Should not allow updates during dispute", async function () {
      await stateChannel.connect(participant1).disputeChannel(channelId);

      const update: IERC7824.StateUpdateStruct = {
        channelId: channelId,
        nonce: 1,
        balance1: ethers.parseEther("0.5"),
        balance2: ethers.parseEther("1.5"),
        signature1: "0x",
        signature2: "0x"
      };

      await expect(stateChannel.updateChannel(update))
        .to.be.revertedWith("Channel in dispute");
    });

    it("Should resolve dispute with valid state", async function () {
      await stateChannel.connect(participant1).disputeChannel(channelId);

      const newBalance1 = ethers.parseEther("0.5");
      const newBalance2 = ethers.parseEther("1.5");
      const nonce = 1;

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256", "uint256"],
        [channelId, nonce, newBalance1, newBalance2]
      );

      const signature1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const signature2 = await participant2.signMessage(ethers.getBytes(messageHash));

      const update: IERC7824.StateUpdateStruct = {
        channelId: channelId,
        nonce: nonce,
        balance1: newBalance1,
        balance2: newBalance2,
        signature1: signature1,
        signature2: signature2
      };

      await stateChannel.connect(participant1).resolveDispute(channelId, update);

      const inDispute = await stateChannel.inDispute(channelId);
      expect(inDispute).to.be.false;

      const channel = await stateChannel.getChannel(channelId);
      expect(channel.balance1).to.equal(newBalance1);
      expect(channel.balance2).to.equal(newBalance2);
    });
  });

  describe("Yellow Network Integration", function () {
    it("Should update Yellow Network oracle", async function () {
      const newOracle = participant1.address;
      
      await expect(stateChannel.setYellowNetworkOracle(newOracle))
        .to.emit(stateChannel, "YellowNetworkOracleUpdated")
        .withArgs(newOracle);

      expect(await stateChannel.yellowNetworkOracle()).to.equal(newOracle);
    });

    it("Should authorize and deauthorize relayers", async function () {
      const newRelayer = participant1.address;
      
      await expect(stateChannel.setRelayerAuthorization(newRelayer, true))
        .to.emit(stateChannel, "RelayerAuthorized")
        .withArgs(newRelayer, true);

      expect(await stateChannel.authorizedRelayers(newRelayer)).to.be.true;

      await expect(stateChannel.setRelayerAuthorization(newRelayer, false))
        .to.emit(stateChannel, "RelayerAuthorized")
        .withArgs(newRelayer, false);

      expect(await stateChannel.authorizedRelayers(newRelayer)).to.be.false;
    });

    it("Should update fees", async function () {
      const newChannelFee = ethers.parseEther("0.002");
      const newRelayerFee = ethers.parseEther("0.0002");
      
      await expect(stateChannel.updateFees(newChannelFee, newRelayerFee))
        .to.emit(stateChannel, "FeesUpdated")
        .withArgs(newChannelFee, newRelayerFee);

      expect(await stateChannel.channelFee()).to.equal(newChannelFee);
      expect(await stateChannel.relayerFee()).to.equal(newRelayerFee);
    });
  });

  describe("Access Control", function () {
    it("Should restrict admin functions to owner", async function () {
      await expect(
        stateChannel.connect(participant1).setYellowNetworkOracle(participant1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        stateChannel.connect(participant1).setRelayerAuthorization(participant1.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        stateChannel.connect(participant1).updateFees(0, 0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should restrict channel operations to participants", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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

      // Non-participant tries to dispute
      await expect(
        stateChannel.connect(relayer).disputeChannel(channelId)
      ).to.be.revertedWith("Not a channel participant");

      // Non-participant tries to close
      const emptyUpdate: IERC7824.StateUpdateStruct = {
        channelId: ethers.ZeroHash,
        nonce: 0,
        balance1: 0,
        balance2: 0,
        signature1: "0x",
        signature2: "0x"
      };

      await expect(
        stateChannel.connect(relayer).closeChannel(channelId, emptyUpdate)
      ).to.be.revertedWith("Not a channel participant");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle emergency withdrawal", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      const tx = await stateChannel.openChannel(
        participant1.address,
        participant2.address,
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

      // Manually set channel to inactive for emergency
      await stateChannel.connect(participant1).disputeChannel(channelId);
      
      // Fast forward past dispute timeout
      await ethers.provider.send("evm_increaseTime", [DISPUTE_TIMEOUT + 1]);
      await ethers.provider.send("evm_mine", []);

      // Emergency withdraw should work for owner
      await stateChannel.emergencyWithdraw(channelId);
    });

    it("Should withdraw accumulated fees", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("1");
      const timeout = MIN_TIMEOUT * 2;
      const totalAmount = amount1 + amount2 + CHANNEL_FEE;

      // Open a channel to generate fees
      await stateChannel.openChannel(
        participant1.address,
        participant2.address,
        amount1,
        amount2,
        timeout,
        { value: totalAmount }
      );

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      await stateChannel.withdrawFees();
      
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });
  });
});