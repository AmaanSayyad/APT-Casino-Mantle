// Casino Treasury Configuration
// This file contains the treasury wallet address and related configuration
// Updated for Mantle Sepolia Testnet

// Treasury Contract Address (deployed on Mantle Sepolia Testnet)
export const TREASURY_CONFIG = {
  // Mantle Sepolia Treasury Contract (for deposits/withdrawals)
  ADDRESS: process.env.MANTLE_TREASURY_ADDRESS || process.env.TREASURY_ADDRESS || '',
  
  // ⚠️  DEVELOPMENT ONLY - Never use in production!
  PRIVATE_KEY: process.env.MANTLE_TREASURY_PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY || '',
  
  // Network configuration for Mantle Sepolia Testnet (for deposit/withdraw)
  NETWORK: {
    CHAIN_ID: '0x138B', // Mantle Sepolia Testnet (5003 in decimal)
    CHAIN_NAME: 'Mantle Sepolia Testnet',
    RPC_URL: process.env.NEXT_PUBLIC_MANTLE_TESTNET_RPC || 'https://rpc.sepolia.mantle.xyz',
    EXPLORER_URL: process.env.NEXT_PUBLIC_MANTLE_TESTNET_EXPLORER || 'https://sepolia.mantlescan.xyz'
  },
  
  // Gas settings for transactions
  GAS: {
    DEPOSIT_LIMIT: process.env.GAS_LIMIT_DEPOSIT ? '0x' + parseInt(process.env.GAS_LIMIT_DEPOSIT).toString(16) : '0x1E8480', // 2000000 gas for contract deposit() call
    WITHDRAW_LIMIT: process.env.GAS_LIMIT_WITHDRAW ? '0x' + parseInt(process.env.GAS_LIMIT_WITHDRAW).toString(16) : '0x1E8480', // 2000000 gas for contract withdraw() call
  },
  
  // Minimum and maximum deposit amounts (in MNT)
  LIMITS: {
    MIN_DEPOSIT: parseFloat(process.env.MIN_DEPOSIT) || 0.001, // 0.001 MNT minimum
    MAX_DEPOSIT: parseFloat(process.env.MAX_DEPOSIT) || 100, // 100 MNT maximum
  }
};

// Helper function to validate treasury address
export const isValidTreasuryAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to get treasury info
export const getTreasuryInfo = () => {
  return {
    address: TREASURY_CONFIG.ADDRESS,
    network: TREASURY_CONFIG.NETWORK.CHAIN_NAME,
    chainId: TREASURY_CONFIG.NETWORK.CHAIN_ID
  };
};

