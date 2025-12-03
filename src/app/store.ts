/**
 * Zustand store for TON Wallet application state
 * Manages wallet state, encryption, and blockchain interactions
 */

import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WalletState } from '../blockchain/ton';
import type { EncryptedData } from '../crypto/crypto';
import { generateWalletFromSeed, getBalance, sendTransaction, getTransactionHistory } from '../blockchain/ton';
import { encryptSeedPhrase, decryptSeedPhrase } from '../crypto/crypto';
import type { Transaction } from '../blockchain/ton';

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
  
  // Error state
  error: string | null;
  
  // Actions
  initializeWallet: (seedPhrase: string, password: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => void;
  updateBalance: () => Promise<void>;
  sendTon: (toAddress: string, amount: string, comment?: string) => Promise<string>;
  refreshTransactions: () => Promise<void>;
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
      error: null,

      /**
       * Initializes wallet from seed phrase and encrypts it
       */
      initializeWallet: async (seedPhrase: string, password: string) => {
        try {
          set({ error: null });
          
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
          
          // Fetch initial balance
          await get().updateBalance();
          await get().refreshTransactions();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet';
          set({ error: errorMessage });
          throw new Error(errorMessage);
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
            throw new Error('No encrypted seed found. Please initialize wallet first.');
          }
          
          // Decrypt seed phrase
          const seedPhrase = await decryptSeedPhrase(encryptedSeed, password);
          
          // Regenerate wallet from decrypted seed
          const wallet = await generateWalletFromSeed(seedPhrase);
          
          set({
            wallet,
            isUnlocked: true,
          });
          
          // Fetch balance and transactions
          await get().updateBalance();
          await get().refreshTransactions();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to unlock wallet';
          set({ error: errorMessage, isUnlocked: false });
          throw new Error(errorMessage);
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
        });
      },

      /**
       * Updates wallet balance from blockchain
       */
      updateBalance: async () => {
        const { wallet } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        try {
          set({ isLoadingBalance: true, error: null });
          const balance = await getBalance(wallet.address);
          set({ balance, isLoadingBalance: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update balance';
          set({ error: errorMessage, isLoadingBalance: false });
        }
      },

      /**
       * Sends TON transaction
       */
      sendTon: async (toAddress: string, amount: string, comment?: string) => {
        const { wallet } = get();
        if (!wallet || !wallet.privateKey) {
          throw new Error('Wallet is not unlocked');
        }
        
        try {
          set({ error: null });
          const txHash = await sendTransaction(wallet.privateKey, toAddress, amount, comment);
          
          // Refresh balance and transactions after sending
          await get().updateBalance();
          await get().refreshTransactions();
          
          return txHash;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      /**
       * Refreshes transaction history
       */
      refreshTransactions: async () => {
        const { wallet } = get();
        if (!wallet || !wallet.address) {
          return;
        }
        
        try {
          set({ isLoadingTransactions: true, error: null });
          const transactions = await getTransactionHistory(wallet.address, 20);
          set({ transactions, isLoadingTransactions: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transactions';
          set({ error: errorMessage, isLoadingTransactions: false });
        }
      },

      /**
       * Clears error state
       */
      clearError: () => {
        set({ error: null });
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

