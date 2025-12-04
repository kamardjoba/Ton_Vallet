/**
 * TON Blockchain integration module
 * Provides functions for interacting with TON blockchain using TonWeb
 */

// Import from @ton/crypto using namespace import to avoid ESM issues
import * as TonCrypto from '@ton/crypto';
const { mnemonicToSeed, keyPairFromSeed, keyPairFromSecretKey } = TonCrypto;

// tonweb uses CommonJS, we'll import it as a namespace
// Vite will handle CommonJS transformation
// @ts-ignore - tonweb is CommonJS module
import * as TonWebModule from 'tonweb';

// Extract default export or use the module itself
const TonWeb = (TonWebModule as any).default || TonWebModule;

// Buffer will be available globally after polyfills.ts is loaded in main.tsx
// For TypeScript, we use window.Buffer which is set by polyfills
const getBuffer = (): any => {
  if (typeof window !== 'undefined' && (window as any).Buffer) {
    return (window as any).Buffer;
  }
  throw new Error('Buffer polyfill not loaded. Make sure polyfills.ts is imported first.');
};

// Use public TON API endpoint
const TONWEB_API_URL = 'https://toncenter.com/api/v2/jsonRPC';

export interface WalletState {
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
}

/**
 * Initializes TonWeb instance
 */
export function initTonWeb(): any {
  return new TonWeb(new TonWeb.HttpProvider(TONWEB_API_URL));
}

/**
 * Generates wallet from seed phrase
 * @param seedPhrase - Space-separated mnemonic words
 * @returns Wallet state with address, publicKey, and privateKey
 */
