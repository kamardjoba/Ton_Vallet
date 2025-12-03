/**
 * TON Blockchain integration module
 * Provides functions for interacting with TON blockchain using TonWeb
 */

import TonWeb from 'tonweb';
import { mnemonicToSeed } from '@ton/crypto';

const TONWEB_API_URL = 'https://toncenter.com/api/v2';

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
export function initTonWeb(): TonWeb {
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
    const seed = await mnemonicToSeed(words);
    const keyPair = TonWeb.utils.keyPairFromSeed(seed);

    const tonweb = initTonWeb();
    const WalletClass = tonweb.wallet.all['v4R2'];
    const wallet = new WalletClass(tonweb.provider, {
      publicKey: keyPair.publicKey,
    });

    const address = await wallet.getAddress();
    const addressString = address.toString(true, true, true);

    return {
      address: addressString,
      publicKey: TonWeb.utils.bytesToHex(keyPair.publicKey),
      privateKey: TonWeb.utils.bytesToHex(keyPair.secretKey),
    };
  } catch (error) {
    throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
    const balance = await tonweb.provider.getBalance(address);
    return balance.toString();
  } catch (error) {
    throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts nanoTON to TON
 */
export function nanoToTon(nano: string): string {
  const nanoBigInt = BigInt(nano);
  const ton = Number(nanoBigInt) / 1e9;
  return ton.toFixed(9).replace(/\.?0+$/, '');
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
    const keyPair = TonWeb.utils.keyPairFromSeed(
      TonWeb.utils.hexToBytes(privateKey)
    );

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
      payload: comment ? TonWeb.utils.stringToBytes(comment) : undefined,
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
    const transactions = await tonweb.provider.getTransactions(address, limit);

    return transactions.map((tx: TonWeb.utils.Transaction) => ({
      hash: tx.transaction_id.hash,
      from: tx.in_msg?.source_address || '',
      to: tx.out_msgs?.[0]?.destination_address || address,
      value: tx.in_msg?.value || '0',
      timestamp: tx.utime * 1000, // Convert to milliseconds
      status: 'success' as const,
    }));
  } catch (error) {
    throw new Error(`Failed to get transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

