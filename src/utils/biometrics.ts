/**
 * Biometric authentication utilities using Web Authentication API (WebAuthn)
 * Falls back to password if biometrics are not available
 */

/**
 * Checks if WebAuthn/biometric authentication is available
 */
export function isBiometricAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for WebAuthn support
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  // Check if platform authenticator (biometrics) is available
  if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false;
  }
  
  return true;
}

/**
 * Checks if biometric authentication is available and ready to use
 */
export async function checkBiometricAvailability(): Promise<boolean> {
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (error) {
    console.warn('Error checking biometric availability:', error);
    return false;
  }
}

/**
 * Authenticates user using biometrics (Face ID / Touch ID)
 * Returns true if authentication succeeds, false otherwise
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    // Check if platform authenticator is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      console.log('Platform authenticator (biometrics) not available');
      return false;
    }
    
    // Create a challenge for authentication
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Convert challenge to base64url
    const challengeBase64 = base64UrlEncode(challenge);
    
    // Create credential request
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60000, // 60 seconds timeout
    };
    
    // Request authentication
    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential | null;
    
    if (credential && credential.type === 'public-key') {
      console.log('✅ Biometric authentication successful');
      return true;
    }
    
    return false;
  } catch (error: any) {
    // User cancelled or authentication failed
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
      console.log('Biometric authentication cancelled or not supported');
      return false;
    }
    
    console.error('Biometric authentication error:', error);
    return false;
  }
}

/**
 * Creates a biometric credential for the wallet (one-time setup)
 * This should be called when wallet is first created or unlocked
 */
export async function createBiometricCredential(walletAddress: string): Promise<boolean> {
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return false;
    }
    
    // Create a user ID from wallet address
    const userId = new TextEncoder().encode(walletAddress);
    
    // Create a challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Create credential creation options
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: 'TON Wallet',
        id: window.location.hostname || 'localhost',
      },
      user: {
        id: userId,
        name: walletAddress,
        displayName: `Wallet ${walletAddress.slice(0, 8)}...`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use platform authenticator (biometrics)
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    };
    
    // Create credential
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential | null;
    
    if (credential && credential.type === 'public-key') {
      // Store credential ID for future authentication
      const credentialId = base64UrlEncode(new Uint8Array(credential.rawId));
      localStorage.setItem(`biometric_credential_${walletAddress}`, credentialId);
      console.log('✅ Biometric credential created successfully');
      return true;
    }
    
    return false;
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
      console.log('Biometric credential creation cancelled or not supported');
      return false;
    }
    
    console.error('Error creating biometric credential:', error);
    return false;
  }
}

/**
 * Authenticates using stored biometric credential
 */
export async function authenticateWithStoredBiometric(walletAddress: string): Promise<boolean> {
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    // Get stored credential ID
    const storedCredentialId = localStorage.getItem(`biometric_credential_${walletAddress}`);
    if (!storedCredentialId) {
      console.log('No stored biometric credential found');
      return false;
    }
    
    // Decode credential ID
    const credentialId = base64UrlDecode(storedCredentialId);
    
    // Create challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Create credential request
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      allowCredentials: [
        {
          id: credentialId,
          type: 'public-key',
          transports: ['internal'], // Platform authenticator
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };
    
    // Request authentication
    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential | null;
    
    if (credential && credential.type === 'public-key') {
      console.log('✅ Biometric authentication with stored credential successful');
      return true;
    }
    
    return false;
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
      console.log('Biometric authentication cancelled or not supported');
      return false;
    }
    
    console.error('Error authenticating with stored biometric:', error);
    return false;
  }
}

/**
 * Base64 URL encoding helper
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64 URL decoding helper
 */
function base64UrlDecode(base64: string): ArrayBuffer {
  const base64Normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64Normalized.length % 4)) % 4);
  const base64WithPadding = base64Normalized + padding;
  const binaryString = atob(base64WithPadding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Removes stored biometric credential
 */
export function removeBiometricCredential(walletAddress: string): void {
  localStorage.removeItem(`biometric_credential_${walletAddress}`);
}
