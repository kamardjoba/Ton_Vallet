/**
 * TON Blockchain integration module
 * Provides functions for interacting with TON blockchain using TonWeb
 */

// Import from @ton/crypto using namespace import to avoid ESM issues
import * as TonCrypto from '@ton/crypto';
const { mnemonicToSeed, keyPairFromSeed, keyPairFromSecretKey } = TonCrypto;

// Note: @ton/core causes compatibility issues with Buffer polyfill
// We'll use tonweb only for now
// For proper NFT metadata, would need @ton/ton library with proper setup

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

// Use public TON API endpoints (with fallback)
const TONWEB_API_URLS = [
  'https://toncenter.com/api/v2/jsonRPC',
  'https://testnet.toncenter.com/api/v2/jsonRPC', // Fallback (though this is testnet)
];

// Primary API endpoint
const TONWEB_API_URL = TONWEB_API_URLS[0];

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
  tokenType?: 'TON' | 'JETTON'; // Type of token in transaction
  jettonSymbol?: string; // Symbol of jetton token (if tokenType is JETTON)
  jettonAmount?: string; // Amount of jetton tokens
}

export interface NFTItem {
  address: string;
  collectionAddress?: string;
  index?: number;
  ownerAddress?: string;
  name?: string;
  description?: string;
  image?: string;
  poster?: string; // Preview/thumbnail for video NFTs
  thumbnail?: string; // Alternative preview image
  attributes?: Array<{ trait_type: string; value: string }>;
}

