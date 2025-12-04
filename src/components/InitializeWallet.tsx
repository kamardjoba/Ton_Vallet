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
          <h2>Создать кошелек</h2>
          <p className="subtitle">Создайте пароль для защиты вашего кошелька</p>

          <form onSubmit={handlePasswordSubmit} className="init-form" noValidate>
            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль (минимум 8 символов)"
                className="password-input"
                disabled={isLoading}
                minLength={8}
                autoFocus
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Подтвердите пароль"
                className="password-input"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <div className="error-message">
                Пароли не совпадают
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
              Продолжить
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
            background: #f5f5f5;
          }

          .init-container {
            width: 100%;
            max-width: 400px;
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .init-container h2 {
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

          .init-form {
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

          .error-message {
            padding: 12px;
            background: #ffebee;
            color: #c62828;
            border-radius: 8px;
            font-size: 14px;
          }

          .init-button {
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

          .init-button:hover:not(:disabled) {
            background: #0066aa;
          }

          .init-button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }

          @media (prefers-color-scheme: dark) {
            .initialize-wallet {
              background: #1a1a1a;
            }

            .init-container {
              background: #2a2a2a;
            }

            .init-container h2 {
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
          <p className="subtitle">Сохраните эти 24 слова в безопасном месте. Они нужны для восстановления кошелька.</p>

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
              {copied ? '✓ Скопировано' : '📋 Копировать seed phrase'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSeedConfirm}
            className="init-button"
          >
            Я сохранил seed phrase
          </button>
        </div>

        <style>{`
          .seed-phrase-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 24px;
            padding: 16px;
            background: #f9f9f9;
            border-radius: 8px;
          }

          .seed-word {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: white;
            border-radius: 4px;
          }

          .seed-number {
            color: #666;
            font-size: 12px;
            min-width: 20px;
          }

          .seed-text {
            font-weight: 500;
            color: #333;
          }

          .seed-actions {
            margin-bottom: 16px;
          }

          .copy-seed-button {
            width: 100%;
            padding: 12px;
            background: #f0f0f0;
            color: #333;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .copy-seed-button:hover {
            background: #e0e0e0;
            border-color: #0088cc;
          }

          @media (prefers-color-scheme: dark) {
            .seed-phrase-grid {
              background: #333;
            }

            .seed-word {
              background: #2a2a2a;
            }

            .seed-text {
              color: #e0e0e0;
            }

            .copy-seed-button {
              background: #333;
              border-color: #444;
              color: #e0e0e0;
            }

            .copy-seed-button:hover {
              background: #3a3a3a;
              border-color: #0088cc;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="initialize-wallet">
      <div className="init-container">
        <h2>Подтверждение</h2>
        <p className="subtitle">Подтвердите, что вы сохранили seed phrase</p>

        <button
          type="button"
          onClick={handleFinalSubmit}
          className="init-button"
          disabled={isLoading}
        >
          {isLoading ? 'Создание кошелька...' : 'Создать кошелек'}
        </button>
      </div>
    </div>
  );
}

