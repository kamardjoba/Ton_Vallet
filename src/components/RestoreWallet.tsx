/**
 * Restore Wallet component
 * Allows user to restore wallet from existing seed phrase
 */

import { useState } from 'react';
import useWalletStore from '../app/store';

interface RestoreWalletProps {
  onRestored: () => void;
  onBack: () => void;
}

export default function RestoreWallet({ onRestored, onBack }: RestoreWalletProps) {
  const { initializeWallet, error, clearError } = useWalletStore();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (password !== confirmPassword) {
      return;
    }
    if (password.length < 8) {
      return;
    }

    const words = seedPhrase.trim().split(/\s+/);
    if (words.length !== 24) {
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await initializeWallet(seedPhrase.trim(), password);
      setSeedPhrase('');
      setPassword('');
      setConfirmPassword('');
      onRestored();
    } catch (err) {
      console.error('Failed to restore wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const wordCount = seedPhrase.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="restore-wallet">
      <div className="restore-container">
        <h2>Восстановить кошелек</h2>
        <p className="subtitle">Введите вашу seed phrase (24 слова)</p>

        <form onSubmit={handleSubmit} className="restore-form" noValidate>
          <div className="input-group">
            <label>Seed Phrase</label>
            <textarea
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              placeholder="word1 word2 word3 ... word24"
              className="seed-textarea"
              disabled={isLoading}
              rows={4}
              required
            />
            <div className="word-count">
              Слов: {wordCount} / 24
            </div>
          </div>

          <div className="input-group">
            <label>Новый пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль (минимум 8 символов)"
              className="password-input"
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          <div className="input-group">
            <label>Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Подтвердите пароль"
              className="password-input"
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <div className="error-message">
              Пароли не совпадают
            </div>
          )}

          {wordCount > 0 && wordCount !== 24 && (
            <div className="error-message">
              Seed phrase должен содержать ровно 24 слова
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onBack}
              className="back-button"
              disabled={isLoading}
            >
              Назад
            </button>
            <button
              type="submit"
              className="restore-button"
              disabled={
                !seedPhrase ||
                !password ||
                !confirmPassword ||
                password !== confirmPassword ||
                password.length < 8 ||
                wordCount !== 24 ||
                isLoading
              }
            >
              {isLoading ? 'Восстановление...' : 'Восстановить'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .restore-wallet {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: #f5f5f5;
        }

        .restore-container {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .restore-container h2 {
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

        .restore-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
        }

        .input-group label {
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .seed-textarea {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          font-family: 'Courier New', monospace;
          resize: vertical;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .seed-textarea:focus {
          outline: none;
          border-color: #0088cc;
        }

        .seed-textarea:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .word-count {
          margin-top: 4px;
          font-size: 12px;
          color: #666;
        }

        .password-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
          box-sizing: border-box;
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

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .back-button,
        .restore-button {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button {
          background: #f5f5f5;
          color: #333;
        }

        .back-button:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .restore-button {
          background: #0088cc;
          color: white;
        }

        .restore-button:hover:not(:disabled) {
          background: #0066aa;
        }

        .back-button:disabled,
        .restore-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .restore-wallet {
            background: #1a1a1a;
          }

          .restore-container {
            background: #2a2a2a;
          }

          .restore-container h2 {
            color: #e0e0e0;
          }

          .subtitle {
            color: #999;
          }

          .input-group label {
            color: #e0e0e0;
          }

          .seed-textarea,
          .password-input {
            background: #333;
            border-color: #444;
            color: #e0e0e0;
          }

          .word-count {
            color: #999;
          }

          .back-button {
            background: #444;
            color: #e0e0e0;
          }
        }
      `}</style>
    </div>
  );
}

