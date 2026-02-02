/**
 * Biometric authentication utilities using Web Authentication API (WebAuthn)
 * Falls back to password if biometrics are not available
 */

/**
 * Checks if WebAuthn/biometric authentication is available
 * Also checks Telegram WebApp API for biometric support
 */
export function isBiometricAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check Telegram WebApp API first (for Telegram Mini Apps)
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    // Telegram WebApp may support biometrics on mobile devices
    // We'll assume it's available on mobile devices in Telegram
    if (tg.platform === 'ios' || tg.platform === 'android') {
      console.log('Telegram WebApp detected on mobile platform:', tg.platform);
      return true; // Assume biometrics available on mobile Telegram
    }
  }
  
  // Check for WebAuthn support (for regular browsers)
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
  // Check Telegram WebApp first
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    // On mobile Telegram, assume biometrics are available
    if (tg.platform === 'ios' || tg.platform === 'android') {
      console.log('Biometric available via Telegram WebApp on', tg.platform);
      return true;
    }
  }
  
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    // For WebAuthn, check if platform authenticator is available
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await Promise.race([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
      ]);
      return available;
    }
    return false;
  } catch (error) {
    console.warn('Error checking biometric availability:', error);
    return false;
  }
}

/**
 * Authenticates user using biometrics (Face ID / Touch ID)
 * Returns true if authentication succeeds, false otherwise
 * Works with both Telegram WebApp and WebAuthn
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  // Try Telegram WebApp API first (for Telegram Mini Apps)
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    if (tg.platform === 'ios' || tg.platform === 'android') {
      console.log('Attempting biometric auth via Telegram WebApp...');
      // In Telegram Mini App, we can try WebAuthn which should trigger device biometrics
      // Telegram's WebView should support WebAuthn on mobile devices
      try {
        return await authenticateWithWebAuthn();
      } catch (error) {
        console.warn('WebAuthn failed in Telegram, trying alternative:', error);
        // Fallback: return false to show password
        return false;
      }
    }
  }
  
  // Regular WebAuthn for non-Telegram browsers
  return await authenticateWithWebAuthn();
}

/**
 * Internal function to authenticate with WebAuthn
 */
async function authenticateWithWebAuthn(): Promise<boolean> {
  if (!isBiometricAvailable()) {
    return false;
  }
  
  try {
    // Check if platform authenticator is available
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available = await Promise.race([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
      ]);
      
      if (!available) {
        console.log('Platform authenticator (biometrics) not available');
        return false;
      }
    }
    
    // Create a challenge for authentication
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Create credential request
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      allowCredentials: [],
      userVerification: 'required',
      timeout: 30000, // 30 seconds timeout (reduced for faster response)
    };
    
    // Request authentication with timeout
    const credential = await Promise.race([
      navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as Promise<PublicKeyCredential | null>,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000))
    ]);
    
    if (credential && credential.type === 'public-key') {
      console.log('✅ Biometric authentication successful');
      return true;
    }
    
    return false;
  } catch (error: any) {
    // User cancelled or authentication failed
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError' || error.name === 'AbortError') {
      console.log('Biometric authentication cancelled or not supported:', error.name);
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
