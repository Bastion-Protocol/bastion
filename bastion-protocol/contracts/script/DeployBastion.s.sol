// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/BastionCore.sol";
import "../src/BastionLending.sol";
import "../src/BastionCircles.sol";

contract DeployBastion is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy core contract
        BastionCore core = new BastionCore();
        console.log("BastionCore deployed at:", address(core));

        // Deploy lending contract
    BastionLending lending = new BastionLending(address(core));
        console.log("BastionLending deployed at:", address(lending));

        // Deploy circles contract
    BastionCircles circles = new BastionCircles(address(core));
        console.log("BastionCircles deployed at:", address(circles));

        vm.stopBroadcast();
    }
}