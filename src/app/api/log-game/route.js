import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { TREASURY_CONFIG } from '@/config/treasury';
import mantleTestnetConfig from '@/config/mantleTestnetConfig';
import { MANTLE_CONTRACTS, MANTLE_NETWORKS } from '@/config/contracts';

/**
 * Game Logging API - Mantle Sepolia Testnet
 * Uses treasury wallet to log game results (authorized logger)
 */

const MANTLE_TREASURY_PRIVATE_KEY = TREASURY_CONFIG.PRIVATE_KEY;
const GAME_LOGGER_ADDRESS = MANTLE_CONTRACTS[MANTLE_NETWORKS.SEPOLIA].gameLogger;
const MANTLE_RPC_URL = mantleTestnetConfig.rpcUrls.default.http[0];

// Game Logger Contract ABI
const GAME_LOGGER_ABI = [
  'function logGameResult(uint8 gameType, uint256 betAmount, bytes memory resultData, uint256 payout, bytes32 entropyRequestId, string memory entropyTxHash) external returns (bytes32 logId)',
  'function isAuthorizedLogger(address logger) external view returns (bool)',
  'event GameResultLogged(bytes32 indexed logId, address indexed player, uint8 gameType, uint256 betAmount, uint256 payout, bytes32 entropyRequestId, string entropyTxHash, uint256 timestamp)'
];

// Game type enum
const GAME_TYPES = {
  ROULETTE: 0,
  MINES: 1,
  WHEEL: 2,
  PLINKO: 3
};

const provider = new ethers.JsonRpcProvider(MANTLE_RPC_URL);
const treasuryWallet = MANTLE_TREASURY_PRIVATE_KEY 
  ? new ethers.Wallet(MANTLE_TREASURY_PRIVATE_KEY, provider) 
  : null;

export async function POST(request) {
  try {
    const { gameType, playerAddress, betAmount, result, payout, entropyProof } = await request.json();

    console.log('📝 Game log request:', { gameType, playerAddress, betAmount, payout });

    // Validate input
    if (!gameType || !playerAddress || betAmount === undefined || payout === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!treasuryWallet) {
      return NextResponse.json({ error: 'Treasury not configured' }, { status: 500 });
    }

    // Convert game type
    const gameTypeEnum = GAME_TYPES[gameType.toUpperCase()];
    if (gameTypeEnum === undefined) {
      return NextResponse.json({ error: `Invalid game type: ${gameType}` }, { status: 400 });
    }

    // Create contract instance
    const gameLogger = new ethers.Contract(GAME_LOGGER_ADDRESS, GAME_LOGGER_ABI, treasuryWallet);

    // Check if treasury is authorized
    const isAuthorized = await gameLogger.isAuthorizedLogger(treasuryWallet.address);
    if (!isAuthorized) {
      console.error('❌ Treasury wallet is not authorized to log games');
      return NextResponse.json({ error: 'Treasury not authorized' }, { status: 403 });
    }

    // Prepare data
    const betAmountWei = ethers.parseEther(betAmount.toString());
    const payoutWei = ethers.parseEther(payout.toString());
    const resultData = ethers.toUtf8Bytes(JSON.stringify(result || {}));
    const entropyRequestId = entropyProof?.requestId || ethers.ZeroHash;
    const entropyTxHash = entropyProof?.transactionHash || '';

    console.log('📤 Logging game to contract...');

    // Estimate gas first
    let gasEstimate;
    try {
      gasEstimate = await gameLogger.logGameResult.estimateGas(
        gameTypeEnum, betAmountWei, resultData, payoutWei, entropyRequestId, entropyTxHash
      );
    } catch (estimateError) {
      console.error('❌ Gas estimation failed:', estimateError.message);
      return NextResponse.json({ error: 'Contract call would fail: ' + estimateError.message }, { status: 400 });
    }

    // Send transaction
    const tx = await gameLogger.logGameResult(
      gameTypeEnum,
      betAmountWei,
      resultData,
      payoutWei,
      entropyRequestId,
      entropyTxHash,
      { gasLimit: gasEstimate * BigInt(120) / BigInt(100) }
    );

    console.log('⏳ Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    console.log('✅ Game logged:', { txHash: receipt.hash, blockNumber: receipt.blockNumber });

    return NextResponse.json({
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gameType,
      playerAddress,
      betAmount,
      payout
    });

  } catch (error) {
    console.error('❌ Game logging error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