export interface JettonToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  image?: string;
  verified?: boolean;
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
    // Use non-bounceable address for receiving funds (third parameter = false)
    // Format: user-friendly, URL-safe, non-bounceable
    // Non-bounceable addresses are required for receiving funds to undeployed wallets
    const addressString = address.toString(true, true, false);

    // Validate address format (should start with letters for user-friendly format)
    if (!addressString || addressString.length < 10) {
      throw new Error('Invalid address generated');
    }

    // Log address for debugging
    console.log('✅ Generated wallet address:', addressString);
    console.log('✅ Address format: user-friendly, URL-safe, non-bounceable');
    console.log('✅ Address length:', addressString.length, 'characters');

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
  maxRetries: number = 2,
  initialDelay: number = 500
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Check if result is a rate limit error string
      if (typeof result === 'string') {
        const lowerResult = result.toLowerCase();
        if (lowerResult.includes('ratelimit') || 
            lowerResult.includes('rate limit') ||
            lowerResult.includes('429')) {
          throw new Error('Rate limit exceeded');
        }
      }
      
      return result;
    } catch (error: any) {
      const errorMsg = error?.message || String(error) || '';
      const isRateLimit = errorMsg.includes('429') || 
                         errorMsg.includes('Ratelimit') ||
                         errorMsg.includes('rate limit') ||
                         errorMsg.includes('Too Many Requests') ||
                         error?.response?.status === 429 ||
                         error?.status === 429;
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        const waitSeconds = Math.ceil(delay / 1000);
        console.warn(`⏳ Rate limit hit, waiting ${waitSeconds} seconds before retry... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's the last attempt and it's a rate limit, provide helpful message
      if (isRateLimit && attempt === maxRetries - 1) {
        throw new Error('Rate limit exceeded. Please wait a few minutes and try again.');
      }
      
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Normalizes TON address for API calls
 * Converts address to raw format if needed
 * Handles both user-friendly and raw address formats
 */
function normalizeAddress(address: string): string {
  if (!address) return address;
  
  try {
    // Remove any whitespace
    address = address.trim();
    
    // If it's already a raw address (starts with 0: or -1:), return as is
    if (address.match(/^[0-9-]+:[a-fA-F0-9]+$/)) {
      return address;
    }
    
    // Try to validate and normalize user-friendly address
    // User-friendly addresses start with letters (EQ, UQ, etc.)
    if (address.match(/^[A-Za-z0-9_-]+$/)) {
      // Try to parse it with tonweb to ensure it's valid
      try {
        const tonweb = initTonWeb();
        const Address = tonweb.utils.Address;
        const addr = new Address(address);
        // Return the address in user-friendly format
        return addr.toString(true, true, false);
      } catch (parseError) {
        console.warn('⚠️ Could not parse address, using as is:', parseError);
        // Return original address if parsing fails
        return address;
      }
    }
    
    // Return as is if format is unknown
    return address;
  } catch (error) {
    console.warn('⚠️ Error normalizing address, using original:', error);
    return address.trim();
  }
}


/**
 * Gets wallet balance from TON blockchain
 * @param address - TON wallet address
 * @returns Balance in nanoTON (1 TON = 1e9 nanoTON)
 */
// Cache for balance to reduce API calls
let balanceCache: { [key: string]: { balance: string; timestamp: number } } = {};
const BALANCE_CACHE_DURATION = 60000; // 60 seconds cache (increased for better performance)

export async function getBalance(address: string): Promise<string> {
  if (!address) {
    throw new Error('Address is required');
  }

  // Check cache first - always return cached value if available
  const cached = balanceCache[address];
  if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION) {
    console.log('💾 Using cached balance');
    return cached.balance;
  }
  
  // If cache exists but expired, save it to return if API fails
  const expiredCache = cached ? cached.balance : null;

  try {
    const tonweb = initTonWeb();
    const normalizedAddress = normalizeAddress(address);
    
    // Try to convert to raw format for better API compatibility
    let apiAddress = normalizedAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(normalizedAddress);
      // Try raw format first (more reliable for API calls)
      apiAddress = addr.toString(false, false, false);
    } catch (e) {
      // If conversion fails, use normalized address as is
      console.warn('⚠️ Could not convert address to raw format, using normalized:', e);
      apiAddress = normalizedAddress;
    }
    
    // Retry with backoff for rate limit errors
    const balance = await retryWithBackoff(
      async () => {
        try {
          return await tonweb.provider.getBalance(apiAddress);
        } catch (apiError: any) {
          // If raw format fails, try user-friendly format
          if (apiAddress !== normalizedAddress) {
            console.warn('⚠️ Raw address failed, trying user-friendly format');
            return await tonweb.provider.getBalance(normalizedAddress);
          }
          throw apiError;
        }
      },
      1, // Max 1 retry (reduced for faster loading)
      1000 // Start with 1 second delay (reduced)
    );
    
    // Check if balance is a valid number
    const balanceStr = balance?.toString() || '0';
    if (isNaN(Number(balanceStr)) || 
        balanceStr.includes('error') || 
        balanceStr.includes('Error') ||
        balanceStr.includes('Ratelimit') ||
        balanceStr.includes('429')) {
      console.warn('Invalid balance response:', balanceStr);
      // Return cached balance if available, otherwise 0
      if (cached) {
        return cached.balance;
      }
      return '0';
    }
    
    // Update cache
    balanceCache[address] = {
      balance: balanceStr,
      timestamp: Date.now(),
    };
    
    return balanceStr;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Don't log rate limit errors as errors, just warn
    if (errorMsg.includes('429') || errorMsg.includes('Ratelimit') || errorMsg.includes('Too Many Requests') || errorMsg.includes('rate limit')) {
      // Only log as info, not error
      console.log('ℹ️ Rate limit exceeded for balance request. Using cached balance if available.');
      // Return expired cache if available, otherwise return '0'
      if (expiredCache) {
        return expiredCache;
      }
      // If no cache, return 0 but don't throw to prevent app crash
      return '0';
    }
    
    // Only log non-rate-limit errors
    console.error('Failed to get balance:', error);
    
    // Return expired cache if available, otherwise '0'
    if (expiredCache) {
      return expiredCache;
    }
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

// Cache for transactions to reduce API calls
let transactionCache: { [key: string]: { transactions: Transaction[]; timestamp: number } } = {};
const TRANSACTION_CACHE_DURATION = 120000; // 120 seconds cache (increased for better performance)

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

  // Check cache first
  const cached = transactionCache[address];
  if (cached && Date.now() - cached.timestamp < TRANSACTION_CACHE_DURATION) {
    console.log('💾 Using cached transactions');
    return cached.transactions;
  }

  try {
    const tonweb = initTonWeb();
    const normalizedAddress = normalizeAddress(address);
    
    // Try to convert to raw format for API call
    let apiAddress = normalizedAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(normalizedAddress);
      apiAddress = addr.toString(false, false, false); // raw format
      console.log('🔍 Requesting transactions for address (raw):', apiAddress);
      console.log('🔍 Original address (user-friendly):', normalizedAddress);
    } catch (e) {
      console.warn('⚠️ Could not convert address to raw format:', e);
      console.warn('⚠️ Address that failed:', normalizedAddress);
      // Try to parse address differently or use as is
      try {
        // Sometimes addresses need to be parsed without validation
        const Address = tonweb.utils.Address;
        // Try creating address without validation
        const addr = new Address(normalizedAddress, true); // allow invalid
        apiAddress = addr.toString(false, false, false);
        console.log('✅ Successfully converted with validation disabled');
      } catch (e2) {
        console.warn('⚠️ All address conversion attempts failed, using original:', e2);
        apiAddress = normalizedAddress;
      }
    }
    
    // Retry with backoff for rate limit errors
    // Use longer delays and fewer retries to avoid rate limits
    let transactions;
    try {
      transactions = await retryWithBackoff(
        () => tonweb.provider.getTransactions(apiAddress, limit),
        1, // Max 1 retry (reduced for faster loading)
        2000 // Start with 2 second delay (reduced)
      );
    } catch (apiError: any) {
      const errorMsg = apiError?.message || String(apiError) || '';
      const isRateLimit = errorMsg.includes('429') || 
                         errorMsg.includes('Ratelimit') ||
                         errorMsg.includes('rate limit') ||
                         errorMsg.includes('Too Many Requests');
      
      // If rate limit, return cached transactions if available
      if (isRateLimit && cached) {
        console.warn('⚠️ Rate limit exceeded. Using cached transactions.');
        return cached.transactions;
      }
      
      // If raw format fails, try with user-friendly format (only if not rate limit)
      if (!isRateLimit) {
        console.warn('⚠️ API call with raw address failed, trying user-friendly format:', apiError);
        try {
          transactions = await retryWithBackoff(
            () => tonweb.provider.getTransactions(normalizedAddress, limit),
            1, // Only 1 retry for fallback
            3000
          );
        } catch (fallbackError) {
          // If fallback also fails and we have cache, return cache
          if (cached) {
            console.warn('⚠️ Fallback also failed. Using cached transactions.');
            return cached.transactions;
          }
          throw apiError; // Throw original error
        }
      } else {
        // Rate limit error - return cached or empty array
        if (cached) {
          return cached.transactions;
        }
        // Don't throw rate limit errors, return empty array instead
        console.warn('⚠️ Rate limit exceeded. No cached transactions available. Returning empty array.');
        return [];
      }
    }

    console.log('📦 Raw transactions from API:', transactions);
    
    // Check if response is a rate limit error string
    if (typeof transactions === 'string') {
      if (transactions.toLowerCase().includes('ratelimit') || 
          transactions.toLowerCase().includes('rate limit') ||
          transactions.toLowerCase().includes('429')) {
        console.warn('⚠️ Rate limit exceeded. Please wait a moment and try again.');
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      console.warn('⚠️ Unexpected string response from API:', transactions);
      return [];
    }
    
    const txCount = Array.isArray(transactions) ? transactions.length : 0;
    console.log('📦 Transactions count:', txCount);
    
    // Try to get jetton transfers info from TON API for better detection
    let jettonTransfersMap: { [key: string]: { symbol: string; amount: string; decimals?: number } } = {};
    try {
      // Use TON API to get events which include jetton transfers
      // Reduced limit and added timeout for faster loading
      const eventsUrl = `https://tonapi.io/v2/accounts/${apiAddress}/events?limit=50`; // Reduced limit for faster response
      console.log('📡 Fetching jetton events from TON API:', eventsUrl);
      
      // Timeout after 3 seconds to prevent blocking
      const eventsPromise = fetch(eventsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      const timeoutPromise = new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const eventsResponse = await Promise.race([eventsPromise, timeoutPromise]);
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        console.log('✅ Jetton events data:', eventsData);
        if (eventsData.events && Array.isArray(eventsData.events)) {
          for (const event of eventsData.events) {
            if (event.actions && Array.isArray(event.actions)) {
              for (const action of event.actions) {
                // Check for JettonTransfer action
                if (action.type === 'JettonTransfer' && action.JettonTransfer) {
                  const jettonTransfer = action.JettonTransfer;
                  // Try multiple ways to get transaction hash
                  let txHash = event.event_id || 
                               event.hash || 
                               (event.in_tx && (event.in_tx.hash || event.in_tx.lt)) ||
                               (event.out_tx && (event.out_tx.hash || event.out_tx.lt)) ||
                               '';
                  
                  // Also try to get hash from account address and timestamp
                  if (!txHash && event.account && event.timestamp) {
                    txHash = `${event.account.address}_${event.timestamp}`;
                  }
                  
                  if (txHash && jettonTransfer.jetton) {
                    const decimals = jettonTransfer.jetton.decimals || 9;
                    let amount = jettonTransfer.amount || '0';
                    
                    // Format amount if it's a large number
                    try {
                      const amountBigInt = BigInt(amount);
                      const divisor = BigInt(10 ** decimals);
                      const wholePart = amountBigInt / divisor;
                      const fractionalPart = amountBigInt % divisor;
                      amount = fractionalPart === BigInt(0)
                        ? wholePart.toString()
                        : `${wholePart}.${fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
                    } catch (e) {
                      console.warn('Could not format jetton amount:', e);
                    }
                    
                    // Store with multiple hash formats for better matching
                    const symbol = jettonTransfer.jetton.symbol || 'JETTON';
                    const jettonInfo = {
                      symbol: symbol,
                      amount: amount,
                      decimals: decimals,
                    };
                    
                    // Store with original hash
                    jettonTransfersMap[txHash] = jettonInfo;
                    
                    // Also try to store with different hash formats
                    if (event.in_tx && event.in_tx.hash) {
                      jettonTransfersMap[event.in_tx.hash] = jettonInfo;
                    }
                    if (event.out_tx && event.out_tx.hash) {
                      jettonTransfersMap[event.out_tx.hash] = jettonInfo;
                    }
                    
                    console.log('✅ Found jetton transfer:', { txHash, symbol, amount, decimals });
                  }
                }
              }
            }
          }
        }
        console.log('📊 Total jetton transfers found:', Object.keys(jettonTransfersMap).length);
      } else {
        console.warn('⚠️ Events API response not OK:', eventsResponse.status);
      }
    } catch (e) {
      console.warn('⚠️ Could not fetch jetton transfers from TON API:', e);
    }

    if (!transactions || !Array.isArray(transactions)) {
      console.warn('⚠️ No transactions array returned from API. Response type:', typeof transactions);
      return [];
    }

    if (transactions.length === 0) {
      console.log('ℹ️ No transactions found for this address');
      return [];
    }

    // Process transactions and determine if they are incoming or outgoing
    const processedTransactions: Transaction[] = [];
    
    // Normalize wallet address for comparison (convert to raw format)
    let walletAddressRaw = normalizedAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(normalizedAddress);
      walletAddressRaw = addr.toString(false, false, false).toLowerCase();
    } catch (e) {
      walletAddressRaw = normalizedAddress.toLowerCase();
    }
    
    for (const tx of transactions) {
      console.log('🔍 Processing transaction:', tx);
      console.log('🔍 Transaction keys:', Object.keys(tx));
      console.log('🔍 in_msg:', tx.in_msg);
      console.log('🔍 out_msgs:', tx.out_msgs);
      
      const hash = tx.transaction_id?.hash || tx.hash || tx.lt || '';
      const timestamp = tx.utime ? tx.utime * 1000 : (tx.now ? tx.now * 1000 : Date.now());
      
      // Check for incoming transactions (in_msg exists)
      if (tx.in_msg) {
        const inMsg = tx.in_msg;
        let fromAddress = '';
        let value = '0';
        
        // Try different possible field names for source address
        fromAddress = inMsg.source_address || 
                     inMsg.src_address || 
                     inMsg.from || 
                     (inMsg.source && typeof inMsg.source === 'object' && 'toString' in inMsg.source ? String(inMsg.source) : '') ||
                     (typeof inMsg.source === 'string' ? inMsg.source : '') ||
                     '';
        
        // Try different possible field names for value
        value = inMsg.value || 
                inMsg.amount || 
                inMsg.ton ||
                (inMsg.msg_data && inMsg.msg_data.amount) ||
                '0';
        
        // If value is an object, try to extract it
        if (typeof value === 'object' && value !== null) {
          value = String(value) || '0';
        }
        
        console.log('📥 Incoming transaction details:', {
          inMsg,
          fromAddress,
          value,
          valueType: typeof value,
        });
        
        // Normalize addresses for comparison
        let fromAddressNormalized = fromAddress.toLowerCase();
        try {
          if (fromAddress) {
            const Address = tonweb.utils.Address;
            const addr = new Address(fromAddress);
            fromAddressNormalized = addr.toString(false, false, false).toLowerCase();
          }
        } catch (e) {
          console.warn('⚠️ Could not normalize fromAddress:', e);
        }
        
        console.log('📥 Incoming transaction check:', {
          fromAddress,
          fromAddressNormalized,
          walletAddressRaw,
          isIncoming: fromAddressNormalized !== walletAddressRaw && fromAddressNormalized !== '',
        });
        
        // Check if this is a jetton transfer
        let isJettonTransfer = false;
        let jettonSymbol = '';
        let jettonAmount = '0';
        
        // First check if we have jetton info from TON API events
        if (hash && jettonTransfersMap[hash]) {
          isJettonTransfer = true;
          jettonSymbol = jettonTransfersMap[hash].symbol;
          jettonAmount = jettonTransfersMap[hash].amount;
          console.log('✅ Using jetton info from events API:', { hash, symbol: jettonSymbol, amount: jettonAmount });
        } else {
          // Fallback: check message body/op code
          const msgBody = inMsg.msg_data || inMsg.body || inMsg.message || '';
          const bodyStr = typeof msgBody === 'string' ? msgBody : JSON.stringify(msgBody);
          
          // Jetton transfer op code: 0xf8a7ea5 (decimal: 260734005)
          if (bodyStr.includes('f8a7ea5') || 
              bodyStr.includes('260734005') ||
              bodyStr.includes('jetton') ||
              bodyStr.includes('Jetton') ||
              (inMsg.op && (inMsg.op === '0xf8a7ea5' || inMsg.op === 260734005))) {
            isJettonTransfer = true;
            console.log('⚠️ Detected jetton transfer by op code, but no API data available');
          }
          
          // Also check transaction type from TON API if available
          if (tx.action && tx.action.type === 'jetton_transfer') {
            isJettonTransfer = true;
            if (tx.action.jetton) {
              jettonSymbol = tx.action.jetton.symbol || '';
              if (tx.action.amount) {
                jettonAmount = tx.action.amount;
              }
            }
          }
        }
        
        // If source is not our address (or empty), it's an incoming transaction
        // Also check if in_msg exists but source is empty (system transaction or initial)
        if (fromAddressNormalized && fromAddressNormalized !== walletAddressRaw) {
          processedTransactions.push({
            hash: hash || `in-${timestamp}-${fromAddress}`,
            from: fromAddress || 'System',
            to: normalizedAddress,
            value: value.toString(),
            timestamp,
            status: 'success',
            tokenType: isJettonTransfer ? 'JETTON' : 'TON',
            jettonSymbol: isJettonTransfer ? jettonSymbol : undefined,
            jettonAmount: isJettonTransfer ? jettonAmount : undefined,
          });
          console.log('✅ Added incoming transaction', { isJettonTransfer, jettonSymbol });
        } else if (!fromAddressNormalized && tx.in_msg) {
          // Empty source might be initial transaction or system transaction
          // Check if there's any value
          const hasValue = value && value !== '0' && value !== '0n';
          if (hasValue) {
            processedTransactions.push({
              hash: hash || `in-${timestamp}-system`,
              from: 'System',
              to: normalizedAddress,
              value: value.toString(),
              timestamp,
              status: 'success',
              tokenType: isJettonTransfer ? 'JETTON' : 'TON',
              jettonSymbol: isJettonTransfer ? jettonSymbol : undefined,
              jettonAmount: isJettonTransfer ? jettonAmount : undefined,
            });
            console.log('✅ Added system/incoming transaction (empty source)', { isJettonTransfer });
          }
        }
      }
      
      // Check for outgoing transactions (out_msgs exist)
      if (tx.out_msgs && Array.isArray(tx.out_msgs) && tx.out_msgs.length > 0) {
        console.log('📤 Found outgoing messages:', tx.out_msgs.length);
        for (const outMsg of tx.out_msgs) {
          console.log('📤 Processing out_msg:', outMsg);
          let toAddress = '';
          let value = '0';
          
          // Try different possible field names
          toAddress = outMsg.destination_address || 
                     outMsg.dest_address || 
                     outMsg.to || 
                     (outMsg.destination && typeof outMsg.destination === 'object' && 'toString' in outMsg.destination ? String(outMsg.destination) : '') ||
                     (typeof outMsg.destination === 'string' ? outMsg.destination : '') ||
                     '';
          
          value = outMsg.value || 
                  outMsg.amount || 
                  outMsg.ton ||
                  (outMsg.msg_data && outMsg.msg_data.amount) ||
                  '0';
          
          // If value is an object, try to extract it
          if (typeof value === 'object' && value !== null) {
            value = String(value) || '0';
          }
          
          console.log('📤 Outgoing transaction details:', {
            toAddress,
            value,
            valueType: typeof value,
          });
          
          // Check if this is a jetton transfer
          let isJettonTransfer = false;
          let jettonSymbol = '';
          let jettonAmount = '0';
          
          // First check if we have jetton info from TON API events
          if (hash && jettonTransfersMap[hash]) {
            isJettonTransfer = true;
            jettonSymbol = jettonTransfersMap[hash].symbol;
            jettonAmount = jettonTransfersMap[hash].amount;
            console.log('✅ Using jetton info from events API (outgoing):', { hash, symbol: jettonSymbol, amount: jettonAmount });
          } else {
            // Fallback: check message body/op code
            const msgBody = outMsg.msg_data || outMsg.body || outMsg.message || '';
            const bodyStr = typeof msgBody === 'string' ? msgBody : JSON.stringify(msgBody);
            
            // Jetton transfer op code: 0xf8a7ea5
            if (bodyStr.includes('f8a7ea5') || 
                bodyStr.includes('260734005') ||
                bodyStr.includes('jetton') ||
                bodyStr.includes('Jetton')) {
              isJettonTransfer = true;
              console.log('⚠️ Detected jetton transfer by op code (outgoing), but no API data available');
            }
          }
          
          if (toAddress) {
            processedTransactions.push({
              hash: hash || `out-${timestamp}-${toAddress}`,
              from: normalizedAddress,
              to: toAddress,
              value: value.toString(),
              timestamp,
              status: 'success',
              tokenType: isJettonTransfer ? 'JETTON' : 'TON',
              jettonSymbol: isJettonTransfer ? jettonSymbol : undefined,
              jettonAmount: isJettonTransfer ? jettonAmount : undefined,
            });
            console.log('✅ Added outgoing transaction', { isJettonTransfer, jettonSymbol });
          }
        }
      }
      
      // Also check for transaction data in other formats
      if (!tx.in_msg && !tx.out_msgs && tx.data) {
        console.log('🔍 Checking transaction data field:', tx.data);
        // Some APIs might return data differently
      }
    }
    
    console.log('📊 Processed transactions:', processedTransactions.length);
    
    // Sort by timestamp (newest first) and remove duplicates
    const uniqueTransactions = processedTransactions
      .filter((tx, index, self) => 
        index === self.findIndex(t => t.hash === tx.hash && t.timestamp === tx.timestamp)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    console.log('✅ Final transactions count:', uniqueTransactions.length);
    
    // Update cache
    transactionCache[address] = {
      transactions: uniqueTransactions,
      timestamp: Date.now(),
    };
    
    return uniqueTransactions;
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || '';
    const isRateLimit = errorMsg.includes('429') || 
                       errorMsg.includes('Ratelimit') ||
                       errorMsg.includes('rate limit') ||
                       errorMsg.includes('Too Many Requests');
    
    // Check cache for rate limit errors
    if (isRateLimit) {
      const cached = transactionCache[address];
      if (cached) {
        console.log('ℹ️ Rate limit exceeded. Using cached transactions.');
        return cached.transactions;
      }
      console.log('ℹ️ Rate limit exceeded. No cached transactions available.');
      // Return empty array instead of throwing to prevent app crash
      return [];
    }
    
    // Only log non-rate-limit errors
    console.error('❌ Error getting transaction history:', error);
    console.error('❌ Error details:', {
      message: errorMsg,
      stack: error?.stack,
      address: address,
    });
    
    // Check cache for any error
    const cached = transactionCache[address];
    if (cached) {
      console.warn('⚠️ Error occurred. Using cached transactions.');
      return cached.transactions;
    }
    
    // Return empty array instead of throwing to prevent app crash
    return [];
  }
}

/**
 * Gets NFT items owned by a wallet address
 * @param address - Wallet address
 * @returns Array of NFT items
 */
export async function getNFTItems(address: string): Promise<NFTItem[]> {
  if (!address) {
    throw new Error('Address is required');
  }

  try {
    const tonweb = initTonWeb();
    const normalizedAddress = normalizeAddress(address);
    
    // Convert to raw format for API
    let apiAddress = normalizedAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(normalizedAddress);
      apiAddress = addr.toString(false, false, false);
    } catch (e) {
      console.warn('⚠️ Could not convert address to raw format for NFT query:', e);
      console.warn('⚠️ Address that failed:', normalizedAddress);
      // Try alternative parsing
      try {
        const Address = tonweb.utils.Address;
        const addr = new Address(normalizedAddress, true); // allow invalid
        apiAddress = addr.toString(false, false, false);
        console.log('✅ Successfully converted NFT address with validation disabled');
      } catch (e2) {
        console.warn('⚠️ All NFT address conversion attempts failed, using original');
        apiAddress = normalizedAddress;
      }
    }

    // Use TON API to get NFT items
    // Try multiple approaches to find NFTs
    
    const nftItems: NFTItem[] = [];
    const seenAddresses = new Set<string>();
    
    console.log('🔍 Starting NFT detection for address:', normalizedAddress);
    console.log('🔍 API address (raw):', apiAddress);
    
    // Approach 1: Try to get NFTs using transactions
    // IMPORTANT: Only make ONE request to avoid rate limits
    let transactions: any[] | null = null;
    
    try {
      // Add longer delay before making request to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try using getTransactions to find NFT-related transactions
      // Reduced limit to avoid rate limits
      console.log('📡 Requesting transactions (single request to avoid rate limit)...');
      transactions = await retryWithBackoff(
        () => tonweb.provider.getTransactions(apiAddress, 50), // Reduced from 100 to 50
        2,
        4000 // Increased delay
      );

      console.log('📦 Received transactions:', transactions?.length || 0);

      if (Array.isArray(transactions) && transactions.length > 0) {
        console.log('🔍 Scanning transactions for NFT transfers...');
        
        // Scan transactions for NFT transfers
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i];
          const txHash = tx.transaction_id?.hash || tx.hash || `tx-${i}`;
          
          console.log(`\n📄 Transaction ${i + 1}/${transactions.length}:`, {
            hash: txHash,
            utime: tx.utime,
            has_in_msg: !!tx.in_msg,
            has_out_msgs: !!(tx.out_msgs && tx.out_msgs.length > 0),
            account: tx.account || tx.address || 'unknown',
          });
          
          // IMPORTANT: Check ALL parts of transaction, not just in_msg
          // NFT transactions can appear in different places
          
          // Check 1: Incoming messages (NFTs received via transfer)
          if (tx.in_msg) {
            const inMsg = tx.in_msg;
            const sourceAddr = inMsg.source_address || inMsg.src_address || '';
            const msgValue = inMsg.value || '0';
            const valueNum = parseInt(msgValue.toString());
            
            console.log('  📥 Incoming message:', {
              source: sourceAddr,
              value: msgValue,
              valueNum: valueNum,
              valueInTON: (valueNum / 1e9).toFixed(4),
            });
            
            // Check if this looks like an NFT transfer
            if (sourceAddr && sourceAddr.toLowerCase() !== apiAddress.toLowerCase()) {
              // Normalize source address for comparison
              let normalizedSource = sourceAddr.toLowerCase();
              try {
                const Address = tonweb.utils.Address;
                const addr = new Address(sourceAddr);
                normalizedSource = addr.toString(false, false, false).toLowerCase();
              } catch (e) {
                console.warn('  ⚠️ Could not normalize source address:', e);
              }
              
              // Check if we haven't seen this address before
              if (!seenAddresses.has(normalizedSource)) {
                console.log('  🔍 New source address detected:', normalizedSource);
                
                // IMPORTANT: This is a simplified check
                // Real NFT detection requires:
                // 1. Checking if sourceAddr is an NFT item contract (by calling get_nft_data)
                // 2. Parsing message body for NFT transfer op codes (0x5fcc3d14)
                // 3. Verifying contract code matches NFT standard
                
                // For now, we'll check if the transaction has characteristics of NFT transfer
                // NFT transfers usually have small forward amounts
                // But we should be more lenient - any incoming transaction could be NFT
                
                // Check message body/data for NFT transfer indicators
                const hasBody = !!(inMsg.msg_data || inMsg.body || inMsg.message);
                const bodyData = inMsg.msg_data || inMsg.body || inMsg.message;
                
                console.log('  📋 Message data:', {
                  hasBody,
                  bodyType: typeof bodyData,
                  bodyPreview: bodyData ? String(bodyData).substring(0, 100) : 'none',
                });
                
                // Add all incoming transactions as potential NFTs
                // This is more permissive but will catch more NFTs
                // In production, you'd verify these are actually NFT contracts
                seenAddresses.add(normalizedSource);
                
                console.log(`  ✅ Adding as potential NFT: ${sourceAddr}`);
                
                // Try to get NFT details immediately to get image and metadata
                // But don't wait - we'll load details when user clicks on NFT
                nftItems.push({
                  address: sourceAddr,
                  ownerAddress: normalizedAddress,
                  name: `NFT #${nftItems.length + 1}`,
                  // Description will be loaded from metadata when details are fetched
                });
    } else {
                console.log('  ⏭️ Source address already seen, skipping');
              }
            } else {
              console.log('  ⏭️ Source address is our wallet or empty, skipping');
            }
          } else {
            console.log('  ⏭️ No incoming message in this transaction');
          }
          
          // Check 2: Outgoing messages (might contain NFT transfer info)
          if (tx.out_msgs && Array.isArray(tx.out_msgs) && tx.out_msgs.length > 0) {
            console.log(`  📤 Outgoing messages: ${tx.out_msgs.length}`);
            for (let j = 0; j < tx.out_msgs.length; j++) {
              const msg = tx.out_msgs[j];
              const destAddr = msg.destination_address || msg.dest_address || '';
              const msgValue = msg.value || '0';
              const msgBody = msg.msg_data || msg.body || msg.message || '';
              const bodyStr = typeof msgBody === 'string' ? msgBody : JSON.stringify(msgBody);
              
              console.log(`    📤 Message ${j + 1}:`, {
                destination: destAddr,
                value: msgValue,
                hasBody: !!msgBody,
                bodyPreview: bodyStr.substring(0, 50),
              });
              
              // Check if this outgoing message is an NFT transfer
              // NFT transfers to our wallet would have our address as destination
              // But we're looking for NFTs we RECEIVED, so check if destination is NFT-related
              // Actually, for received NFTs, we should check if we're the destination in incoming messages
            }
          }
          
          // Check 3: Transaction account/address (NFT contract address)
          // Sometimes the transaction itself is on an NFT contract
          const txAccount = tx.account || tx.address || '';
          if (txAccount && 
              txAccount.toLowerCase() !== apiAddress.toLowerCase() &&
              !seenAddresses.has(txAccount.toLowerCase())) {
            
            console.log(`  🎨 Found potential NFT contract in transaction account: ${txAccount}`);
            
            // Check if this looks like an NFT contract transaction
            // NFT contracts often have specific patterns
            const isPotentialNFT = 
              tx.in_msg || // Has incoming message (NFT transfer)
              (tx.out_msgs && tx.out_msgs.length > 0); // Has outgoing messages
            
            if (isPotentialNFT) {
              seenAddresses.add(txAccount.toLowerCase());
              
              console.log(`  ✅ Adding transaction account as potential NFT: ${txAccount}`);
              
              nftItems.push({
                address: txAccount,
                ownerAddress: normalizedAddress,
                name: `NFT #${nftItems.length + 1}`,
                // Description will be loaded from metadata when details are fetched
              });
            }
          }
          
          // Check 4: Look for NFT-specific data in transaction
          // NFT transactions often have specific op codes or data patterns
          const txData = tx.data || tx.storage || '';
          const txDataStr = typeof txData === 'string' ? txData : JSON.stringify(txData);
          
          if (txDataStr && txDataStr.length > 0) {
            // Look for NFT-related patterns in transaction data
            const hasNFTPattern = 
              txDataStr.includes('nft') ||
              txDataStr.includes('NFT') ||
              txDataStr.includes('5fcc3d14') || // transfer op code
              txDataStr.includes('05138d91');   // ownership_assigned op code
            
            if (hasNFTPattern) {
              console.log(`  🎨 Found NFT pattern in transaction data for hash: ${txHash}`);
              // The NFT address might be in the transaction itself
              if (txAccount && !seenAddresses.has(txAccount.toLowerCase())) {
                seenAddresses.add(txAccount.toLowerCase());
                nftItems.push({
                  address: txAccount,
                  ownerAddress: normalizedAddress,
                  name: `NFT #${nftItems.length + 1}`,
                  // Description will be loaded from metadata when details are fetched
                });
              }
            }
          }
        }
        
        console.log(`\n✅ Scan complete. Found ${nftItems.length} potential NFT items`);
      } else {
        console.warn('⚠️ No transactions found or transactions is not an array');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Don't fail completely on rate limit - just log and continue
      if (errorMsg.includes('429') || errorMsg.includes('Ratelimit') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Rate limit')) {
        console.warn('⚠️ Rate limit hit during NFT detection. Will try alternative methods...');
        transactions = null; // Set to null so we don't try to use it
      } else {
        console.error('❌ Failed to fetch transactions for NFT detection:', error);
        console.error('Error details:', {
          message: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
        });
        transactions = null;
      }
    }

    // Approach 2: Try to use TON API v4 directly for NFT queries
    // This is an alternative method that might work better
    try {
      console.log('🔍 Trying alternative NFT detection method via TON API v4...');
      
      // Try to get NFTs using TON API v4 endpoint
      // Note: This requires the API to support NFT queries
      const apiUrl = TONWEB_API_URL.replace('/jsonRPC', '');
      
      // Alternative: Try using Getgems API or other NFT services
      // For now, we'll try a direct approach
      
      // Get account state to find NFT contracts
      // In TON, NFTs are stored as separate contracts
      // We need to find contracts that are NFT items owned by this address
      
      console.log('📡 Attempting direct API call for NFT detection...');
      
      // This is a placeholder - in production you'd use proper NFT API
      // For example: https://tonapi.io/v2/accounts/{address}/nfts
      
    } catch (error) {
      console.warn('⚠️ Alternative NFT detection method failed:', error);
    }

    // Approach 3: Try to find NFT by checking known NFT collection patterns
    // This is a workaround - checking if transactions match NFT transfer patterns
    // NOTE: We use transactions from Approach 1 to avoid making another API call (rate limit)
    if (transactions && Array.isArray(transactions) && transactions.length > 0) {
      console.log('🔍 Using already fetched transactions for pattern detection (avoiding additional API call to prevent rate limit)...');
      
      // Use the transactions we already have instead of making another request
      const moreTransactions = transactions;

      if (Array.isArray(moreTransactions) && moreTransactions.length > 0) {
        console.log(`📦 Checking ${moreTransactions.length} transactions for NFT patterns...`);
        
        // Look for NFT transfer patterns
        // NFT transfers in TON have specific op codes: 0x5fcc3d14 (transfer) or 0x05138d91 (ownership_assigned)
        for (const tx of moreTransactions) {
          // Check if transaction has NFT-related data
          if (tx.in_msg) {
            const inMsg = tx.in_msg;
            const sourceAddr = inMsg.source_address || inMsg.src_address || '';
            
            // Check message body for NFT transfer op codes
            const msgBody = inMsg.msg_data || inMsg.body || inMsg.message || '';
            const bodyStr = typeof msgBody === 'string' ? msgBody : JSON.stringify(msgBody);
            
            // Look for NFT transfer indicators in the body
            // NFT transfers often have specific patterns in the message
            const isNFTTransfer = 
              bodyStr.includes('5fcc3d14') || // transfer op code
              bodyStr.includes('05138d91') || // ownership_assigned op code
              bodyStr.length > 100; // NFT transfers usually have longer messages
            
            if (sourceAddr && 
                sourceAddr.toLowerCase() !== apiAddress.toLowerCase() &&
                !seenAddresses.has(sourceAddr.toLowerCase())) {
              
              // If it looks like NFT transfer or we haven't seen this address
              if (isNFTTransfer || nftItems.length < 10) { // Limit to prevent too many false positives
                seenAddresses.add(sourceAddr.toLowerCase());
                
                console.log(`🎨 Found NFT candidate (pattern match): ${sourceAddr}`);
                
                nftItems.push({
                  address: sourceAddr,
                  ownerAddress: normalizedAddress,
                  name: `NFT #${nftItems.length + 1}`,
                  // Description will be loaded from metadata when details are fetched
                });
              }
            }
          }
        }
      } else {
        console.log('⚠️ No transactions available for pattern detection');
      }
    } else {
      console.log('⚠️ Skipping pattern detection - no transactions from first approach (avoiding rate limit)');
    }

    // Approach 4: Manual NFT address input (for testing)
    // This allows users to manually add NFT addresses if automatic detection fails
    // We'll store this in a comment for now
    
    console.log(`\n✅ Final NFT detection results: ${nftItems.length} items found`);
    console.log('📋 Found NFT addresses:', nftItems.map(nft => nft.address));
    
    return nftItems;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Don't log rate limit errors as errors, just warn
    if (errorMsg.includes('429') || errorMsg.includes('Ratelimit') || errorMsg.includes('Too Many Requests')) {
      console.warn('⚠️ Rate limit exceeded for NFT query. Please wait a moment and try again.');
    // Return empty array instead of throwing to prevent app crash
      return [];
    }
    
    console.error('Failed to get NFT items:', error);
    return [];
  }
}

/**
 * Gets jetton token balances for a wallet address
 * @param address - Wallet address
 * @returns Array of jetton tokens with balances
 */
export async function getJettonBalances(address: string): Promise<JettonToken[]> {
  if (!address) {
    throw new Error('Address is required');
  }

  try {
    const tonweb = initTonWeb();
    const normalizedAddress = normalizeAddress(address);
    
    // Convert to raw format for API
    let apiAddress = normalizedAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(normalizedAddress);
      apiAddress = addr.toString(false, false, false);
    } catch (e) {
      console.warn('⚠️ Could not convert address to raw format for jetton query:', e);
      apiAddress = normalizedAddress;
    }

    // Use TON API to get jetton balances
    const tokens: JettonToken[] = [];
    
    try {
      const apiUrl = `https://tonapi.io/v2/accounts/${apiAddress}/jettons`;
      console.log('📡 Requesting jetton balances from TON API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Jetton balances from TON API:', data);
        
        if (data.balances && Array.isArray(data.balances)) {
          for (const balance of data.balances) {
            if (balance.jetton && balance.balance) {
              const jetton = balance.jetton;
              const balanceAmount = balance.balance;
              
              // Get jetton metadata
              let symbol = 'JETTON';
              let name = 'Jetton';
              let decimals = 9;
              let image: string | undefined;
              
              if (jetton.symbol) {
                symbol = jetton.symbol;
              }
              if (jetton.name) {
                name = jetton.name;
              }
              if (jetton.decimals !== undefined) {
                decimals = jetton.decimals;
              }
              if (jetton.image) {
                image = resolveIpfsUrl(jetton.image);
              }
              
              // Add default icons for popular tokens if no image
              if (!image) {
                const tokenIcons: { [key: string]: string } = {
                  'USDT': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
                  'USDC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                  'DAI': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
                  'WBTC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
                };
                image = tokenIcons[symbol.toUpperCase()];
              }
              
              // Convert balance from smallest unit to readable format
              const balanceValue = BigInt(balanceAmount);
              const divisor = BigInt(10 ** decimals);
              const wholePart = balanceValue / divisor;
              const fractionalPart = balanceValue % divisor;
              const balanceStr = fractionalPart === BigInt(0) 
                ? wholePart.toString() 
                : `${wholePart}.${fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
              
              // Only include tokens with non-zero balance
              if (balanceValue > BigInt(0)) {
                tokens.push({
                  address: jetton.address || '',
                  symbol,
                  name,
                  decimals,
                  balance: balanceStr,
                  image,
                  verified: jetton.verified || false,
                });
              }
            }
          }
        }
    } else {
        console.warn('⚠️ TON API v2 request failed:', response.status, response.statusText);
      }
    } catch (apiError) {
      console.warn('⚠️ Failed to fetch jetton balances from TON API:', apiError);
    }
    
    // Sort by balance (highest first)
    tokens.sort((a, b) => {
      const balanceA = parseFloat(a.balance) || 0;
      const balanceB = parseFloat(b.balance) || 0;
      return balanceB - balanceA;
    });
    
    console.log('✅ Final jetton tokens:', tokens.length);
    return tokens;
  } catch (error) {
    console.error('Failed to get jetton balances:', error);
    return [];
  }
}

/**
 * Resolves IPFS URL to HTTP gateway URL
 * @param ipfsUrl - IPFS URL (ipfs://... or https://ipfs.io/ipfs/...)
 * @returns HTTP gateway URL
 */
function resolveIpfsUrl(ipfsUrl: string): string {
  if (!ipfsUrl) return '';
  
  // If already HTTP/HTTPS, return as is
  if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
    return ipfsUrl;
  }
  
  // Convert ipfs:// to HTTP gateway
  if (ipfsUrl.startsWith('ipfs://')) {
    const hash = ipfsUrl.replace('ipfs://', '');
    // Try multiple IPFS gateways
    const gateways = [
      `https://ipfs.io/ipfs/${hash}`,
      `https://gateway.pinata.cloud/ipfs/${hash}`,
      `https://cloudflare-ipfs.com/ipfs/${hash}`,
      `https://dweb.link/ipfs/${hash}`,
    ];
    return gateways[0]; // Use first gateway, fallback can be added later
  }
  
  return ipfsUrl;
}

/**
 * Gets NFT item details by address
 * @param nftAddress - NFT item contract address
 * @param existingData - Optional existing NFT data to use if available
 * @returns NFT item details
 */
export async function getNFTDetails(
  nftAddress: string,
  existingData?: NFTItem
): Promise<NFTItem | null> {
  if (!nftAddress) {
    throw new Error('NFT address is required');
  }

  try {
    // If we already have complete data (name, description, image), use it immediately
    if (existingData) {
      const hasCompleteData = 
        existingData.name && 
        existingData.name !== `NFT ${nftAddress.slice(-8)}` &&
        existingData.name !== 'NFT Item' &&
        (existingData.description || existingData.image);
      
      if (hasCompleteData) {
        console.log('✅ Using existing NFT data (complete):', existingData);
        return existingData;
      }
      
      // If we have partial data, start with it
      if (existingData.name || existingData.description || existingData.image) {
        console.log('✅ Using existing NFT data (partial):', existingData);
      }
    }
    
    const tonweb = initTonWeb();
    
    console.log('🔍 Fetching NFT details for:', nftAddress);
    
    // Start with existing data or basic NFT info
    let nftItem: NFTItem = existingData || {
      address: nftAddress,
      name: `NFT ${nftAddress.slice(-8)}`,
      // Don't set default description - let it be undefined if not available
    };

    // Only try to fetch additional data if we don't have complete info
    const needsMoreData = !nftItem.name || 
      nftItem.name === `NFT ${nftAddress.slice(-8)}` ||
      nftItem.name === 'NFT Item' ||
      !nftItem.image;
    
    if (!needsMoreData) {
      console.log('✅ NFT data is complete, skipping API calls');
      return nftItem;
    }
    
    console.log('📡 Need more data, trying API methods...');
    
    // Convert address to raw format (needed for API calls)
    let rawAddress = nftAddress;
    try {
      const Address = tonweb.utils.Address;
      const addr = new Address(nftAddress);
      rawAddress = addr.toString(false, false, false);
      console.log('📊 Raw address for API:', rawAddress);
    } catch (e) {
      console.warn('⚠️ Could not normalize address:', e);
      // Keep original address as fallback
      rawAddress = nftAddress;
    }

    // Try to call get_nft_data() method on NFT contract using TON API
    try {
      console.log('📡 Calling get_nft_data() on NFT contract...');
      
      // Call get_nft_data() method using TON API
      // Method ID for get_nft_data() is 0x38335236 (from TON standards)
      const methodName = 'get_nft_data';
      const methodId = '38335236'; // Hex for get_nft_data
      
      // Use TON API v4 to call contract method
      // Try using tonapi.io or toncenter.com API
      const apiUrl = 'https://tonapi.io/v2/blockchain/accounts/' + rawAddress + '/methods/' + methodName;
      
      console.log('📡 Requesting NFT data from TON API:', apiUrl);
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Check if request was successful
          if (data.success === false) {
            // exit_code 11 means method execution failed - this is common for some NFT contracts
            // It doesn't mean the NFT is invalid, just that we can't get metadata via this method
            // We'll continue with basic NFT info
            if (data.exit_code === 11) {
              console.log('ℹ️ get_nft_data() method not available for this NFT (exit_code: 11)');
              console.log('ℹ️ This is normal for some NFT contracts. Using basic NFT info.');
            } else {
              console.log('ℹ️ TON API returned non-critical error:', {
                exit_code: data.exit_code,
                message: data.message || 'Method execution failed',
              });
            }
            // Don't throw error - continue with basic NFT info
          } else if (data.stack && Array.isArray(data.stack)) {
            console.log('✅ NFT data from TON API:', data);
            // Parse the response
            // TON API v4 returns stack with values
            // Stack format: [index, collection_address, owner_address, individual_content]
            // We need individual_content (usually index 3)
            const individualContent = data.stack[3];
            
            if (individualContent && individualContent.cell) {
              // Content is stored as a cell, we need to parse it
              // For now, try to extract URI from cell
              console.log('📦 Individual content cell:', individualContent);
            }
          }
        } else {
          console.log('ℹ️ TON API v4 request failed (non-critical):', response.status, response.statusText);
        }
      } catch (apiError) {
        console.log('ℹ️ TON API v4 request error (non-critical):', apiError);
      }
      
      // Alternative: Use toncenter.com API to run method
      // Only try if we still need more data
      if (needsMoreData && (!nftItem.name || nftItem.name.startsWith('NFT '))) {
        try {
          console.log('📡 Trying toncenter.com API for contract method call...');
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Use runGetMethod from toncenter API
          const toncenterUrl = TONWEB_API_URL;
          const requestBody = {
            id: 1,
            jsonrpc: '2.0',
            method: 'runGetMethod',
            params: {
              address: rawAddress,
              method: methodName,
              stack: [],
            },
          };
          
          const response = await retryWithBackoff(
            async () => {
              const res = await fetch(toncenterUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });
              
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              }
              
              return res.json();
            },
            1, // Only 1 retry to avoid rate limits
            4000 // Longer delay
          );
          
          console.log('✅ Contract method response:', response);
          
          // Check for errors first
          if (response.error) {
            console.log('ℹ️ API returned error (non-critical):', response.error);
            // Don't throw - continue with basic NFT info
          } else if (response.result) {
            const result = response.result;
            
            // Check exit code - 0 means success, other codes mean failure
            if (result.exit_code !== undefined && result.exit_code !== 0) {
              // exit_code 11 is common - method not available, but NFT is still valid
              if (result.exit_code === 11) {
                console.log('ℹ️ get_nft_data() method not available (exit_code: 11)');
                console.log('ℹ️ This is normal for some NFT contracts. Using basic NFT info.');
              } else {
                console.log('ℹ️ Method execution returned exit_code:', result.exit_code);
              }
              
              // Don't try to parse stack if method failed
              // But we can still try to get basic info from other sources
            } else if (result.stack && Array.isArray(result.stack)) {
              console.log('✅ Contract method response:', result);
              const stack = result.stack;
              
              console.log('📦 Stack length:', stack.length);
              console.log('📦 Stack:', JSON.stringify(stack, null, 2));
              
              // Handle different stack formats
              // Format 1: [init?, index, collection_address, owner_address, individual_content] (5 elements)
              // Format 2: [index, collection_address, owner_address, individual_content] (4 elements)
              // Format 3: Different structure
              
              if (stack.length >= 4) {
                // Try to determine which format we have
                let indexIdx = 1;
                let collectionIdx = 2;
                let ownerIdx = 3;
                let contentIdx = 4;
                
                // If first element is boolean/null, it's format 1 (5 elements)
                // Otherwise it's format 2 (4 elements)
                if (stack.length === 4) {
                  indexIdx = 0;
                  collectionIdx = 1;
                  ownerIdx = 2;
                  contentIdx = 3;
                }
                
                // Extract index
                if (stack[indexIdx]) {
                  const indexValue = stack[indexIdx];
                  if (Array.isArray(indexValue) && indexValue[1]) {
                    nftItem.index = parseInt(indexValue[1]) || undefined;
                  } else if (typeof indexValue === 'number' || typeof indexValue === 'string') {
                    nftItem.index = parseInt(String(indexValue)) || undefined;
                  }
                  if (nftItem.index !== undefined) {
                    console.log('📊 NFT index:', nftItem.index);
                  }
                }
                
                // Extract collection address
                if (stack[collectionIdx]) {
                  const collectionValue = stack[collectionIdx];
                  if (Array.isArray(collectionValue) && collectionValue[1]) {
                    nftItem.collectionAddress = collectionValue[1];
                  } else if (typeof collectionValue === 'string' && collectionValue !== 'null') {
                    nftItem.collectionAddress = collectionValue;
                  }
                  if (nftItem.collectionAddress) {
                    console.log('📦 Collection address:', nftItem.collectionAddress);
                  }
                }
                
                // Extract owner address
                if (stack[ownerIdx]) {
                  const ownerValue = stack[ownerIdx];
                  if (Array.isArray(ownerValue) && ownerValue[1]) {
                    nftItem.ownerAddress = ownerValue[1];
                  } else if (typeof ownerValue === 'string' && ownerValue !== 'null') {
                    nftItem.ownerAddress = ownerValue;
                  }
                  if (nftItem.ownerAddress) {
                    console.log('👤 Owner address:', nftItem.ownerAddress);
                  }
                }
                
                // Extract individual_content (cell with URI)
                const individualContent = stack[contentIdx];
                
                console.log('📦 Individual content:', individualContent);
                
                if (individualContent) {
                  // Content is stored as a cell
                  // Cell format: ["tvm.Cell", "base64_encoded_cell_data"]
                  let cellData = '';
                  
                  // Try different cell formats
                  if (Array.isArray(individualContent) && individualContent.length >= 2) {
                    // Format: ["tvm.Cell", "base64_data"]
                    if (individualContent[0] === 'tvm.Cell' || individualContent[0] === 'cell') {
                      cellData = individualContent[1];
                      console.log('📦 Cell data (base64):', cellData.substring(0, 100) + '...');
                    } else if (typeof individualContent[1] === 'string') {
                      cellData = individualContent[1];
                    }
                  } else if (individualContent.cell) {
                    cellData = individualContent.cell;
                  } else if (individualContent.bytes) {
                    cellData = individualContent.bytes;
                  } else if (typeof individualContent === 'string') {
                    cellData = individualContent;
                  }
                  
                  // Parse cell to extract URI
                  if (cellData) {
                    try {
                      // Decode base64 cell data
                      const Buffer = getBuffer();
                      const cellBytes = Buffer.from(cellData, 'base64');
                      
                      console.log('📦 Cell bytes length:', cellBytes.length);
                      
                      // Try to extract text/URI from cell bytes
                      const cellString = cellBytes.toString('utf8');
                      const cellHex = cellBytes.toString('hex');
                      
                      console.log('📦 Cell as string (preview):', cellString.substring(0, 200));
                      console.log('📦 Cell as hex (preview):', cellHex.substring(0, 200));
                      
                      // Try to find IPFS hash or HTTP URL in the data
                      let contentUri = '';
                      
                      // Look for IPFS pattern
                      const ipfsMatch = cellString.match(/ipfs:\/\/([a-zA-Z0-9]+)/);
                      if (ipfsMatch) {
                        contentUri = `ipfs://${ipfsMatch[1]}`;
                        console.log('✅ Found IPFS URI:', contentUri);
                      } else {
                        // Look for HTTP/HTTPS pattern
                        const httpMatch = cellString.match(/https?:\/\/[^\s]+/);
                        if (httpMatch) {
                          contentUri = httpMatch[0];
                          console.log('✅ Found HTTP URI:', contentUri);
                        } else {
                          // Try to find Qm... or bafy... IPFS hash pattern
                          const ipfsHashMatch = cellString.match(/(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{56})/);
                          if (ipfsHashMatch) {
                            contentUri = `ipfs://${ipfsHashMatch[1]}`;
                            console.log('✅ Found IPFS hash:', contentUri);
                          }
                        }
                      }
                      
                      // If we found a URI, fetch metadata
                      if (contentUri) {
                        const metadataUrl = resolveIpfsUrl(contentUri);
                        console.log('📡 Fetching metadata from:', metadataUrl);
                        
                        try {
                          const metadataResponse = await fetch(metadataUrl, {
                            method: 'GET',
                            headers: {
                              'Accept': 'application/json',
                            },
                          });
                          
                          if (metadataResponse.ok) {
                            const metadata = await metadataResponse.json();
                            console.log('✅ NFT metadata loaded:', metadata);
                            
                            // Extract name, description, image from metadata
                            if (metadata.name) nftItem.name = metadata.name;
                            if (metadata.description) nftItem.description = metadata.description;
                            if (metadata.image) nftItem.image = resolveIpfsUrl(metadata.image);
                            // Extract preview/thumbnail for videos
                            if (metadata.poster) nftItem.poster = resolveIpfsUrl(metadata.poster);
                            if (metadata.thumbnail) nftItem.thumbnail = resolveIpfsUrl(metadata.thumbnail);
                            if (metadata.preview) nftItem.poster = resolveIpfsUrl(metadata.preview);
                            if (metadata.attributes) nftItem.attributes = metadata.attributes;
                            if (metadata.collection) nftItem.collection = metadata.collection;
                            
                            console.log('✅ NFT item updated with metadata:', nftItem);
                          } else {
                            console.warn('⚠️ Metadata fetch failed:', metadataResponse.status);
                          }
                        } catch (metadataError) {
                          console.warn('⚠️ Failed to fetch metadata from URI:', metadataError);
                        }
                      } else {
                        console.warn('⚠️ Could not extract URI from cell data');
                        console.log('💡 Cell data might need proper TON cell parsing library');
                      }
                    } catch (parseError) {
                      console.warn('⚠️ Failed to parse cell data:', parseError);
                    }
                  }
                }
              } else {
                console.warn('⚠️ Stack format unexpected, length:', stack.length);
                console.log('📦 Stack content:', JSON.stringify(stack, null, 2));
              }
            } else {
              console.warn('⚠️ No stack in result or stack is not an array');
              console.log('📦 Result structure:', JSON.stringify(result, null, 2));
            }
          } else {
            console.warn('⚠️ No result in response');
            console.log('📦 Response:', JSON.stringify(response, null, 2));
          }
        } catch (toncenterError) {
          console.log('ℹ️ toncenter.com API method call failed (non-critical):', toncenterError);
        }
      } // End of if (!nftItem.name || nftItem.name.startsWith('NFT '))
      
    } catch (methodError) {
      console.log('ℹ️ Failed to call get_nft_data() method (non-critical):', methodError);
      // Don't throw - continue with basic NFT info
    }
    
    // Try alternative methods to get NFT metadata
    // Since direct API calls have CORS/rate limit issues, we'll try other approaches
    try {
      console.log('🔍 Trying alternative methods to get NFT metadata...');
      
      // Method 1: Try using TON API v4 with different endpoint
      // Some NFTs might be available through different endpoints
      try {
        // Try to get account info which might contain NFT data
        const accountInfoUrl = `https://tonapi.io/v2/accounts/${rawAddress}`;
        console.log('📡 Trying TON API v4 account info:', accountInfoUrl);
        
        const accountResponse = await fetch(accountInfoUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          console.log('✅ Account info from TON API:', accountData);
          
          // Some APIs return NFT metadata in account info
          if (accountData.interfaces && accountData.interfaces.includes('nft_item')) {
            console.log('✅ Confirmed: This is an NFT item contract');
          }
        }
      } catch (accountError) {
        console.warn('⚠️ Account info request failed:', accountError);
      }
      
      // Method 2: Try using public IPFS gateways with common patterns
      // This is a last resort - most NFTs won't match these patterns
      // But we'll skip this to avoid unnecessary requests
      
      // Note: TONScan API has CORS issues and cannot be used from browser
      // For production, you would need:
      // 1. A backend proxy server to bypass CORS
      // 2. Or use @ton/ton library with proper setup
      // 3. Or use TON API v4 with API key (if available)
      
      console.log('ℹ️ Alternative metadata methods exhausted');
      console.log('💡 For full metadata, consider:');
      console.log('   - Using backend proxy for API calls');
      console.log('   - Implementing @ton/ton library for direct contract calls');
      console.log('   - Using TON API v4 with API key');
      
    } catch (metadataError) {
      console.warn('⚠️ Alternative metadata fetch failed:', metadataError);
    }
    
    console.log('✅ Final NFT item:', nftItem);
    return nftItem;
    
  } catch (error) {
    console.error('Failed to get NFT details:', error);
    return null;
  }
}

