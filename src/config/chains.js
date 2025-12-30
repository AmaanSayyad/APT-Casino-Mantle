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

// Legacy export for backwards compatibility
export const somniaTestnet = mantleSepolia;

export default {
  mantleSepolia,
  somniaTestnet, // Legacy alias
};
