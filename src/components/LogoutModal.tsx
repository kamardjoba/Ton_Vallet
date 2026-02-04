/**
 * Logout Modal
 * Confirms wallet logout with password verification
 */

import { useState } from 'react';
import { HapticFeedback } from '../utils/telegram';
import LoadingSpinner from './LoadingSpinner';
import useWalletStore from '../app/store';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function LogoutModal({ isOpen, onClose, onLogout }: LogoutModalProps) {
  const { checkPassword, reset } = useWalletStore();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    
    setIsLoading(true);
    setPasswordError(null);
    HapticFeedback.impact('light');
    
    try {
      // Verify password
      const isValid = await checkPassword(password);
      
      if (isValid) {
        HapticFeedback.notification('success');
        // Reset wallet completely (full logout)
        // This will clear all wallet data and show the initialization screen
        reset();
        // Clear password
        setPassword('');
        // Call logout callback
        onLogout();
      } else {
        HapticFeedback.notification('error');
        setPasswordError('Invalid password. Please try again.');
        setPassword('');
      }
    } catch (error: any) {
      HapticFeedback.notification('error');
      setPasswordError(error?.message || 'Failed to verify password. Please try again.');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPassword('');
      setPasswordError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={handleClose}>
      <div className="logout-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-header">
          <h2>Logout from Wallet</h2>
          <button className="logout-modal-close" onClick={handleClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className="logout-modal-body">
          <div className="logout-icon">
            <span style={{ fontSize: '64px' }}>🔒</span>
          </div>
          <h3>Confirm Logout</h3>
          <p>Are you sure you want to logout from your wallet?</p>
          <p className="logout-warning">
            You will need to enter your password to unlock the wallet again.
          </p>

          <form onSubmit={handleSubmit} className="logout-form">
            <div className="input-group">
              <label>Enter Password to Confirm</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                placeholder="Password"
                className="password-input"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {passwordError && (
              <div className="error-message">
                {passwordError}
              </div>
            )}

            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-button cancel-button"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="logout-button confirm-button"
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="small" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </form>
        </div>

        <style>{`
          .logout-modal-overlay {
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

          .logout-modal-content {
            background: var(--tg-theme-bg-color, white);
            border-radius: 20px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease-out;
            color: var(--tg-theme-text-color, #333);
          }

          .logout-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--tg-theme-secondary-bg-color, #e0e0e0);
          }

          .logout-modal-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--tg-theme-text-color, #333);
          }

          .logout-modal-close {
            background: none;
            border: none;
            font-size: 32px;
            color: var(--tg-theme-hint-color, #666);
            cursor: pointer;
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: background 0.2s;
          }

          .logout-modal-close:hover:not(:disabled) {
            background: var(--tg-theme-secondary-bg-color, #f0f0f0);
          }

          .logout-modal-close:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .logout-modal-body {
            padding: 24px;
            text-align: center;
          }

          .logout-icon {
            margin-bottom: 20px;
          }

          .logout-modal-body h3 {
            margin: 0 0 12px 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--tg-theme-text-color, #333);
          }

          .logout-modal-body p {
            margin: 8px 0;
            font-size: 14px;
            color: var(--tg-theme-hint-color, #666);
            line-height: 1.5;
          }

          .logout-warning {
            color: var(--tg-theme-destructive-text-color, #c62828) !important;
            font-weight: 500;
            margin-top: 16px !important;
          }

          .logout-form {
            margin-top: 24px;
          }

          .input-group {
            margin-bottom: 16px;
            text-align: left;
          }

          .input-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: var(--tg-theme-text-color, #333);
          }

          .password-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--tg-theme-secondary-bg-color, #e0e0e0);
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
            box-sizing: border-box;
            background: var(--tg-theme-bg-color, white);
            color: var(--tg-theme-text-color, #333);
          }

          .password-input:focus {
            outline: none;
            border-color: var(--tg-theme-link-color, #0088cc);
          }

          .password-input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .error-message {
            padding: 12px;
            background: var(--tg-theme-destructive-text-color, #ffebee);
            color: var(--tg-theme-text-color, #c62828);
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 16px;
            text-align: left;
          }

          .logout-modal-actions {
            display: flex;
            gap: 12px;
            margin-top: 20px;
          }

          .logout-button {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .logout-button.cancel-button {
            background: var(--tg-theme-secondary-bg-color, #f0f0f0);
            color: var(--tg-theme-text-color, #333);
          }

          .logout-button.confirm-button {
            background: var(--tg-theme-destructive-text-color, #c62828);
            color: white;
          }

          .logout-button:hover:not(:disabled) {
            opacity: 0.9;
          }

          .logout-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