export async function generateWalletFromSeed(seedPhrase: string): Promise<WalletState> {
  if (!seedPhrase || seedPhrase.trim().length === 0) {
    throw new Error('Seed phrase is required');
  }

  const words = seedPhrase.trim().split(/\s+/);
  if (words.length !== 24) {
    throw new Error('Seed phrase must contain 24 words');
  }

  try {
    // mnemonicToSeed requires seed string as second parameter
    // Use "TON default seed" for standard wallet generation
    const seed = await mnemonicToSeed(words, 'TON default seed');
    // keyPairFromSeed expects Buffer, seed is already Buffer from mnemonicToSeed
    // Use first 32 bytes of seed for key pair generation
    const keyPair = keyPairFromSeed(seed.slice(0, 32));

    const tonweb = initTonWeb();
    const WalletClass = tonweb.wallet.all['v4R2'];
    const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
    });

    const address = await wallet.getAddress();
    const addressString = address.toString(true, true, true);

    // Convert Buffer to hex string
    const publicKeyHex = keyPair.publicKey.toString('hex');
    const privateKeyHex = keyPair.secretKey.toString('hex');

    return {
      address: addressString,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
    };
  } catch (error) {
    throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function to retry API calls with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || 
                         error?.message?.includes('Ratelimit') ||
                         error?.message?.includes('Too Many Requests');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Rate limit hit, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Gets wallet balance from TON blockchain
 * @param address - TON wallet address
 * @returns Balance in nanoTON (1 TON = 1e9 nanoTON)
 */
export async function getBalance(address: string): Promise<string> {
  if (!address) {
    throw new Error('Address is required');
  }

  try {
    const tonweb = initTonWeb();
    
    // Retry with backoff for rate limit errors
    const balance = await retryWithBackoff(
      () => tonweb.provider.getBalance(address),
      2, // Max 2 retries
      2000 // Start with 2 second delay
    );
    
    // Check if balance is a valid number
    const balanceStr = balance?.toString() || '0';
    if (isNaN(Number(balanceStr)) || 
        balanceStr.includes('error') || 
        balanceStr.includes('Error') ||
        balanceStr.includes('Ratelimit') ||
        balanceStr.includes('429')) {
      console.warn('Invalid balance response:', balanceStr);
      return '0';
    }
    
    return balanceStr;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Don't log rate limit errors as errors, just warn
    if (errorMsg.includes('429') || errorMsg.includes('Ratelimit') || errorMsg.includes('Too Many Requests')) {
      console.warn('Rate limit exceeded for balance request. Please try again later.');
    } else {
      console.error('Failed to get balance:', error);
    }
    
    // Return '0' instead of throwing to prevent app crash
    return '0';
  }
}

/**
 * Converts nanoTON to TON
 */
export function nanoToTon(nano: string): string {
  // Validate input
  if (!nano || typeof nano !== 'string') {
    return '0';
  }
  
  // Check if it's a valid number string
  if (isNaN(Number(nano)) || nano.includes('error') || nano.includes('Error') || nano.includes('Ratelimit')) {
    return '0';
  }
  
  try {
    const nanoBigInt = BigInt(nano);
    const ton = Number(nanoBigInt) / 1e9;
    return ton.toFixed(9).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Failed to convert nanoTON to TON:', error, 'Input:', nano);
    return '0';
  }
}

/**
 * Converts TON to nanoTON
 */
export function tonToNano(ton: string): string {
  const tonNumber = parseFloat(ton);
  if (isNaN(tonNumber)) {
    throw new Error('Invalid TON amount');
  }
  return Math.floor(tonNumber * 1e9).toString();
}

/**
 * Sends TON transaction
 * @param privateKey - Wallet private key (hex string)
 * @param toAddress - Recipient address
 * @param amount - Amount in TON (will be converted to nanoTON)
 * @param comment - Optional transaction comment
 * @returns Transaction hash
 */
export async function sendTransaction(
  privateKey: string,
  toAddress: string,
  amount: string,
  comment?: string
): Promise<string> {
  if (!privateKey || !toAddress || !amount) {
    throw new Error('Private key, recipient address, and amount are required');
  }

  try {
    const tonweb = initTonWeb();
    
    // Convert hex string to Buffer (available globally from polyfills)
    const Buffer = getBuffer();
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    
    // Reconstruct keypair from secret key (private key)
    const keyPair = keyPairFromSecretKey(privateKeyBuffer);

    const WalletClass = tonweb.wallet.all['v4R2'];
    const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
    });

    const amountNano = tonToNano(amount);
    const seqno = await wallet.methods.seqno().call();

    const transfer = wallet.methods.transfer({
      secretKey: keyPair.secretKey,
      toAddress: toAddress,
      amount: amountNano,
      seqno: seqno || 0,
      payload: comment ? new TextEncoder().encode(comment) : undefined,
      sendMode: 3,
    });

    const result = await transfer.send();
    return result;
  } catch (error) {
    throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets transaction history for a wallet address
 * @param address - Wallet address
 * @param limit - Maximum number of transactions to fetch
 * @returns Array of transactions
 */
export async function getTransactionHistory(
  address: string,
  limit: number = 10
): Promise<Transaction[]> {
  if (!address) {
    throw new Error('Address is required');
  }

  try {
    const tonweb = initTonWeb();
    
    // Retry with backoff for rate limit errors
    const transactions = await retryWithBackoff(
      () => tonweb.provider.getTransactions(address, limit),
      2, // Max 2 retries
      2000 // Start with 2 second delay
    );

    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    return transactions.map((tx: any) => ({
      hash: tx.transaction_id?.hash || '',
      from: tx.in_msg?.source_address || '',
      to: tx.out_msgs?.[0]?.destination_address || address,
      value: tx.in_msg?.value || '0',
      timestamp: tx.utime ? tx.utime * 1000 : Date.now(), // Convert to milliseconds
      status: 'success' as const,
    }));
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Don't log rate limit errors as errors, just warn
    if (errorMsg.includes('429') || errorMsg.includes('Ratelimit') || errorMsg.includes('Too Many Requests')) {
      console.warn('Rate limit exceeded for transaction history. Please try again later.');
    } else {
      console.error('Failed to get transaction history:', error);
    }
    
    // Return empty array instead of throwing to prevent app crash
    return [];
  }
}

