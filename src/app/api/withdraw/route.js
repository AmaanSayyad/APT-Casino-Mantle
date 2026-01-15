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

    // Format and validate user address
    let formattedUserAddress;
    if (typeof userAddress === 'object' && userAddress.data) {
      const bytes = Object.values(userAddress.data);
      formattedUserAddress = '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof userAddress === 'string') {
      formattedUserAddress = userAddress.startsWith('0x') ? userAddress : `0x${userAddress}`;
    } else {
      throw new Error(`Invalid userAddress format: ${typeof userAddress}`);
    }

    // Validate and checksum the address using ethers
    try {
      formattedUserAddress = ethers.getAddress(formattedUserAddress);
    } catch (addressError) {
      throw new Error(`Invalid Ethereum address: ${formattedUserAddress}. Error: ${addressError.message}`);
    }

    // CRITICAL: Ensure user address is not the treasury address
    if (formattedUserAddress.toLowerCase() === TREASURY_CONTRACT_ADDRESS.toLowerCase()) {
      throw new Error('Cannot withdraw to treasury contract address. Please use your connected wallet address.');
    }

    // CRITICAL: Ensure user address is not the treasury wallet address
    if (formattedUserAddress.toLowerCase() === treasuryWallet.address.toLowerCase()) {
      throw new Error('Cannot withdraw to treasury wallet address. Please use your connected wallet address.');
    }

    console.log('🔧 Formatted user address:', formattedUserAddress);
    console.log('🔧 Treasury contract address:', TREASURY_CONTRACT_ADDRESS);
    console.log('🔧 Treasury wallet address:', treasuryWallet.address);
    console.log('🔧 Amount in Wei:', amountWei.toString());

    // Check if treasury contract address is actually a contract
    let isContract = false;
    try {
      const code = await provider.getCode(TREASURY_CONTRACT_ADDRESS);
      isContract = code && code !== '0x';
      console.log(`📋 Treasury address is ${isContract ? 'a contract' : 'NOT a contract (wallet address)'}`);
    } catch (codeError) {
      console.log('⚠️ Could not check if address is contract:', codeError.message);
    }

    // If treasury contract doesn't exist or contract call fails, use direct wallet transfer
    let useDirectTransfer = !isContract;
    
    if (isContract) {
      // Create Treasury Contract instance
      const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, treasuryWallet);

      // Verify contract ownership
      let contractOwner;
      try {
        contractOwner = await treasuryContract.owner();
        console.log(`🔐 Contract owner: ${contractOwner}`);
        
        if (contractOwner.toLowerCase() !== treasuryWallet.address.toLowerCase()) {
          console.log('⚠️ Treasury wallet is NOT the contract owner, using direct transfer...');
          useDirectTransfer = true;
        } else {
          // Try to use contract method
          console.log('💸 Attempting to use Treasury Contract emergencyWithdraw...');
          
          try {
            // Estimate gas first
            const gasEstimate = await treasuryContract.emergencyWithdraw.estimateGas(
              formattedUserAddress,
              amountWei
            );
            console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
            
            // Execute contract call
            const tx = await treasuryContract.emergencyWithdraw(
              formattedUserAddress,
              amountWei,
              { gasLimit: gasEstimate * BigInt(120) / BigInt(100) } // Add 20% buffer
            );

            console.log(`📤 Transaction sent: ${tx.hash}`);
            console.log(`✅ Withdraw MNT to ${formattedUserAddress}, TX: ${tx.hash}`);

            return new Response(JSON.stringify({
              success: true,
              transactionHash: tx.hash,
              amount: amount,
              userAddress: formattedUserAddress,
              toAddress: formattedUserAddress,
              treasuryAddress: TREASURY_CONTRACT_ADDRESS,
              status: 'pending',
              message: 'Transaction sent successfully via Treasury Contract. Check Mantle Explorer for confirmation.'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (contractError) {
            console.log('⚠️ Contract call failed:', contractError.message);
            console.log('💸 Falling back to direct wallet transfer...');
            useDirectTransfer = true;
          }
        }
      } catch (ownerError) {
        console.log('⚠️ Could not verify contract owner:', ownerError.message);
        useDirectTransfer = true;
      }
    }

    // Use direct wallet transfer (fallback or primary method)
    if (useDirectTransfer) {
      console.log('💸 Using direct wallet transfer from Treasury wallet...');
      
      const walletBalance = await provider.getBalance(treasuryWallet.address);
      console.log(`💰 Treasury Wallet balance: ${ethers.formatEther(walletBalance)} MNT`);
      
      if (walletBalance < amountWei) {
        return NextResponse.json(
          { error: `Treasury wallet has insufficient funds. Wallet balance: ${ethers.formatEther(walletBalance)} MNT, Requested: ${amount} MNT` },
          { status: 400 }
        );
      }
      
      console.log(`💸 Sending ${amount} MNT from ${treasuryWallet.address} to ${formattedUserAddress}...`);
      const tx = await treasuryWallet.sendTransaction({
        to: formattedUserAddress,
        value: amountWei,
      });
      
      console.log(`📤 Direct transfer sent: ${tx.hash}`);
      console.log(`✅ Withdraw MNT to ${formattedUserAddress}, TX: ${tx.hash}`);

      return new Response(JSON.stringify({
        success: true,
        transactionHash: tx.hash,
        amount: amount,
        userAddress: formattedUserAddress,
        toAddress: formattedUserAddress,
        treasuryAddress: treasuryWallet.address,
        status: 'pending',
        message: 'Transaction sent successfully via direct wallet transfer. Check Mantle Explorer for confirmation.',
        note: isContract ? 'Used direct wallet transfer (contract call unavailable)' : 'Used direct wallet transfer (no contract at treasury address)'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
