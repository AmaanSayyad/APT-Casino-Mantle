// Network utilities for Mantle Sepolia
import { mantleSepolia } from '@/config/chains';

export const MANTLE_SEPOLIA_CONFIG = {
  chainId: '0x138B', // 5003 in hex
  chainName: 'Mantle Sepolia Testnet',
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
  blockExplorerUrls: ['https://sepolia.mantlescan.xyz'],
};

// Legacy config for backwards compatibility
export const SOMNIA_TESTNET_CONFIG = MANTLE_SEPOLIA_CONFIG;

export const switchToMantleSepolia = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Try to switch to Mantle Sepolia
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MANTLE_SEPOLIA_CONFIG.chainId }],
    });
  } catch (switchError) {
    // If the chain is not added, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [MANTLE_SEPOLIA_CONFIG],
        });
      } catch (addError) {
        throw new Error('Failed to add Mantle Sepolia to MetaMask');
      }
    } else {
      throw new Error('Failed to switch to Mantle Sepolia');
    }
  }
};

// Legacy function for backwards compatibility
export const switchToSomniaTestnet = switchToMantleSepolia;

export const isMantleSepolia = (chainId) => {
  return chainId === 5003 || chainId === '0x138B';
};

// Legacy function for backwards compatibility
export const isSomniaTestnet = isMantleSepolia;

export const formatMNTBalance = (balance, decimals = 5) => {
  const numBalance = parseFloat(balance || '0');
  return `${numBalance.toFixed(decimals)} MNT`;
};

// Legacy function for backwards compatibility
export const formatMonBalance = formatMNTBalance;

export const getMantleSepoliaExplorerUrl = (txHash) => {
  return `https://sepolia.mantlescan.xyz/tx/${txHash}`;
};

// Legacy function for backwards compatibility
export const getSomniaTestnetExplorerUrl = getMantleSepoliaExplorerUrl;
