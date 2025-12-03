/**
 * Crypto module for TON Wallet
 * Provides AES-GCM encryption/decryption for seed phrases
 * Uses WebCrypto API for secure key derivation and encryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000; // PBKDF2 iterations

export interface EncryptedData {
  encrypted: string; // base64 encoded ciphertext
  iv: string; // base64 encoded initialization vector
  salt: string; // base64 encoded salt
}

/**
 * Derives a cryptographic key from a password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: ArrayBuffer,
  keyUsage: KeyUsage[]
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    keyUsage
  );
}

/**
 * Generates a random salt for key derivation
 */
function generateSalt(): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
}

/**
 * Generates a random IV for AES-GCM
 */
function generateIV(): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(IV_LENGTH)));
}

/**
 * Encrypts a seed phrase using AES-GCM
 * @param seedPhrase - The seed phrase to encrypt (space-separated words)
 * @param password - User password for encryption
 * @returns Encrypted data with IV and salt
 */
export async function encryptSeedPhrase(
  seedPhrase: string,
  password: string
): Promise<EncryptedData> {
  if (!seedPhrase || !password) {
    throw new Error('Seed phrase and password are required');
  }

  const salt = generateSalt();
  const iv = generateIV();
  const encoder = new TextEncoder();

  const saltBuffer = salt.buffer as ArrayBuffer;
  const ivBuffer = iv.buffer as ArrayBuffer;

  const key = await deriveKey(password, saltBuffer, ['encrypt']);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: ivBuffer,
    },
    key,
    encoder.encode(seedPhrase)
  );

  return {
    encrypted: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(ivBuffer),
    salt: arrayBufferToBase64(saltBuffer),
  };
}

/**
 * Decrypts an encrypted seed phrase
 * @param encryptedData - The encrypted data structure
 * @param password - User password for decryption
 * @returns Decrypted seed phrase
 */
export async function decryptSeedPhrase(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  if (!encryptedData || !password) {
    throw new Error('Encrypted data and password are required');
  }

  try {
    const saltBuffer = base64ToArrayBuffer(encryptedData.salt) as ArrayBuffer;
    const ivBuffer = base64ToArrayBuffer(encryptedData.iv) as ArrayBuffer;
    const encrypted = base64ToArrayBuffer(encryptedData.encrypted) as ArrayBuffer;

    const key = await deriveKey(password, saltBuffer, ['decrypt']);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: ivBuffer,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    throw new Error('Failed to decrypt seed phrase. Invalid password or corrupted data.');
  }
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates random bytes using WebCrypto API
 * @param length - Number of bytes to generate
 * @returns Uint8Array of random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint8Array(length)));
}

