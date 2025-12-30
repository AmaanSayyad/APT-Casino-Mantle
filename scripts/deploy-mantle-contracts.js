const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🚀 Deploying Mantle Sepolia Testnet Contracts...");
  console.log("=" .repeat(60));

  // Get the deployer account
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available. Please check your private key configuration.");
  }
  const deployer = signers[0];
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MNT");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("=" .repeat(60));

  // Verify we're on Mantle Sepolia Testnet
  if (network.chainId !== 5003n) {
    console.log("⚠️  Warning: Not on Mantle Sepolia Testnet (expected chain ID 5003)");
    console.log("Current chain ID:", network.chainId.toString());
    console.log("Proceeding anyway...");
  }

  const deploymentResults = {
    network: "mantle-sepolia",
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    contracts: {}
  };

  // Deploy MantleGameLogger
  console.log("\n📦 Deploying MantleGameLogger...");
  const MantleGameLogger = await ethers.getContractFactory("MantleGameLogger");
  const gameLogger = await MantleGameLogger.deploy();
  await gameLogger.waitForDeployment();
  const gameLoggerAddress = await gameLogger.getAddress();
  console.log("✅ MantleGameLogger deployed to:", gameLoggerAddress);


  deploymentResults.contracts.gameLogger = {
    address: gameLoggerAddress,
    transactionHash: gameLogger.deploymentTransaction()?.hash
  };

  // Test Game Logger
  console.log("\n🧪 Testing MantleGameLogger...");
  try {
    const stats = await gameLogger.getStats();
    console.log("Game Logger Stats:", {
      totalGames: stats.totalGames.toString(),
      totalBets: ethers.formatEther(stats.totalBets),
      totalPayouts: ethers.formatEther(stats.totalPayouts),
      rouletteCount: stats.rouletteCount.toString(),
      minesCount: stats.minesCount.toString(),
      wheelCount: stats.wheelCount.toString(),
      plinkoCount: stats.plinkoCount.toString()
    });

    const isAuthorized = await gameLogger.isAuthorizedLogger(deployer.address);
    console.log("Deployer is authorized logger:", isAuthorized);

    console.log("✅ Game Logger test passed");
  } catch (error) {
    console.log("❌ Game Logger test failed:", error.message);
  }

  // Test logging a game result
  console.log("\n🎲 Testing game result logging...");
  try {
    const testEntropyRequestId = ethers.keccak256(ethers.toUtf8Bytes("test_entropy_" + Date.now()));
    const testEntropyTxHash = "0x" + "1".repeat(64); // Mock Arbitrum tx hash
    const testResultData = ethers.toUtf8Bytes("test_result");
    
    const logTx = await gameLogger.logGameResult(
      0, // GameType.ROULETTE
      ethers.parseEther("0.1"), // 0.1 MNT bet
      testResultData,
      ethers.parseEther("0.2"), // 0.2 MNT payout
      testEntropyRequestId,
      testEntropyTxHash
    );
    
    const receipt = await logTx.wait();
    console.log("Game logged in transaction:", receipt.hash);
    console.log("Block number:", receipt.blockNumber);

    // Get the log ID from events
    const event = receipt.logs.find(log => {
      try {
        const parsed = gameLogger.interface.parseLog(log);
        return parsed.name === 'GameResultLogged';
      } catch (e) {
        return false;
      }
    });

    if (event) {
      const parsedEvent = gameLogger.interface.parseLog(event);
      const logId = parsedEvent.args.logId;
      console.log("Log ID:", logId);
      
      // Retrieve the log
      const gameLog = await gameLogger.getGameLog(logId);
      console.log("Game Log:", {
        player: gameLog.player,
        gameType: gameLog.gameType.toString(),
        betAmount: ethers.formatEther(gameLog.betAmount),
        payout: ethers.formatEther(gameLog.payout),
        timestamp: new Date(Number(gameLog.timestamp) * 1000).toISOString()
      });
    }

    console.log("✅ Game logging test passed");
  } catch (error) {
    console.log("❌ Game logging test failed:", error.message);
  }

  // Print deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\nNetwork Information:");
  console.log("  Network: Mantle Sepolia Testnet");
  console.log("  Chain ID:", network.chainId.toString());
  console.log("  Deployer:", deployer.address);
  console.log("  Explorer: https://sepolia.mantlescan.xyz");
  console.log("\nDeployed Contracts:");
  console.log("  MantleGameLogger:", gameLoggerAddress);
  console.log("\nNext Steps:");
  console.log("  1. Update .env file with contract address:");
  console.log(`     NEXT_PUBLIC_MANTLE_GAME_LOGGER_ADDRESS=${gameLoggerAddress}`);
  console.log("  2. Verify contract on Mantle Sepolia explorer:");
  console.log(`     https://sepolia.mantlescan.xyz/address/${gameLoggerAddress}`);
  console.log("  3. Authorize treasury address to log games");
  console.log("  4. Test game logging from frontend");
  console.log("=".repeat(60));

  // Save deployment info to file
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const filename = `${deploymentsDir}/mantle-contracts-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentResults, null, 2));
  console.log("\n💾 Deployment info saved to:", filename);

  // Generate .env update script
  const envUpdate = `
# Mantle Sepolia Testnet Contract Addresses (deployed ${new Date().toISOString()})
NEXT_PUBLIC_MANTLE_GAME_LOGGER_ADDRESS=${gameLoggerAddress}
`;

  const envUpdateFile = `${deploymentsDir}/mantle-env-update.txt`;
  fs.writeFileSync(envUpdateFile, envUpdate.trim());
  console.log("📝 Environment variable updates saved to:", envUpdateFile);

  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
