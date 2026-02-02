/**
 * Transaction History component
 * Displays wallet transaction history with send/receive information
 */

import { useEffect, useState } from 'react';
import useWalletStore from '../app/store';
import { nanoToTon } from '../blockchain/ton';
import type { Transaction } from '../blockchain/ton';

interface TransactionHistoryProps {
  onBack: () => void;
  onWalletClick?: () => void;
  onNFTClick?: () => void;
}

export default function TransactionHistory({ onBack, onWalletClick, onNFTClick }: TransactionHistoryProps) {
  const {
    wallet,
    transactions,
    isLoadingTransactions,
    refreshTransactions,
    error,
    clearError,
  } = useWalletStore();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (wallet) {
      console.log('🔄 Refreshing transactions for wallet:', wallet.address);
      refreshTransactions();
    }
  }, [wallet, refreshTransactions]);

  useEffect(() => {
    console.log('📊 Transactions updated:', transactions.length);
    if (transactions.length > 0) {
      console.log('📊 First transaction:', transactions[0]);
    }
  }, [transactions]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const formatFullDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAddress = (address: string): string => {
    if (!address) return 'Unknown';
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const isIncoming = (tx: Transaction): boolean => {
    if (!wallet?.address) return false;
    // Transaction is incoming if 'to' matches wallet address
    return tx.to.toLowerCase() === wallet.address.toLowerCase();
  };

  const getTransactionType = (tx: Transaction): 'send' | 'receive' => {
    return isIncoming(tx) ? 'receive' : 'send';
  };

  const handleRefresh = () => {
    // Add a small delay to avoid immediate rate limit
    setTimeout(() => {
      refreshTransactions();
    }, 500);
  };

  const handleTxClick = (tx: Transaction) => {
    setSelectedTx(tx);
  };

  const handleCloseDetails = () => {
    setSelectedTx(null);
  };

  if (!wallet) {
    return (
      <div className="transaction-history">
        <div className="history-container">
          <p>Wallet not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-history">
      <div className="history-header">
        <h2>Transaction History</h2>
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={isLoadingTransactions}
        >
          🔄
        </button>
      </div>

      <div className="history-content">
        {error && (
          <div className={`error-banner ${error.includes('rate limit') || error.includes('Rate limit') ? 'rate-limit' : ''}`} onClick={clearError}>
            <span>
              {error.includes('rate limit') || error.includes('Rate limit') 
                ? '⚠️ Rate limit exceeded. Please wait 1-2 minutes and try again.'
                : error}
            </span>
            <button className="error-close">×</button>
          </div>
        )}
        {isLoadingTransactions ? (
          <div className="loading-container">
            <div className="loading-wrapper">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <p className="loading-text">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No Transactions</p>
            <p className="empty-subtitle">Transaction history will appear here</p>
            <div className="empty-info">
              <p className="info-text">
                💡 If you just sent funds, wait a few minutes.
                Transactions may appear with a slight delay.
              </p>
              <p className="info-text">
                🔍 Check the wallet address in the browser console (F12) for debugging.
              </p>
            </div>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((tx, index) => {
              const type = getTransactionType(tx);
              const isIncomingTx = type === 'receive';
              const isJetton = tx.tokenType === 'JETTON';
              
              // Format amount based on token type
              let amount = '';
              let tokenSymbol = 'TON';
              if (isJetton && tx.jettonAmount) {
                amount = tx.jettonAmount;
                tokenSymbol = tx.jettonSymbol || 'JETTON';
              } else {
                amount = nanoToTon(tx.value);
                tokenSymbol = 'TON';
              }

              return (
                <div
                  key={tx.hash || index}
                  className={`transaction-item ${type} ${tx.status} ${isJetton ? 'jetton' : ''}`}
                  onClick={() => handleTxClick(tx)}
                >
                  <div className="tx-icon">
                    {isIncomingTx ? '📥' : '📤'}
                  </div>
                  <div className="tx-details">
                    <div className="tx-type">
                      {isIncomingTx ? 'Received' : 'Sent'} {isJetton && <span className="token-badge">{tokenSymbol}</span>}
                    </div>
                    <div className="tx-address">
                      {isIncomingTx
                        ? `From: ${formatAddress(tx.from)}`
                        : `To: ${formatAddress(tx.to)}`}
                    </div>
                    <div className="tx-time">{formatDate(tx.timestamp)}</div>
                  </div>
                  <div className="tx-amount">
                    <span className={`amount-value ${isIncomingTx ? 'positive' : 'negative'}`}>
                      {isIncomingTx ? '+' : '-'}{amount} {tokenSymbol}
                    </span>
                    <span className={`status-badge ${tx.status}`}>
                      {tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTx && (
        <div className="modal-overlay" onClick={handleCloseDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Details</h3>
              <button className="modal-close" onClick={handleCloseDetails}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">
                  {isIncoming(selectedTx) ? 'Receive' : 'Send'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount:</span>
                <span className="detail-value">
                  {selectedTx.tokenType === 'JETTON' && selectedTx.jettonAmount
                    ? `${selectedTx.jettonAmount} ${selectedTx.jettonSymbol || 'JETTON'}`
                    : `${nanoToTon(selectedTx.value)} TON`}
                </span>
              </div>
              {selectedTx.tokenType === 'JETTON' && (
                <div className="detail-row">
                  <span className="detail-label">Token Type:</span>
                  <span className="detail-value">
                    Jetton Token ({selectedTx.jettonSymbol || 'Unknown'})
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">From:</span>
                <span className="detail-value address-value">
                  {selectedTx.from || 'Unknown'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">To:</span>
                <span className="detail-value address-value">
                  {selectedTx.to || 'Unknown'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">
                  {formatFullDate(selectedTx.timestamp)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`detail-value status-${selectedTx.status}`}>
                  {selectedTx.status === 'success'
                    ? 'Success'
                    : selectedTx.status === 'pending'
                    ? 'Pending'
                    : 'Error'}
                </span>
              </div>
              {selectedTx.hash && (
                <div className="detail-row">
                  <span className="detail-label">Hash:</span>
                  <span 
                    className="detail-value hash-value clickable-hash"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTx.hash);
                      alert('Hash copied to clipboard!');
                    }}
                    title="Click to copy"
                  >
                    {formatAddress(selectedTx.hash)}
                    <span className="copy-icon">📋</span>
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedTx.hash && (
                <a
                  href={`https://tonscan.org/tx/${selectedTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-on-tonscan-button"
                >
                  <span className="button-icon">🔍</span>
                  <span>View on TONScan</span>
                </a>
              )}
              <button className="close-button" onClick={handleCloseDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .transaction-history {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
          overflow: hidden;
        }

        .history-container {
          padding: 16px;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          background: white;
          border-bottom: 2px solid rgba(102, 126, 234, 0.1);
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          flex-shrink: 0;
        }

        .history-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          flex: 1;
          text-align: center;
        }

        .refresh-button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          transition: transform 0.3s;
        }

        .refresh-button:hover:not(:disabled) {
          transform: rotate(180deg);
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-banner {
          background-color: #ff4444;
          color: white;
          padding: 12px 16px;
          margin: 16px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .error-banner.rate-limit {
          background-color: #ff9800;
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

        .history-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          padding-bottom: 120px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          padding: 60px 20px;
          color: #666;
        }

        .loading-wrapper {
          position: relative;
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
        }

        .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .spinner-ring:nth-child(1) {
          animation-delay: -0.45s;
          border-top-color: #667eea;
        }

        .spinner-ring:nth-child(2) {
          animation-delay: -0.3s;
          border-top-color: #764ba2;
          width: 70px;
          height: 70px;
          top: 5px;
          left: 5px;
        }

        .spinner-ring:nth-child(3) {
          animation-delay: -0.15s;
          border-top-color: #667eea;
          width: 60px;
          height: 60px;
          top: 10px;
          left: 10px;
        }

        .spinner-ring:nth-child(4) {
          border-top-color: #764ba2;
          width: 50px;
          height: 50px;
          top: 15px;
          left: 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 16px;
          font-weight: 500;
          color: #667eea;
          margin-top: 8px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 8px 0;
          color: #666;
        }

        .empty-subtitle {
          font-size: 14px;
          opacity: 0.7;
        }

        .empty-info {
          margin-top: 24px;
          padding: 16px;
          background: #f0f8ff;
          border-radius: 8px;
          max-width: 400px;
        }

        .info-text {
          font-size: 13px;
          color: #666;
          margin: 8px 0;
          line-height: 1.5;
        }

        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transaction-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px;
          background: white;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 2px solid rgba(102, 126, 234, 0.1);
          margin-bottom: 12px;
        }

        .transaction-item:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
          border-color: rgba(102, 126, 234, 0.3);
        }

        .transaction-item.pending {
          opacity: 0.7;
        }

        .transaction-item.failed {
          opacity: 0.5;
        }

        .transaction-item.jetton {
          border-left: 3px solid #667eea;
        }

        .token-badge {
          display: inline-block;
          padding: 2px 8px;
          background: rgba(102, 126, 234, 0.1);
          color: #667eea;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 6px;
        }

        .tx-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .tx-details {
          flex: 1;
          min-width: 0;
        }

        .tx-type {
          font-weight: 600;
          font-size: 16px;
          color: #333;
          margin-bottom: 4px;
        }

        .tx-address {
          font-size: 13px;
          color: #666;
          margin-bottom: 4px;
          word-break: break-all;
        }

        .tx-time {
          font-size: 12px;
          color: #999;
        }

        .tx-amount {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }

        .amount-value {
          font-weight: 600;
          font-size: 16px;
        }

        .amount-value.positive {
          color: #00aa44;
        }

        .amount-value.negative {
          color: #ff4444;
        }

        .status-badge {
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f0f0f0;
        }

        .status-badge.success {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .status-badge.pending {
          background: #fff3e0;
          color: #f57c00;
        }

        .status-badge.failed {
          background: #ffebee;
          color: #c62828;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
          position: sticky;
          top: 0;
          background: white;
          border-radius: 16px 16px 0 0;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #666;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .modal-close:hover {
          background: #f0f0f0;
        }

        .modal-body {
          padding: 24px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          font-weight: 500;
          color: #666;
          font-size: 14px;
          flex-shrink: 0;
          margin-right: 16px;
        }

        .detail-value {
          color: #333;
          font-size: 14px;
          text-align: right;
          word-break: break-all;
          flex: 1;
        }

        .address-value {
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .hash-value {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #666;
        }

        .clickable-hash {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          transition: all 0.2s;
          width: 100%;
        }

        .clickable-hash:hover {
          color: #667eea;
        }

        .copy-icon {
          font-size: 12px;
          opacity: 0.5;
          transition: opacity 0.2s;
        }

        .clickable-hash:hover .copy-icon {
          opacity: 1;
        }

        .view-on-tonscan-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background 0.2s;
          width: 100%;
          margin-bottom: 12px;
        }

        .view-on-tonscan-button:hover {
          background: linear-gradient(135deg, #5568d3 0%, #653a91 100%);
        }

        .view-on-tonscan-button .button-icon {
          font-size: 16px;
        }

        .status-success {
          color: #2e7d32;
          font-weight: 600;
        }

        .status-pending {
          color: #f57c00;
          font-weight: 600;
        }

        .status-failed {
          color: #c62828;
          font-weight: 600;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
        }

        .close-button {
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

        .close-button:hover {
          background: #0066aa;
        }

        @media (prefers-color-scheme: dark) {
          .transaction-history {
            background: #1a1a1a;
          }

          .history-header {
            background: #2a2a2a;
            border-bottom-color: #444;
          }

          .history-header h2 {
            color: #e0e0e0;
          }

          .transaction-item {
            background: #2a2a2a;
          }

          .tx-type {
            color: #e0e0e0;
          }

          .tx-address {
            color: #999;
          }

          .modal-content {
            background: #2a2a2a;
          }

          .modal-header {
            background: #2a2a2a;
            border-bottom-color: #444;
          }

          .modal-header h3 {
            color: #e0e0e0;
          }

          .detail-label {
            color: #999;
          }

          .detail-value {
            color: #e0e0e0;
          }

          .detail-row {
            border-bottom-color: #444;
          }
        }
        .bottom-navigation {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 400px;
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 20px;
          z-index: 100;
          padding: 0 16px;
        }

        .nav-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #2a2a2a;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          padding: 12px 20px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .nav-button .nav-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transition: all 0.3s;
        }

        .nav-button .nav-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.3s;
        }

        .nav-button-active {
          transform: scale(1.15);
          background: #667eea;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .nav-button-active .nav-icon {
          background: rgba(255, 255, 255, 0.2);
          width: 48px;
          height: 48px;
          font-size: 28px;
        }

        .nav-button-active .nav-label {
          color: white;
          font-weight: 600;
          font-size: 13px;
        }

        .nav-button:active:not(.nav-button-active) {
          transform: scale(0.95);
        }
      `}</style>
      {/* Bottom Navigation */}
      <div className="bottom-navigation">
        <button
          className="nav-button nav-button-active"
        >
          <div className="nav-icon">📋</div>
          <span className="nav-label">History</span>
        </button>
        <button
          className="nav-button"
          onClick={onWalletClick}
        >
          <div className="nav-icon">💎</div>
          <span className="nav-label">Wallet</span>
        </button>
        <button
          className="nav-button"
          onClick={onNFTClick}
        >
          <div className="nav-icon">🖼️</div>
          <span className="nav-label">NFT</span>
        </button>
      </div>
    </div>
  );
}
