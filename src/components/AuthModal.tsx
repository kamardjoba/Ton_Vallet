/**
 * Authentication Modal component
 * Requests biometric authentication (Face ID / Touch ID) or password fallback
 */

import { useState, useEffect } from 'react';
import { checkBiometricAvailability, authenticateWithBiometrics, authenticateWithStoredBiometric } from '../utils/biometrics';
import { HapticFeedback } from '../utils/telegram';
import { showDebugInfo, logError, getEnvironmentInfo } from '../utils/debug';
import LoadingSpinner from './LoadingSpinner';

interface AuthModalProps {
  isOpen: boolean;
  walletAddress: string;
  onAuthenticated: () => void;
  onPasswordAuth: (password: string) => Promise<void>;
  onCancel: () => void;
}

export default function AuthModal({ 
  isOpen, 
  walletAddress, 
  onAuthenticated, 
  onPasswordAuth,
  onCancel 
}: AuthModalProps) {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Always show password input first, then check biometric in background
      setShowPassword(true);
      setIsCheckingBiometric(false);
      
      // Log environment info for debugging
      const envInfo = getEnvironmentInfo();
      console.log('AuthModal opened, environment:', envInfo);
      
      checkBiometricBackground();
    } else {
      // Reset state when modal closes
      setShowPassword(false);
      setPassword('');
      setPasswordError(null);
      setIsAuthenticating(false);
    }
  }, [isOpen, walletAddress]);

  const checkBiometricBackground = async () => {
    // Check biometric availability in background (non-blocking)
    try {
      const available = await Promise.race([
        checkBiometricAvailability(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)) // 2 second timeout
      ]);
      setBiometricAvailable(available);
      console.log('Biometric available:', available);
      
      // Also check if we're in Telegram Mini App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        console.log('Telegram WebApp platform:', tg.platform);
        // On mobile Telegram, always show biometric option
        if (tg.platform === 'ios' || tg.platform === 'android') {
          setBiometricAvailable(true);
          console.log('Force enabling biometric for Telegram mobile');
        }
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      // In Telegram Mini App on mobile, assume biometrics are available
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        if (tg.platform === 'ios' || tg.platform === 'android') {
          setBiometricAvailable(true);
          console.log('Assuming biometric available in Telegram mobile');
        } else {
          setBiometricAvailable(false);
        }
      } else {
        setBiometricAvailable(false);
      }
    }
  };

  const attemptBiometricAuth = async () => {
    setIsAuthenticating(true);
    setPasswordError(null);
    
    try {
      HapticFeedback.impact('light');
      
      // Direct biometric authentication - this should trigger Face ID/Touch ID immediately
      // No debug messages, no intermediate steps - just call WebAuthn directly
      let authenticated = false;
      
      // Try general biometric auth first (most reliable)
      try {
        authenticated = await Promise.race([
          authenticateWithBiometrics(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 60000))
        ]);
      } catch (e: any) {
        console.log('Biometric auth error:', e.name);
        // If it fails, try stored credential as fallback
        if (walletAddress && !authenticated) {
          try {
            authenticated = await Promise.race([
              authenticateWithStoredBiometric(walletAddress),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000))
            ]);
          } catch (e2: any) {
            console.log('Stored biometric also failed:', e2.name);
          }
        }
      }
      
      if (authenticated) {
        HapticFeedback.notification('success');
        onAuthenticated();
      } else {
        // Biometric auth failed or timed out, show password fallback
        HapticFeedback.notification('error');
        setShowPassword(true);
      }
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      HapticFeedback.notification('error');
      setShowPassword(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    
    setIsPasswordLoading(true);
    setPasswordError(null);
    HapticFeedback.impact('light');
    
    try {
      await onPasswordAuth(password);
      HapticFeedback.notification('success');
      setPassword('');
      onAuthenticated();
    } catch (error: any) {
      HapticFeedback.notification('error');
      setPasswordError(error?.message || 'Invalid password. Please try again.');
      setPassword('');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleUsePassword = () => {
    setShowPassword(true);
    setIsAuthenticating(false);
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  console.log('AuthModal render:', { isOpen, showPassword, biometricAvailable, isAuthenticating });

  return (
    <div className="modal-overlay auth-modal-overlay" onClick={onCancel} style={{ zIndex: 2000 }}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm Transaction</h2>
          <button className="modal-close" onClick={onCancel} disabled={isAuthenticating || isPasswordLoading}>
            ×
          </button>
        </div>

        <div className="auth-content">
          {biometricAvailable && !showPassword && !isAuthenticating ? (
            <div className="biometric-auth">
              <div className="biometric-icon">
                {navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? (
                  <span style={{ fontSize: '64px' }}>👤</span>
                ) : (
                  <span style={{ fontSize: '64px' }}>👆</span>
                )}
              </div>
              <h3>Authenticate to Send</h3>
              <p>Use Face ID, Touch ID, or your device's biometric authentication</p>
              
              {isAuthenticating ? (
                <div className="auth-loading">
                  <LoadingSpinner />
                  <p>Waiting for authentication...</p>
                </div>
              ) : (
                <>
                  <button
                    className="auth-button biometric-button"
                    onClick={attemptBiometricAuth}
                    disabled={isAuthenticating}
                  >
                    Authenticate
                  </button>
                  <button
                    className="auth-button password-button"
                    onClick={handleUsePassword}
                    disabled={isAuthenticating}
                  >
                    Use Password Instead
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="password-auth">
              <div className="password-icon">
                <span style={{ fontSize: '48px' }}>🔒</span>
              </div>
              <h3>Enter Password</h3>
              <p>Enter your wallet password to confirm the transaction</p>
              
              <form onSubmit={handlePasswordSubmit} className="password-form">
                <div className="input-group">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Password"
                    className="password-input"
                    disabled={isPasswordLoading || isAuthenticating}
                    autoFocus
                  />
                </div>

                {passwordError && (
                  <div className="error-message">
                    {passwordError}
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-button submit-button"
                  disabled={!password || isPasswordLoading || isAuthenticating}
                >
                  {isPasswordLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Confirm Transaction'
                  )}
                </button>
              </form>

              {/* Always show biometric button on mobile Telegram, or if available */}
              {((biometricAvailable || (typeof window !== 'undefined' && window.Telegram?.WebApp?.platform === 'ios') || (typeof window !== 'undefined' && window.Telegram?.WebApp?.platform === 'android')) && !isAuthenticating) && (
                <button
                  className="auth-button biometric-button"
                  onClick={() => {
                    setShowPassword(false);
                    attemptBiometricAuth();
                  }}
                  disabled={isPasswordLoading}
                  style={{ marginTop: '12px' }}
                >
                  {typeof window !== 'undefined' && window.Telegram?.WebApp?.platform === 'ios' 
                    ? 'Use Face ID' 
                    : typeof window !== 'undefined' && window.Telegram?.WebApp?.platform === 'android'
                    ? 'Use Fingerprint / Face Unlock'
                    : 'Use Face ID / Touch ID Instead'}
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          .auth-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 20px;
          }

          .auth-modal {
            max-width: 400px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease-out;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .auth-content {
            padding: 20px;
            text-align: center;
          }

          .auth-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            padding: 20px;
          }

          .auth-loading p {
            color: var(--text-secondary, #666);
            font-size: 14px;
          }

          .biometric-auth,
          .password-auth {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }

          .biometric-icon,
          .password-icon {
            margin-bottom: 10px;
          }

          .biometric-auth h3,
          .password-auth h3 {
            margin: 0;
            font-size: 20px;
            color: var(--text-primary, #000);
          }

          .biometric-auth p,
          .password-auth p {
            margin: 0;
            color: var(--text-secondary, #666);
            font-size: 14px;
            line-height: 1.5;
          }

          .password-form {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .auth-button {
            width: 100%;
            padding: 14px 24px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .biometric-button {
            background: var(--tg-theme-button-color, #3390ec);
            color: var(--tg-theme-button-text-color, #fff);
          }

          .biometric-button:hover:not(:disabled) {
            opacity: 0.9;
          }

          .biometric-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .password-button {
            background: transparent;
            color: var(--tg-theme-text-color, #000);
            border: 1px solid var(--tg-theme-hint-color, #999);
          }

          .password-button:hover:not(:disabled) {
            background: var(--tg-theme-secondary-bg-color, #f0f0f0);
          }

          .submit-button {
            background: var(--tg-theme-button-color, #3390ec);
            color: var(--tg-theme-button-text-color, #fff);
          }

          .submit-button:hover:not(:disabled) {
            opacity: 0.9;
          }

          .submit-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .error-message {
            color: #ff3333;
            font-size: 14px;
            text-align: center;
            padding: 8px;
            background: rgba(255, 51, 51, 0.1);
            border-radius: 8px;
          }
        `}</style>
      </div>
    </div>
  );
}
