/**
 * Zustand store for TON Wallet application state
 * Manages wallet state, encryption, and blockchain interactions
 */

import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WalletState } from '../blockchain/ton';
import type { EncryptedData } from '../crypto/crypto';
import { generateWalletFromSeed, getBalance, sendTransaction, getTransactionHistory, getNFTItems, getJettonBalances } from '../blockchain/ton';
import { encryptSeedPhrase, decryptSeedPhrase } from '../crypto/crypto';
import type { Transaction, NFTItem, JettonToken } from '../blockchain/ton';
import { validateSeedPhrase, validateTONAddress, validateTONAmount, validatePassword } from '../utils/validation';
import { securityLogger, rateLimiter } from '../utils/security';
import { formatError, getUserFriendlyError } from '../utils/errors';

interface WalletStore {
  // Wallet state
  wallet: WalletState | null;
  isInitialized: boolean;
  isUnlocked: boolean;
  encryptedSeed: EncryptedData | null;
  
  // Balance and transactions
  balance: string;
  transactions: Transaction[];
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  hasLoadedBalance: boolean; // Track if balance was loaded at least once
  
  // NFT state
  nfts: NFTItem[];
  isLoadingNFTs: boolean;
  nftError: string | null;
  
  // Jetton tokens state
  jettonTokens: JettonToken[];
  isLoadingJettons: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  initializeWallet: (seedPhrase: string, password: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => void;
  updateBalance: () => Promise<void>;
  sendTon: (toAddress: string, amount: string, comment?: string) => Promise<string>;
  refreshTransactions: () => Promise<void>;
  loadNFTs: () => Promise<void>;
  loadJettons: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const storeCreator: StateCreator<WalletStore, [], [], WalletStore> = (set, get) => ({
      // Initial state
      wallet: null,
      isInitialized: false,
      isUnlocked: false,
      encryptedSeed: null,
      balance: '0',
      transactions: [],
      isLoadingBalance: false,
      isLoadingTransactions: false,
      hasLoadedBalance: false,
      nfts: [],
      isLoadingNFTs: false,
      nftError: null,
      jettonTokens: [],
      isLoadingJettons: false,
      error: null,

      /**
       * Initializes wallet from seed phrase and encrypts it
       */
      initializeWallet: async (seedPhrase: string, password: string) => {
        try {
          set({ error: null });
          
          // Validate inputs
          const seedValidation = validateSeedPhrase(seedPhrase);
          if (!seedValidation.valid) {
            const errorMsg = seedValidation.error || 'Invalid seed phrase';
            securityLogger.log('WALLET_INIT_FAILED', { reason: 'invalid_seed' });
            set({ error: errorMsg });
            throw new Error(errorMsg);
          }

          const passwordValidation = validatePassword(password);
          if (!passwordValidation.valid) {
            const errorMsg = passwordValidation.error || 'Invalid password';
            securityLogger.log('WALLET_INIT_FAILED', { reason: 'invalid_password' });
            set({ error: errorMsg });
            throw new Error(errorMsg);
          }
          
          securityLogger.log('WALLET_INIT_START', {});
          
          // Generate wallet from seed phrase
          const wallet = await generateWalletFromSeed(seedPhrase);
          
          // Encrypt seed phrase
          const encryptedSeed = await encryptSeedPhrase(seedPhrase, password);
          
          set({
            wallet,
            encryptedSeed,
            isInitialized: true,
            isUnlocked: true,
          });
          
          securityLogger.log('WALLET_INIT_SUCCESS', { address: wallet.address });
          
          // Fetch initial balance, transactions, and jettons in parallel for faster loading
          await Promise.all([
            get().updateBalance(),
            get().refreshTransactions(),
            get().loadJettons(),
          ]);
        } catch (error) {
          // Log full error for debugging
          console.error('initializeWallet error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error message:', errorMessage);
          console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
          
          const errorDetails = getUserFriendlyError(error);
          securityLogger.log('WALLET_INIT_ERROR', { 
            error: errorDetails.code,
            originalError: errorMessage 
          });
          set({ error: errorDetails.userMessage });
          throw new Error(errorDetails.userMessage);
        }
      },

      /**
       * Unlocks wallet by decrypting seed phrase
       */
      unlockWallet: async (password: string) => {
        try {
          set({ error: null });
          
          const { encryptedSeed } = get();
          if (!encryptedSeed) {
            const errorDetails = getUserFriendlyError('WALLET_NOT_INITIALIZED');
            securityLogger.log('WALLET_UNLOCK_FAILED', { reason: 'not_initialized' });
            set({ error: errorDetails.userMessage, isUnlocked: false });
            throw new Error(errorDetails.userMessage);
          }
          
          securityLogger.log('WALLET_UNLOCK_ATTEMPT', {});
          
          // Decrypt seed phrase (with timing attack protection)
          const seedPhrase = await decryptSeedPhrase(encryptedSeed, password);
          
          // Regenerate wallet from decrypted seed
          const wallet = await generateWalletFromSeed(seedPhrase);
          
          set({
            wallet,
            isUnlocked: true,
          });
          
          securityLogger.log('WALLET_UNLOCK_SUCCESS', { address: wallet.address });
          
          // Fetch balance, transactions, and jettons in parallel for faster loading
          await Promise.all([
            get().updateBalance(),
            get().refreshTransactions(),
            get().loadJettons(),
          ]);
        } catch (error) {
          const errorDetails = getUserFriendlyError(error);
          securityLogger.log('WALLET_UNLOCK_FAILED', { reason: errorDetails.code });
          set({ error: errorDetails.userMessage, isUnlocked: false });
          throw new Error(errorDetails.userMessage);
        }
      },

      /**
       * Locks wallet (clears sensitive data from memory)
       */
      lockWallet: () => {
        set({
          wallet: null,
          isUnlocked: false,
          balance: '0',
          transactions: [],
          hasLoadedBalance: false,
        });
      },

      /**
       * Updates wallet balance from blockchain
       */
      updateBalance: async () => {
        const { wallet, isLoadingBalance } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        // Prevent multiple simultaneous balance updates
        if (isLoadingBalance) {
          console.log('⏳ Balance update already in progress, skipping...');
          return;
        }
        
        try {
          const { hasLoadedBalance } = get();
          
          // Only show loading on first load
          if (!hasLoadedBalance) {
            set({ isLoadingBalance: true, error: null });
          } else {
            set({ error: null });
          }
          
          // Get balance (will use cache if available)
          const balance = await getBalance(wallet.address);
          set({ balance, isLoadingBalance: false, hasLoadedBalance: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update balance';
          // Always reset loading state
          const { balance: currentBalance } = get();
          // Only set hasLoadedBalance to true if we have a valid balance (not '0')
          set({ isLoadingBalance: false, hasLoadedBalance: currentBalance !== '0' });
          // Don't show rate limit errors to user, just use cached/previous balance
          if (!errorMessage.includes('rate limit') && !errorMessage.includes('Rate limit')) {
            set({ error: errorMessage });
          }
        }
      },

      /**
       * Sends TON transaction
       */
      sendTon: async (toAddress: string, amount: string, comment?: string) => {
        const { wallet } = get();
        if (!wallet || !wallet.privateKey) {
          const errorDetails = getUserFriendlyError('WALLET_LOCKED');
          securityLogger.log('SEND_TON_FAILED', { reason: 'wallet_locked' });
          set({ error: errorDetails.userMessage });
          throw new Error(errorDetails.userMessage);
        }
        
        // Validate inputs
        const addressValidation = validateTONAddress(toAddress);
        if (!addressValidation.valid) {
          const errorMsg = addressValidation.error || 'Invalid address';
          securityLogger.log('SEND_TON_FAILED', { reason: 'invalid_address' });
          set({ error: errorMsg });
          throw new Error(errorMsg);
        }

        const amountValidation = validateTONAmount(amount);
        if (!amountValidation.valid) {
          const errorMsg = amountValidation.error || 'Invalid amount';
          securityLogger.log('SEND_TON_FAILED', { reason: 'invalid_amount' });
          set({ error: errorMsg });
          throw new Error(errorMsg);
        }

        // Check rate limiting
        const rateLimitKey = `send_${wallet.address}`;
        if (!rateLimiter.isAllowed(rateLimitKey)) {
          const waitTime = rateLimiter.getTimeUntilNext(rateLimitKey);
          const errorDetails = getUserFriendlyError('RATE_LIMIT');
          securityLogger.log('SEND_TON_RATE_LIMIT', { waitTime });
          set({ error: `${errorDetails.userMessage} Please wait ${Math.ceil(waitTime / 1000)} seconds.` });
          throw new Error(errorDetails.userMessage);
        }
        
        try {
          set({ error: null });
          securityLogger.log('SEND_TON_START', { toAddress, amount: '[REDACTED]' });
          
          const txHash = await sendTransaction(wallet.privateKey, toAddress, amount, comment);
          
          securityLogger.log('SEND_TON_SUCCESS', { txHash });
          
          // Refresh balance and transactions after sending
          await Promise.all([
            get().updateBalance(),
            get().refreshTransactions(),
          ]);
          
          return txHash;
        } catch (error) {
          const errorDetails = getUserFriendlyError(error);
          securityLogger.log('SEND_TON_ERROR', { error: errorDetails.code });
          set({ error: errorDetails.userMessage });
          throw new Error(errorDetails.userMessage);
        }
      },

      /**
       * Refreshes transaction history
       */
      refreshTransactions: async () => {
        const { wallet, isLoadingTransactions } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        // Prevent multiple simultaneous transaction updates
        if (isLoadingTransactions) {
          console.log('⏳ Transaction update already in progress, skipping...');
          return;
        }
        
        try {
          set({ isLoadingTransactions: true, error: null });
          // Reduced delay for faster loading
          await new Promise(resolve => setTimeout(resolve, 200));
          const transactions = await getTransactionHistory(wallet.address, 20);
          set({ transactions, isLoadingTransactions: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transactions';
          // Don't show rate limit errors as critical errors
          const isRateLimit = errorMessage.includes('rate limit') || 
                             errorMessage.includes('Rate limit') ||
                             errorMessage.includes('429');
          
          // Always reset loading state
          set({ isLoadingTransactions: false });
          
          // Only set error if it's not a rate limit (rate limit is handled by returning cached/empty)
          if (!isRateLimit) {
            set({ error: errorMessage });
          }
        }
      },

      /**
       * Clears error state
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Loads NFT items for the wallet
       */
      loadNFTs: async () => {
        const { wallet } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        try {
          set({ isLoadingNFTs: true, nftError: null });
          // Reduced delay for faster loading
          await new Promise(resolve => setTimeout(resolve, 100));
          const nfts = await getNFTItems(wallet.address);
          set({ nfts, isLoadingNFTs: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load NFTs';
          // Don't show rate limit errors to user, just keep existing NFTs
          if (!errorMessage.includes('rate limit') && !errorMessage.includes('Rate limit')) {
            set({ nftError: errorMessage, isLoadingNFTs: false });
          } else {
            set({ isLoadingNFTs: false });
          }
        }
      },

      /**
       * Loads jetton token balances for the wallet
       */
      loadJettons: async () => {
        const { wallet } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        try {
          set({ isLoadingJettons: true });
          // Reduced delay for faster loading
          await new Promise(resolve => setTimeout(resolve, 100));
          const tokens = await getJettonBalances(wallet.address);
          set({ jettonTokens: tokens, isLoadingJettons: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load tokens';
          // Don't show rate limit errors to user, just keep existing tokens
          if (!errorMessage.includes('rate limit') && !errorMessage.includes('Rate limit')) {
            console.error('Failed to load jetton tokens:', errorMessage);
          }
          set({ isLoadingJettons: false });
        }
      },

      /**
       * Resets entire wallet state
       */
      reset: () => {
        set({
          wallet: null,
          isInitialized: false,
          isUnlocked: false,
          encryptedSeed: null,
          balance: '0',
          transactions: [],
          nfts: [],
          nftError: null,
          error: null,
        });
      },
    });

const useWalletStore = create<WalletStore>()(
  persist(
    storeCreator,
    {
      name: 'ton-wallet-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: WalletStore) => ({
        encryptedSeed: state.encryptedSeed,
        isInitialized: state.isInitialized,
      }),
    }
  )
);

export default useWalletStore;

