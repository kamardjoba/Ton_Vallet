/**
 * Authentication Modal component
 * Requests biometric authentication (Face ID / Touch ID) or password fallback
 */

import { useState, useEffect } from 'react';
import { checkBiometricAvailability, authenticateWithBiometrics, authenticateWithStoredBiometric } from '../utils/biometrics';
import { HapticFeedback } from '../utils/telegram';
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
      checkBiometric();
    } else {
      // Reset state when modal closes
      setShowPassword(false);
      setPassword('');
      setPasswordError(null);
      setIsAuthenticating(false);
    }
  }, [isOpen, walletAddress]);

  const checkBiometric = async () => {
    setIsCheckingBiometric(true);
    try {
      const available = await checkBiometricAvailability();
      setBiometricAvailable(available);
      
      if (available) {
        // Try to authenticate immediately with biometrics
        await attemptBiometricAuth();
      } else {
        // If biometrics not available, show password input
        setShowPassword(true);
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
      setShowPassword(true);
    } finally {
      setIsCheckingBiometric(false);
    }
  };

  const attemptBiometricAuth = async () => {
    setIsAuthenticating(true);
    setPasswordError(null);
    
    try {
      HapticFeedback.impact('light');
      
      // First try with stored credential
      let authenticated = false;
      if (walletAddress) {
        authenticated = await authenticateWithStoredBiometric(walletAddress);
      }
      
      // If stored credential doesn't work, try general biometric auth
      if (!authenticated) {
        authenticated = await authenticateWithBiometrics();
      }
      
      if (authenticated) {
        HapticFeedback.notification('success');
        onAuthenticated();
      } else {
        // Biometric auth failed or cancelled, show password fallback
        HapticFeedback.notification('error');
        setShowPassword(true);
      }
    } catch (error) {
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

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm Transaction</h2>
          <button className="modal-close" onClick={onCancel} disabled={isAuthenticating || isPasswordLoading}>
            ×
          </button>
        </div>

        <div className="auth-content">
          {isCheckingBiometric ? (
            <div className="auth-loading">
              <LoadingSpinner />
              <p>Checking authentication method...</p>
            </div>
          ) : biometricAvailable && !showPassword ? (
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
                    disabled={isPasswordLoading}
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
                  disabled={!password || isPasswordLoading}
                >
                  {isPasswordLoading ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </form>

              {biometricAvailable && (
                <button
                  className="auth-button biometric-button"
                  onClick={() => {
                    setShowPassword(false);
                    attemptBiometricAuth();
                  }}
                  disabled={isAuthenticating || isPasswordLoading}
                >
                  Try Biometric Instead
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          .auth-modal {
            max-width: 400px;
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
