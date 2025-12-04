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
        <h2>Разблокировать кошелек</h2>
        <p className="subtitle">Введите пароль для доступа к кошельку</p>

        <form onSubmit={handleSubmit} className="unlock-form">
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
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
            {isLoading ? 'Разблокировка...' : 'Разблокировать'}
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
          background: #f5f5f5;
        }

        .unlock-container {
          width: 100%;
          max-width: 400px;
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .unlock-container h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: #333;
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
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .password-input:focus {
          outline: none;
          border-color: #0088cc;
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
          padding: 14px;
          background: #0088cc;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .unlock-button:hover:not(:disabled) {
          background: #0066aa;
        }

        .unlock-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .unlock-wallet {
            background: #1a1a1a;
          }

          .unlock-container {
            background: #2a2a2a;
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

