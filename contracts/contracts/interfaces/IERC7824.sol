// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IERC7824 - State Channel Interface
 * @dev Interface for ERC-7824 state channels
 */
interface IERC7824 {
    struct ChannelData {
        address participant1;
        address participant2;
        uint256 balance1;
        uint256 balance2;
        uint256 nonce;
        uint256 timeout;
        bool isActive;
    }

    struct StateUpdate {
        bytes32 channelId;
        uint256 nonce;
        uint256 balance1;
        uint256 balance2;
        bytes signature1;
        bytes signature2;
    }

    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed participant1,
        address indexed participant2,
        uint256 amount1,
        uint256 amount2
    );

    event ChannelUpdated(
        bytes32 indexed channelId,
        uint256 nonce,
        uint256 balance1,
        uint256 balance2
    );

    event ChannelClosed(
        bytes32 indexed channelId,
        uint256 finalBalance1,
        uint256 finalBalance2
    );

    event ChannelDisputed(
        bytes32 indexed channelId,
        address indexed disputer,
        uint256 disputeTimeout
    );

    function openChannel(
        address participant1,
        address participant2,
        uint256 amount1,
        uint256 amount2,
        uint256 timeout
    ) external payable returns (bytes32 channelId);

    function updateChannel(StateUpdate calldata update) external;

    function closeChannel(bytes32 channelId, StateUpdate calldata finalUpdate) external;

    function disputeChannel(bytes32 channelId) external;

    function resolveDispute(bytes32 channelId, StateUpdate calldata update) external;

    function withdrawTimelock(bytes32 channelId) external;

    function getChannel(bytes32 channelId) external view returns (ChannelData memory);

    function isValidSignature(
        bytes32 channelId,
        uint256 nonce,
        uint256 balance1,
        uint256 balance2,
        bytes calldata signature,
        address signer
    ) external view returns (bool);
}