/**
 * Wallet component for TON Wallet Telegram Mini App
 * Main UI component displaying wallet balance, address, and transaction controls
 */

import { useEffect, useState } from 'react';
import useWalletStore from '../app/store';
import { nanoToTon } from '../blockchain/ton';

interface WalletProps {
  onSendClick?: () => void;
  onReceiveClick?: () => void;
}

export default function Wallet({ onSendClick, onReceiveClick }: WalletProps) {
  const {
    wallet,
    balance,
    isUnlocked,
    isLoadingBalance,
    error,
    updateBalance,
    clearError,
  } = useWalletStore();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isUnlocked && wallet) {
      updateBalance();
      // Auto-refresh balance every 30 seconds
      const interval = setInterval(() => {
        updateBalance();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isUnlocked, wallet, updateBalance]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleCopyAddress = async () => {
    if (!wallet?.address) return;
    
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const formatAddress = (address: string): string => {
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  if (!isUnlocked || !wallet) {
    return (
      <div className="wallet-container">
        <div className="wallet-locked">
          <p>Wallet is locked</p>
        </div>
      </div>
    );
  }

  const balanceTon = nanoToTon(balance);

  return (
    <div className="wallet-container">
      {error && (
        <div className="error-banner" onClick={clearError}>
          <span>{error}</span>
          <button className="error-close">×</button>
        </div>
      )}

      <div className="wallet-header">
        <h2>TON Wallet</h2>
      </div>

      <div className="wallet-balance">
        <div className="balance-label">Balance</div>
        <div className="balance-value">
          {isLoadingBalance ? (
            <span className="loading">Loading...</span>
          ) : (
            <>
              <span className="amount">{balanceTon}</span>
              <span className="currency">TON</span>
            </>
          )}
        </div>
      </div>

      <div className="wallet-address">
        <div className="address-label">Address</div>
        <div className="address-value" onClick={handleCopyAddress}>
          <code>{formatAddress(wallet.address)}</code>
          <span className="copy-indicator">{copied ? '✓ Copied' : '📋'}</span>
        </div>
      </div>

      <div className="wallet-actions">
        <button
          className="action-button send-button"
          onClick={onSendClick}
          disabled={isLoadingBalance}
        >
          <span className="button-icon">📤</span>
          <span>Send</span>
        </button>
        <button
          className="action-button receive-button"
          onClick={onReceiveClick}
        >
          <span className="button-icon">📥</span>
          <span>Receive</span>
        </button>
      </div>

      <style>{`
        .wallet-container {
          padding: 16px;
          max-width: 100%;
          margin: 0 auto;
        }

        .error-banner {
          background-color: #ff4444;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .error-close {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .wallet-locked {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .wallet-header {
          margin-bottom: 24px;
        }

        .wallet-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .wallet-balance {
          background: linear-gradient(135deg, #0088cc 0%, #0066aa 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
          color: white;
        }

        .balance-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }

        .balance-value {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .balance-value .amount {
          font-size: 32px;
          font-weight: 700;
        }

        .balance-value .currency {
          font-size: 20px;
          opacity: 0.9;
        }

        .loading {
          font-size: 18px;
          opacity: 0.8;
        }

        .wallet-address {
          background: #f5f5f5;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .address-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }

        .address-value {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .address-value code {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          color: #333;
          word-break: break-all;
        }

        .copy-indicator {
          font-size: 16px;
          color: #0088cc;
          margin-left: 8px;
          flex-shrink: 0;
        }

        .wallet-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px;
          border: none;
          border-radius: 12px;
          background: #0088cc;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover:not(:disabled) {
          background: #0066aa;
          transform: translateY(-2px);
        }

        .action-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .receive-button {
          background: #00aa44;
        }

        .receive-button:hover:not(:disabled) {
          background: #008833;
        }

        .button-icon {
          font-size: 24px;
        }

        @media (prefers-color-scheme: dark) {
          .wallet-address {
            background: #2a2a2a;
          }

          .address-value code {
            color: #e0e0e0;
          }

          .address-label {
            color: #999;
          }
        }
      `}</style>
    </div>
  );
}

