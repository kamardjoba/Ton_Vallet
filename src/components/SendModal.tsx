/**
 * Send TON Modal component
 * Allows user to send TON to another address
 */

import { useState } from 'react';
import useWalletStore from '../app/store';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SendModal({ isOpen, onClose }: SendModalProps) {
  const { sendTon, error, clearError } = useWalletStore();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!toAddress || !amount) {
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await sendTon(toAddress, amount, comment || undefined);
      // Reset form
      setToAddress('');
      setAmount('');
      setComment('');
      onClose();
    } catch (err) {
      console.error('Failed to send TON:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setToAddress('');
      setAmount('');
      setComment('');
      clearError();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Отправить TON</h2>
          <button className="modal-close" onClick={handleClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="send-form">
          <div className="input-group">
            <label>Адрес получателя</label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="EQD..."
              className="address-input"
              disabled={isLoading}
              required
            />
          </div>

          <div className="input-group">
            <label>Сумма (TON)</label>
            <input
              type="number"
              step="0.000000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="amount-input"
              disabled={isLoading}
              required
            />
          </div>

          <div className="input-group">
            <label>Комментарий (опционально)</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий к транзакции"
              className="comment-input"
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="cancel-button"
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="send-button"
              disabled={!toAddress || !amount || isLoading}
            >
              {isLoading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
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

        .modal-close:hover:not(:disabled) {
          background: #f0f0f0;
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-form {
          padding: 24px;
        }

        .input-group {
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .address-input,
        .amount-input,
        .comment-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .address-input:focus,
        .amount-input:focus,
        .comment-input:focus {
          outline: none;
          border-color: #0088cc;
        }

        .address-input:disabled,
        .amount-input:disabled,
        .comment-input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          color: #c62828;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .cancel-button,
        .send-button {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-button {
          background: #f5f5f5;
          color: #333;
        }

        .cancel-button:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .send-button {
          background: #0088cc;
          color: white;
        }

        .send-button:hover:not(:disabled) {
          background: #0066aa;
        }

        .send-button:disabled,
        .cancel-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

          .input-group label {
            color: #e0e0e0;
          }

          .address-input,
          .amount-input,
          .comment-input {
            background: #333;
            border-color: #444;
            color: #e0e0e0;
          }

          .cancel-button {
            background: #444;
            color: #e0e0e0;
          }
        }
      `}</style>
    </div>
  );
}


