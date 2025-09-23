// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BastionProtocol
 * @dev Basic contract for Bastion Protocol lending circles
 */
contract BastionProtocol {
    string public name = "Bastion Protocol";
    string public version = "1.0.0";
    
    event Initialized(address indexed deployer, uint256 timestamp);
    
    constructor() {
        emit Initialized(msg.sender, block.timestamp);
    }
    
    function getInfo() external view returns (string memory, string memory) {
        return (name, version);
    }
}