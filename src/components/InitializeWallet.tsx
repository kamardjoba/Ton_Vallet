/**
 * Initialize Wallet component
 * Shows form to create new wallet with seed phrase generation
 */

import { useState } from 'react';
import useWalletStore from '../app/store';
import * as TonCrypto from '@ton/crypto';
const { mnemonicNew } = TonCrypto;

interface InitializeWalletProps {
  onInitialized: () => void;
}

export default function InitializeWallet({ onInitialized }: InitializeWalletProps) {
  const { initializeWallet, error, clearError } = useWalletStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'password' | 'seed' | 'confirm'>('password');
  const [copied, setCopied] = useState(false);

  const generateSeedPhrase = async () => {
    try {
      const words = await mnemonicNew(24);
      setSeedPhrase(words);
      setStep('seed');
    } catch (err) {
      console.error('Failed to generate seed phrase:', err);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (password !== confirmPassword) {
      return;
    }
    if (password.length < 8) {
      return;
    }
    
    // Prevent form submission from causing page reload
    await generateSeedPhrase();
  };

  const handleCopySeedPhrase = async () => {
    if (seedPhrase.length === 0) return;
    
    try {
      await navigator.clipboard.writeText(seedPhrase.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy seed phrase:', err);
    }
  };

  const handleSeedConfirm = () => {
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    if (!seedPhrase.length) return;

    setIsLoading(true);
    clearError();

    try {
      await initializeWallet(seedPhrase.join(' '), password);
      setPassword('');
      setConfirmPassword('');
      setSeedPhrase([]);
      onInitialized();
    } catch (err) {
      console.error('Failed to initialize wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'password') {
    return (
      <div className="initialize-wallet">
        <div className="init-container">
          <h2>Create Wallet</h2>
          <p className="subtitle">Create a password to protect your wallet</p>

          <form onSubmit={handlePasswordSubmit} className="init-form" noValidate>
            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (minimum 8 characters, any characters allowed)"
                className="password-input"
                disabled={isLoading}
                minLength={8}
                autoFocus
              />
              <div className="password-hint">
                Use at least 8 characters. Letters, numbers, and symbols are allowed.
              </div>
            </div>

            <div className="input-group">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="password-input"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <div className="error-message">
                Passwords do not match
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="init-button"
              disabled={!password || !confirmPassword || password !== confirmPassword || password.length < 8 || isLoading}
            >
              Continue
            </button>
          </form>
        </div>

        <style>{`
          .initialize-wallet {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .init-container {
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

          .init-container h2 {
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
            margin: 0 0 32px 0;
            color: #666;
            font-size: 15px;
            line-height: 1.5;
          }

          .init-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
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

          .password-hint {
            margin-top: 4px;
            font-size: 12px;
            color: #666;
          }

          .error-message {
            padding: 12px 16px;
            background: #fee;
            color: #c62828;
            border-radius: 10px;
            font-size: 14px;
            border-left: 4px solid #c62828;
          }

          .init-button {
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

          .init-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
          }

          .init-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .init-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            box-shadow: none;
          }

          @media (prefers-color-scheme: dark) {
            .initialize-wallet {
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }

            .init-container {
              background: #2a2a3e;
            }

            .init-container h2 {
              color: #e0e0e0;
            }

            .subtitle {
              color: #aaa;
            }

            .password-input {
              background: #333;
              border-color: #444;
              color: #e0e0e0;
            }

            .password-input:focus {
              background: #3a3a4e;
            }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'seed') {
    return (
      <div className="initialize-wallet">
        <div className="init-container">
          <h2>Seed Phrase</h2>
          <p className="subtitle">Save these 24 words in a safe place. You'll need them to restore your wallet.</p>

          <div className="seed-phrase-grid">
            {seedPhrase.map((word, index) => (
              <div key={index} className="seed-word">
                <span className="seed-number">{index + 1}</span>
                <span className="seed-text">{word}</span>
              </div>
            ))}
          </div>

          <div className="seed-actions">
            <button
              type="button"
              onClick={handleCopySeedPhrase}
              className="copy-seed-button"
            >
              {copied ? '✓ Copied' : '📋 Copy Seed Phrase'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSeedConfirm}
            className="init-button"
          >
            I've Saved My Seed Phrase
          </button>
        </div>

        <style>{`
          .seed-phrase-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 24px;
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 12px;
            border: 2px solid #e0e0e0;
          }

          .seed-word {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: white;
            border-radius: 8px;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          }

          .seed-word:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }

          .seed-number {
            color: #667eea;
            font-size: 13px;
            font-weight: 600;
            min-width: 24px;
          }

          .seed-text {
            font-weight: 500;
            color: #1a1a1a;
            font-size: 14px;
          }

          .seed-actions {
            margin-bottom: 16px;
          }

          .copy-seed-button {
            width: 100%;
            padding: 14px;
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          }

          .copy-seed-button:hover {
            background: #667eea;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          @media (prefers-color-scheme: dark) {
            .seed-phrase-grid {
              background: linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%);
              border-color: #444;
            }

            .seed-word {
              background: #333;
            }

            .seed-text {
              color: #e0e0e0;
            }

            .copy-seed-button {
              background: #333;
              border-color: #667eea;
              color: #667eea;
            }

            .copy-seed-button:hover {
              background: #667eea;
              color: white;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="initialize-wallet">
      <div className="init-container">
        <h2>Confirmation</h2>
        <p className="subtitle">Confirm that you've saved your seed phrase</p>

        <button
          type="button"
          onClick={handleFinalSubmit}
          className="init-button"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Wallet...' : 'Create Wallet'}
        </button>
      </div>
    </div>
  );
}
