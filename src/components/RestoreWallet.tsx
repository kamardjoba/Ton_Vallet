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
        <h2>Restore Wallet</h2>
        <p className="subtitle">Enter your seed phrase (24 words)</p>

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
              Words: {wordCount} / 24
            </div>
          </div>

          <div className="input-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (minimum 8 characters)"
              className="password-input"
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="password-input"
              disabled={isLoading}
              minLength={8}
              required
            />
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <div className="error-message">
              Passwords do not match
            </div>
          )}

          {wordCount > 0 && wordCount !== 24 && (
            <div className="error-message">
              Seed phrase must contain exactly 24 words
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
              Back
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
              {isLoading ? 'Restoring...' : 'Restore'}
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .restore-container {
          width: 100%;
          max-width: 500px;
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

        .restore-container h2 {
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .restore-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .restore-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .back-button:disabled,
        .restore-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .restore-wallet {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }

          .restore-container {
            background: #2a2a3e;
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

