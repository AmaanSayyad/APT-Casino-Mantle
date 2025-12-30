/**
 * Mantle Sepolia Testnet Configuration
 * Network documentation: https://docs.mantle.xyz/network/introduction/network-details
 */

// Mantle Sepolia Testnet Configuration
export const mantleTestnetConfig = {
  id: 5003,
  name: 'Mantle Sepolia Testnet',
  network: 'mantle-sepolia',
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
};

export const mantleTestnetTokens = {
  MNT: {
    address: 'native',
    decimals: 18,
    symbol: 'MNT',
    name: 'Mantle Token',
    isNative: true,
  },
};

// Helper function to get explorer URL for a transaction
export const getMantleExplorerTxUrl = (txHash) => {
  return `${mantleTestnetConfig.blockExplorers.default.url}/tx/${txHash}`;
};

// Helper function to get explorer URL for an address
export const getMantleExplorerAddressUrl = (address) => {
  return `${mantleTestnetConfig.blockExplorers.default.url}/address/${address}`;
};

export default mantleTestnetConfig;
