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
  console.log('Starting biometric authentication...');
  
  // Check if we're in Telegram Mini App
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    console.log('Telegram WebApp detected, platform:', tg.platform);
    
    if (tg.platform === 'ios' || tg.platform === 'android') {
      console.log('Mobile platform detected, attempting WebAuthn...');
      // In Telegram Mini App, WebAuthn should work and trigger device biometrics
      try {
        const result = await authenticateWithWebAuthn();
        console.log('WebAuthn result:', result);
        return result;
      } catch (error) {
        console.error('WebAuthn error in Telegram:', error);
        return false;
      }
    }
  }
  
  // Regular WebAuthn for non-Telegram browsers
  console.log('Attempting WebAuthn in regular browser...');
  return await authenticateWithWebAuthn();
}

/**
 * Internal function to authenticate with WebAuthn
 * Uses conditional UI for better UX in Telegram Mini App
 */
async function authenticateWithWebAuthn(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // Check if WebAuthn is available
  if (!window.PublicKeyCredential) {
    console.log('WebAuthn not available');
    return false;
  }
  
  try {
    // Check if platform authenticator is available
    let available = false;
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        available = await Promise.race([
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
        ]);
      } catch (e) {
        console.warn('Error checking platform authenticator:', e);
        // In Telegram Mini App, assume it's available on mobile
        if (window.Telegram?.WebApp?.platform === 'ios' || window.Telegram?.WebApp?.platform === 'android') {
          available = true;
          console.log('Assuming biometric available in Telegram mobile');
        }
      }
    }
    
    if (!available && !(window.Telegram?.WebApp?.platform === 'ios' || window.Telegram?.WebApp?.platform === 'android')) {
      console.log('Platform authenticator (biometrics) not available');
      return false;
    }
    
    // Create a challenge for authentication
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Get current origin for rpId
    const rpId = window.location.hostname || 'localhost';
    
    // For Telegram Mini App, we need to use a simpler approach
    // Try creating a credential first (this will trigger Face ID immediately)
    // If that fails, fall back to get()
    let credential: PublicKeyCredential | null = null;
    
    if (window.Telegram?.WebApp?.platform === 'ios' || window.Telegram?.WebApp?.platform === 'android') {
      console.log('Mobile Telegram detected, trying credential creation first...');
      
      try {
        // Try to create a credential - this will immediately trigger Face ID
        const createChallenge = new Uint8Array(32);
        crypto.getRandomValues(createChallenge);
        
        const userId = new TextEncoder().encode('ton_wallet_user_' + Date.now());
        const createOptions: PublicKeyCredentialCreationOptions = {
          challenge: createChallenge,
          rp: {
            name: 'TON Wallet',
            id: rpId,
          },
          user: {
            id: userId,
            name: 'TON Wallet User',
            displayName: 'TON Wallet',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        };
        
        credential = await navigator.credentials.create({
          publicKey: createOptions,
        }) as PublicKeyCredential | null;
        
        if (credential && credential.type === 'public-key') {
          console.log('✅ Biometric authentication successful via credential creation');
          return true;
        }
      } catch (createError: any) {
        console.log('Credential creation failed, trying get() method:', createError.name);
        // Fall through to get() method
      }
    }
    
    // If creation didn't work or we're not on mobile Telegram, try get()
    if (!credential) {
      // Create credential request with proper options
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challenge,
        allowCredentials: [], // Empty array - browser will show available credentials
        userVerification: 'required', // This is key - requires biometric
        rpId: rpId,
        timeout: 60000,
      };
    
      console.log('Requesting WebAuthn authentication with options:', {
        rpId,
        userVerification: 'required',
        hasChallenge: !!challenge,
        allowCredentialsLength: publicKeyCredentialRequestOptions.allowCredentials?.length || 0,
      });
      
      // Request authentication
      // Use AbortController for better timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      try {
        credential = await navigator.credentials.get({
          publicKey: publicKeyCredentialRequestOptions,
          signal: controller.signal,
        }) as PublicKeyCredential | null;
        
        clearTimeout(timeoutId);
        
        if (credential && credential.type === 'public-key') {
          console.log('✅ Biometric authentication successful via get()');
          return true;
        }
        
        console.log('No credential returned');
        return false;
      } catch (getError: any) {
        clearTimeout(timeoutId);
        throw getError;
      }
    }
  } catch (error: any) {
    // User cancelled or authentication failed
    if (error.name === 'NotAllowedError') {
      console.log('User cancelled biometric authentication or permission denied');
      return false;
    }
    if (error.name === 'NotSupportedError') {
      console.log('Biometric authentication not supported');
      return false;
    }
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.log('Biometric authentication timed out');
      return false;
    }
    if (error.name === 'SecurityError') {
      console.log('Security error - possibly HTTPS/domain issue:', error.message);
      return false;
    }
    
    console.error('Biometric authentication error:', error.name, error.message);
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