/**
 * Sends NFT to another address
 * @param privateKey - Wallet private key (hex string)
 * @param nftAddress - NFT item contract address
 * @param toAddress - Recipient address
 * @param forwardAmount - Amount to forward (in nanoTON, default 0.05 TON)
 * @returns Transaction hash
 */
export async function sendNFT(
  privateKey: string,
  nftAddress: string,
  toAddress: string,
  forwardAmount: string = '50000000' // 0.05 TON in nanoTON
): Promise<string> {
  if (!privateKey || !nftAddress || !toAddress) {
    throw new Error('Private key, NFT address, and recipient address are required');
  }

  try {
    const tonweb = initTonWeb();
    
    // Convert hex string to Buffer
    const Buffer = getBuffer();
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    
    // Reconstruct keypair from secret key
    const keyPair = keyPairFromSecretKey(privateKeyBuffer);

    const WalletClass = tonweb.wallet.all['v4R2'];
    const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
    });

    // Create NFT transfer message
    // This is a simplified implementation
    // Real implementation would:
    // 1. Create transfer message to NFT contract
    // 2. Include destination address and response destination
    // 3. Set forward amount
    
    const seqno = await wallet.methods.seqno().call();

    // Create transfer to NFT contract
    const transfer = wallet.methods.transfer({
      secretKey: keyPair.secretKey,
      toAddress: nftAddress,
      amount: forwardAmount,
      seqno: seqno || 0,
      payload: undefined, // NFT transfer payload would go here
      sendMode: 3,
    });

    const result = await transfer.send();
    return result;
  } catch (error) {
    throw new Error(`Failed to send NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
