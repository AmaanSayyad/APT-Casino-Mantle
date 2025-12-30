import { NextResponse } from 'next/server';
import { ethers, JsonRpcProvider, Wallet } from 'ethers';
import { mantleTestnetConfig } from '@/config/mantleTestnetConfig';

/**
 * Treasury Balance API - Mantle Network
 * 
 * Returns treasury balance information for the Mantle Sepolia Testnet.
 */
export async function GET() {
  try {
    const MANTLE_RPC_URL = mantleTestnetConfig.rpcUrls.default.http[0];
    const TREASURY_PRIVATE_KEY = process.env.MANTLE_TREASURY_PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY;
    
    if (!TREASURY_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Treasury not configured' },
        { status: 500 }
      );
    }

    const provider = new JsonRpcProvider(MANTLE_RPC_URL);
    const treasuryWallet = new Wallet(TREASURY_PRIVATE_KEY, provider);
    
    const balance = await provider.getBalance(treasuryWallet.address);
    const balanceInMNT = ethers.formatEther(balance);
    
    return NextResponse.json({
      success: true,
      treasury: {
        address: treasuryWallet.address,
        balance: balanceInMNT,
        balanceWei: balance.toString(),
        currency: 'MNT'
      },
      network: {
        name: mantleTestnetConfig.name,
        chainId: mantleTestnetConfig.id,
        rpcUrl: MANTLE_RPC_URL,
        explorer: mantleTestnetConfig.blockExplorers.default.url
      }
    });
    
  } catch (error) {
    console.error('❌ Treasury balance check failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check treasury balance',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
