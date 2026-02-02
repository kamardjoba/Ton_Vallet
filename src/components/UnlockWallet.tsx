/**
 * Unlock Wallet component
 * Shows password input form to unlock the wallet
 */

import { useState } from 'react';
import useWalletStore from '../app/store';

interface UnlockWalletProps {
  onUnlock: () => void;
}

export default function UnlockWallet({ onUnlock }: UnlockWalletProps) {
  const { unlockWallet, error, clearError } = useWalletStore();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    clearError();

    try {
      await unlockWallet(password);
      setPassword('');
      onUnlock();
    } catch (err) {
      // Error is handled by store
      console.error('Failed to unlock wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="unlock-wallet">
      <div className="unlock-container">
        <h2>Unlock Wallet</h2>
        <p className="subtitle">Enter your password to access your wallet</p>

        <form onSubmit={handleSubmit} className="unlock-form">
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="password-input"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="unlock-button"
            disabled={!password || isLoading}
          >
            {isLoading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>

      <style>{`
        .unlock-wallet {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .unlock-container {
          width: 100%;
          max-width: 400px;
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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

        .unlock-container h2 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          margin: 0 0 24px 0;
          color: #666;
          font-size: 14px;
        }

        .unlock-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
        }

        .password-input {
          width: 100%;
          padding: 14px 18px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s;
          background: #fafafa;
        }

        .password-input:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .password-input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          color: #c62828;
          border-radius: 8px;
          font-size: 14px;
        }

        .unlock-button {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .unlock-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .unlock-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .unlock-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .unlock-wallet {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }

          .unlock-container {
            background: #2a2a3e;
          }

          .unlock-container h2 {
            color: #e0e0e0;
          }

          .subtitle {
            color: #999;
          }

          .password-input {
            background: #333;
            border-color: #444;
            color: #e0e0e0;
          }

          .password-input:focus {
            border-color: #0088cc;
          }
        }
      `}</style>
    </div>
  );
}

