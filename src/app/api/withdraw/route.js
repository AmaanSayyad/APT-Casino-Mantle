import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { TREASURY_CONFIG } from '@/config/treasury';
import mantleTestnetConfig from '@/config/mantleTestnetConfig';

/**
 * Withdraw API - Mantle Sepolia Testnet
 * 
 * NETWORK ARCHITECTURE:
 * This API processes withdrawals on Mantle Sepolia Testnet using MNT tokens.
 * Uses the Treasury Contract to send funds to users.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

// Mantle Sepolia Treasury private key from environment
const MANTLE_TREASURY_PRIVATE_KEY = TREASURY_CONFIG.PRIVATE_KEY;

// Treasury Contract Address
const TREASURY_CONTRACT_ADDRESS = TREASURY_CONFIG.ADDRESS;

// Treasury Contract ABI (only the functions we need)
const TREASURY_ABI = [
  "function emergencyWithdraw(address to, uint256 amount) external",
  "function getBalance(address user) external view returns (uint256)",
  "function getTreasuryStats() external view returns (uint256 contractBalance, uint256 totalDeposited, uint256 totalWithdrawn, uint256 userCount)",
  "function owner() external view returns (address)"
];

// Mantle Sepolia RPC URL from config
const MANTLE_RPC_URL = mantleTestnetConfig.rpcUrls.default.http[0];

// Create provider and wallet
const provider = new ethers.JsonRpcProvider(MANTLE_RPC_URL);
const treasuryWallet = MANTLE_TREASURY_PRIVATE_KEY ? new ethers.Wallet(MANTLE_TREASURY_PRIVATE_KEY, provider) : null;

export async function POST(request) {
  try {
    const { userAddress, amount } = await request.json();

    console.log('📥 Received withdrawal request:', { userAddress, amount, type: typeof userAddress });

    // Validate input
    if (!userAddress || !amount || amount <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid parameters'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!MANTLE_TREASURY_PRIVATE_KEY || !treasuryWallet) {
      return NextResponse.json(
        { error: 'Treasury not configured' },
        { status: 500 }
      );
    }

    console.log(`🏦 Processing withdrawal: ${amount} MNT to ${userAddress}`);
    console.log(`📍 Treasury Contract: ${TREASURY_CONTRACT_ADDRESS}`);
    console.log(`📍 Treasury Wallet (Owner): ${treasuryWallet.address}`);


    // Check treasury CONTRACT balance
    let treasuryBalance = BigInt(0);
    try {
      treasuryBalance = await provider.getBalance(TREASURY_CONTRACT_ADDRESS);
      console.log(`💰 Treasury Contract balance: ${ethers.formatEther(treasuryBalance)} MNT`);
      
      try {
        const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, treasuryWallet);
        const stats = await treasuryContract.getTreasuryStats();
        console.log(`📊 Treasury Stats:`, {
          contractBalance: ethers.formatEther(stats.contractBalance),
          totalDeposited: ethers.formatEther(stats.totalDeposited),
          totalWithdrawn: ethers.formatEther(stats.totalWithdrawn),
          userCount: stats.userCount.toString()
        });
      } catch (statsError) {
        console.log('⚠️ Could not fetch treasury stats:', statsError.message);
      }
    } catch (balanceError) {
      console.log('⚠️ Could not check treasury balance, proceeding with transfer attempt...');
    }

    // Balance validation before withdrawal (Requirement 7.2)
    const amountWei = ethers.parseEther(amount.toString());
    if (treasuryBalance < amountWei) {
      return NextResponse.json(
        { error: `Insufficient treasury funds. Available: ${ethers.formatEther(treasuryBalance)} MNT, Requested: ${amount} MNT` },
        { status: 400 }
      );
    }

    // Format user address
    let formattedUserAddress;
    if (typeof userAddress === 'object' && userAddress.data) {
      const bytes = Object.values(userAddress.data);
      formattedUserAddress = '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof userAddress === 'string') {
      formattedUserAddress = userAddress.startsWith('0x') ? userAddress : `0x${userAddress}`;
    } else {
      throw new Error(`Invalid userAddress format: ${typeof userAddress}`);
    }

    console.log('🔧 Formatted user address:', formattedUserAddress);
    console.log('🔧 Amount in Wei:', amountWei.toString());

    // Create Treasury Contract instance
    const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, treasuryWallet);

    // Verify contract ownership
    let contractOwner;
    try {
      contractOwner = await treasuryContract.owner();
      console.log(`🔐 Contract owner: ${contractOwner}`);
      
      if (contractOwner.toLowerCase() !== treasuryWallet.address.toLowerCase()) {
        console.log('⚠️ Treasury wallet is NOT the contract owner, using direct transfer...');
        
        const walletBalance = await provider.getBalance(treasuryWallet.address);
        console.log(`💰 Treasury Wallet balance: ${ethers.formatEther(walletBalance)} MNT`);
        
        if (walletBalance < amountWei) {
          return NextResponse.json(
            { error: `Treasury wallet has insufficient funds. Wallet balance: ${ethers.formatEther(walletBalance)} MNT` },
            { status: 400 }
          );
        }
        
        console.log('💸 Sending MNT directly from Treasury wallet to user...');
        const tx = await treasuryWallet.sendTransaction({
          to: formattedUserAddress,
          value: amountWei,
          gasLimit: 100000
        });
        
        console.log(`📤 Transaction sent: ${tx.hash}`);
        
        return new Response(JSON.stringify({
          success: true,
          transactionHash: tx.hash,
          amount: amount,
          userAddress: userAddress,
          treasuryAddress: treasuryWallet.address,
          status: 'pending',
          message: 'Transaction sent from treasury wallet. Check Mantle Explorer for confirmation.',
          note: 'Used direct wallet transfer'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (ownerError) {
      console.log('⚠️ Could not verify contract owner:', ownerError.message);
    }

    console.log('💸 Calling emergencyWithdraw on Treasury Contract...');
    
    const tx = await treasuryContract.emergencyWithdraw(
      formattedUserAddress,
      amountWei,
      { gasLimit: 500000 }
    );

    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log(`✅ Withdraw MNT to ${userAddress}, TX: ${tx.hash}`);

    return new Response(JSON.stringify({
      success: true,
      transactionHash: tx.hash,
      amount: amount,
      userAddress: userAddress,
      treasuryAddress: treasuryWallet.address,
      status: 'pending',
      message: 'Transaction sent successfully. Check Mantle Explorer for confirmation.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Withdraw API error:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: `Withdrawal failed: ${errorMessage}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


// GET endpoint to check treasury balance
export async function GET() {
  try {
    if (!MANTLE_TREASURY_PRIVATE_KEY || !treasuryWallet) {
      return NextResponse.json(
        { error: 'Treasury not configured' },
        { status: 500 }
      );
    }

    try {
      const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, provider);
      const stats = await treasuryContract.getTreasuryStats();
      const contractBalance = stats.contractBalance;
      const walletBalance = await provider.getBalance(treasuryWallet.address);

      return NextResponse.json({
        treasuryContractAddress: TREASURY_CONTRACT_ADDRESS,
        treasuryWalletAddress: treasuryWallet.address,
        contractBalance: ethers.formatEther(contractBalance),
        contractBalanceWei: contractBalance.toString(),
        walletBalance: ethers.formatEther(walletBalance),
        walletBalanceWei: walletBalance.toString(),
        totalDeposited: ethers.formatEther(stats.totalDeposited),
        totalWithdrawn: ethers.formatEther(stats.totalWithdrawn),
        totalUsers: stats.userCount.toString(),
        status: 'active',
        network: 'Mantle Sepolia Testnet'
      });
    } catch (balanceError) {
      try {
        const contractBalance = await provider.getBalance(TREASURY_CONTRACT_ADDRESS);
        const walletBalance = await provider.getBalance(treasuryWallet.address);

        return NextResponse.json({
          treasuryContractAddress: TREASURY_CONTRACT_ADDRESS,
          treasuryWalletAddress: treasuryWallet.address,
          contractBalance: ethers.formatEther(contractBalance),
          walletBalance: ethers.formatEther(walletBalance),
          status: 'partial',
          network: 'Mantle Sepolia Testnet',
          note: 'Could not fetch full stats, showing balances only'
        });
      } catch (directError) {
        return NextResponse.json({
          treasuryContractAddress: TREASURY_CONTRACT_ADDRESS,
          treasuryWalletAddress: treasuryWallet.address,
          contractBalance: '0',
          walletBalance: '0',
          status: 'error',
          error: directError.message,
          network: 'Mantle Sepolia Testnet'
        });
      }
    }
  } catch (error) {
    console.error('Treasury balance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check treasury balance: ' + error.message },
      { status: 500 }
    );
  }
}
