/**
 * Receive TON Modal component
 * Shows wallet address and QR code for receiving TON
 */

import { useState, useEffect } from 'react';
import useWalletStore from '../app/store';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
  const { wallet } = useWalletStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !wallet) return null;

  const handleCopyAddress = async () => {
    if (!wallet.address) return;
    
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Generate QR code URL (using a free QR code service)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wallet.address)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Получить TON</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="receive-content">
          <p className="receive-description">
            Отправьте TON на этот адрес
          </p>

          <div className="qr-code-container">
            <img 
              src={qrCodeUrl} 
              alt="QR Code" 
              className="qr-code"
            />
          </div>

          <div className="address-container">
            <div className="address-label">Адрес кошелька</div>
            <div className="address-value" onClick={handleCopyAddress}>
              <code>{wallet.address}</code>
              <span className="copy-indicator">
                {copied ? '✓ Скопировано' : '📋'}
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="close-button"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      <style>{`
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
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
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

        .receive-content {
          padding: 24px;
        }

        .receive-description {
          text-align: center;
          color: #666;
          margin: 0 0 24px 0;
          font-size: 14px;
        }

        .qr-code-container {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 12px;
        }

        .qr-code {
          width: 200px;
          height: 200px;
          border-radius: 8px;
        }

        .address-container {
          margin-bottom: 24px;
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
          padding: 12px 16px;
          background: #f5f5f5;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .address-value:hover {
          background: #e8e8e8;
        }

        .address-value code {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #333;
          word-break: break-all;
          flex: 1;
          margin-right: 8px;
        }

        .copy-indicator {
          font-size: 16px;
          color: #0088cc;
          flex-shrink: 0;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        .close-button {
          flex: 1;
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
          .modal-content {
            background: #2a2a2a;
          }

          .modal-header {
            border-bottom-color: #444;
          }

          .modal-header h2 {
            color: #e0e0e0;
          }

          .receive-description {
            color: #999;
          }

          .qr-code-container {
            background: #333;
          }

          .address-value {
            background: #333;
          }

          .address-value:hover {
            background: #3a3a3a;
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


