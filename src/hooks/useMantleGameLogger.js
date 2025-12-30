import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { MantleGameLogger } from '../services/MantleGameLogger';
import { getMantleExplorerTxUrl } from '../config/mantleTestnetConfig';

/**
 * React hook for Mantle Game Logger
 * Provides easy access to game logging functionality on Mantle Sepolia
 */
export function useMantleGameLogger() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [isLogging, setIsLogging] = useState(false);
  const [lastLogTxHash, setLastLogTxHash] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Convert wagmi clients to ethers provider and signer
   */
  const getEthersProviderAndSigner = useCallback(async () => {
    if (!publicClient) {
      return { provider: null, signer: null };
    }

    // Create ethers provider from public client
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Create signer if wallet is connected
    let signer = null;
    if (walletClient && isConnected) {
      signer = await provider.getSigner();
    }

    return { provider, signer };
  }, [publicClient, walletClient, isConnected]);

  /**
   * Log a game result to Mantle Sepolia Testnet via API
   * Uses treasury wallet (authorized logger) to write to contract
   */
  const logGame = useCallback(async ({
    gameType,
    betAmount,
    result,
    payout,
    entropyProof
  }) => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return null;
    }

    setIsLogging(true);
    setError(null);

    try {
      // Use API route to log game (treasury is authorized)
      const response = await fetch('/api/log-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType,
          playerAddress: address,
          betAmount,
          result,
          payout,
          entropyProof
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log game');
      }

      console.log('✅ Game logged via API:', data.transactionHash);
      setLastLogTxHash(data.transactionHash);
      return data.transactionHash;

    } catch (err) {
      console.error('Failed to log game to Mantle:', err);
      setError(err.message);
      // Don't throw - game logging failure shouldn't break the game
      return null;
    } finally {
      setIsLogging(false);
    }
  }, [address, isConnected]);

  /**
   * Get player's game history from Mantle
   */
  const getHistory = useCallback(async (limit = 50) => {
    if (!address) {
      return [];
    }

    try {
      const { provider } = await getEthersProviderAndSigner();
      const logger = new MantleGameLogger(provider, null);
      return await logger.getGameHistory(address, limit);
    } catch (err) {
      console.error('Failed to get history from Mantle:', err);
      return [];
    }
  }, [address, getEthersProviderAndSigner]);

  /**
   * Get player's total game count
   */
  const getGameCount = useCallback(async () => {
    if (!address) {
      return 0;
    }

    try {
      const { provider } = await getEthersProviderAndSigner();
      const logger = new MantleGameLogger(provider, null);
      return await logger.getPlayerGameCount(address);
    } catch (err) {
      console.error('Failed to get game count:', err);
      return 0;
    }
  }, [address, getEthersProviderAndSigner]);

  /**
   * Get contract statistics
   */
  const getStats = useCallback(async () => {
    try {
      const { provider } = await getEthersProviderAndSigner();
      const logger = new MantleGameLogger(provider, null);
      return await logger.getStats();
    } catch (err) {
      console.error('Failed to get stats:', err);
      return null;
    }
  }, [getEthersProviderAndSigner]);

  /**
   * Subscribe to game result events
   */
  const subscribeToEvents = useCallback((callback) => {
    const setupSubscription = async () => {
      try {
        const { provider } = await getEthersProviderAndSigner();
        const logger = new MantleGameLogger(provider, null);
        return logger.onGameResultLogged(callback);
      } catch (err) {
        console.error('Failed to subscribe to events:', err);
        return () => {};
      }
    };

    let unsubscribe = () => {};
    setupSubscription().then(unsub => {
      unsubscribe = unsub;
    });

    return () => unsubscribe();
  }, [getEthersProviderAndSigner]);

  /**
   * Get transaction explorer URL
   */
  const getExplorerUrl = useCallback((txHash) => {
    return getMantleExplorerTxUrl(txHash);
  }, []);

  return {
    // State
    isLogging,
    lastLogTxHash,
    error,
    isConnected,
    address,
    
    // Functions
    logGame,
    getHistory,
    getGameCount,
    getStats,
    subscribeToEvents,
    getExplorerUrl
  };
}

export default useMantleGameLogger;
