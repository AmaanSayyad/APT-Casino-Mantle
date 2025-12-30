/**
 * Custom Chain Definitions
 * Defines custom chains not included in wagmi/chains
 */

import { defineChain } from 'viem';

// Mantle Sepolia Testnet Chain Definition
// Configuration based on official Mantle documentation
export const mantleSepolia = defineChain({
  id: 5003, // Chain ID (0x138B in hex)
  name: 'Mantle Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MNT',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
    public: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Sepolia Explorer',
      url: 'https://sepolia.mantlescan.xyz',
    },
  },
  testnet: true,
});

// Somnia Testnet Chain Definition (deprecated - kept for reference)
// Configuration based on official network.md documentation
export const somniaTestnet = defineChain({
  id: 50312, // Correct chain ID (0xc488 in hex)
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'STT',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'], // Primary RPC from network.md
    },
    public: {
      http: ['https://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Shannon Explorer',
      url: 'https://shannon-explorer.somnia.network', // Official explorer
    },
  },
  testnet: true,
});

export default {
  mantleSepolia,
  somniaTestnet,
};
