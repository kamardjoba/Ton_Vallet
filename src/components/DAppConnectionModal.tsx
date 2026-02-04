/**
 * DApp Connection Modal
 * Shows DApp information and allows user to connect wallet
 */

import { useState, useEffect } from 'react';
import { 
  TONConnectManifest, 
  fetchDAppManifest,
  createTONConnectResponse,
  sendTONConnectResponse,
  saveTONConnectSession,
  TONConnectSession
} from '../utils/tonconnect';
import { HapticFeedback } from '../utils/telegram';
import LoadingSpinner from './LoadingSpinner';

interface DAppConnectionModalProps {
  isOpen: boolean;
  manifestUrl: string;
  requestId: string;
  returnUrl?: string; // Optional return URL for callback
  walletAddress: string;
  walletPublicKey: string;
  onConnected: () => void;
  onCancel: () => void;
}

export default function DAppConnectionModal({
  isOpen,
  manifestUrl,
  requestId,
  returnUrl,
  walletAddress,
  walletPublicKey,
  onConnected,
  onCancel,
}: DAppConnectionModalProps) {
  const [manifest, setManifest] = useState<TONConnectManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && manifestUrl) {
      loadManifest();
    } else {
      // Reset state when modal closes
      setManifest(null);
      setIsLoading(true);
      setIsConnecting(false);
      setError(null);
    }
  }, [isOpen, manifestUrl]);

  const loadManifest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedManifest = await fetchDAppManifest(manifestUrl);
      if (fetchedManifest) {
        setManifest(fetchedManifest);
      } else {
        setError('Failed to load DApp information');
      }
    } catch (err) {
      console.error('Error loading manifest:', err);
      setError('Failed to load DApp information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!manifest) return;

    setIsConnecting(true);
    setError(null);
    HapticFeedback.impact('medium');

    try {
      // Create TON Connect response
      const response = createTONConnectResponse(
        requestId,
        walletAddress,
        walletPublicKey
      );

      // Determine response URL
      // Priority: 1. returnUrl from request, 2. manifest origin + /tonconnect/callback, 3. manifest.url origin
      let responseUrl = '';
      
      if (returnUrl) {
        // Use returnUrl from the request if available
        responseUrl = returnUrl;
        console.log('Using returnUrl from request:', responseUrl);
      } else {
        // Fallback: construct callback URL from manifest
        try {
          const manifestUrlObj = new URL(manifest.url);
          // Try common TON Connect callback paths
          const possiblePaths = [
            '/tonconnect/callback',
            '/ton-connect/callback',
            '/callback',
          ];
          
          // Try to find the correct callback path
          responseUrl = `${manifestUrlObj.origin}${possiblePaths[0]}`;
          console.log('Constructed callback URL from manifest:', responseUrl);
        } catch (urlError) {
          console.error('Error constructing callback URL:', urlError);
          throw new Error('Failed to determine callback URL');
        }
      }

      // Send response to DApp
      console.log('Sending TON Connect response to:', responseUrl);
      const success = await sendTONConnectResponse(responseUrl, response);

      if (success) {
        // Save session
        const session: TONConnectSession = {
          requestId,
          manifest,
          connectedAt: Date.now(),
          walletAddress,
          walletPublicKey,
        };
        saveTONConnectSession(session);

        HapticFeedback.notification('success');
        onConnected();
      } else {
        throw new Error('Failed to send connection response');
      }
    } catch (err: any) {
      console.error('Error connecting to DApp:', err);
      setError(err?.message || 'Failed to connect to DApp');
      HapticFeedback.notification('error');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dapp-connection-overlay" onClick={onCancel}>
      <div className="dapp-connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dapp-connection-header">
          <h2>Connect to DApp</h2>
          <button className="dapp-connection-close" onClick={onCancel} disabled={isConnecting}>
            ×
          </button>
        </div>

        <div className="dapp-connection-body">
          {isLoading ? (
            <div className="dapp-connection-loading">
              <LoadingSpinner />
              <p>Loading DApp information...</p>
            </div>
          ) : error ? (
            <div className="dapp-connection-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button className="retry-button" onClick={loadManifest}>
                Try Again
              </button>
            </div>
          ) : manifest ? (
            <>
              <div className="dapp-info">
                {manifest.iconUrl && (
                  <img 
                    src={manifest.iconUrl} 
                    alt={manifest.name}
                    className="dapp-icon"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <h3>{manifest.name}</h3>
                <p className="dapp-url">{manifest.url}</p>
              </div>

              <div className="dapp-permissions">
                <h4>This DApp will be able to:</h4>
                <ul>
                  <li>✓ View your wallet address</li>
                  <li>✓ Request transactions</li>
                  <li>✓ Send transaction requests</li>
                </ul>
              </div>

              {manifest.termsOfUseUrl && (
                <div className="dapp-links">
                  <a 
                    href={manifest.termsOfUseUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Terms of Use
                  </a>
                  {manifest.privacyPolicyUrl && (
                    <>
                      <span> • </span>
                      <a 
                        href={manifest.privacyPolicyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </a>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </>
          ) : null}
        </div>

        {manifest && !isLoading && !error && (
          <div className="dapp-connection-footer">
            <button
              className="dapp-connection-button cancel-button"
              onClick={onCancel}
              disabled={isConnecting}
            >
              Cancel
            </button>
            <button
              className="dapp-connection-button connect-button"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Connecting...</span>
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .dapp-connection-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2500;
          padding: 20px;
        }

        .dapp-connection-modal {
          background: var(--tg-theme-bg-color, white);
          border-radius: 20px;
          width: 100%;
          max-width: 450px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
          color: var(--tg-theme-text-color, #333);
        }

        .dapp-connection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--tg-theme-secondary-bg-color, #e0e0e0);
        }

        .dapp-connection-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--tg-theme-text-color, #333);
        }

        .dapp-connection-close {
          background: none;
          border: none;
          font-size: 32px;
          color: var(--tg-theme-hint-color, #666);
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .dapp-connection-close:hover:not(:disabled) {
          background: var(--tg-theme-secondary-bg-color, #f0f0f0);
        }

        .dapp-connection-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dapp-connection-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .dapp-connection-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 16px;
        }

        .dapp-connection-loading p {
          color: var(--tg-theme-hint-color, #666);
          font-size: 14px;
        }

        .dapp-connection-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .error-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .dapp-connection-error p {
          color: var(--tg-theme-destructive-text-color, #c62828);
          margin-bottom: 20px;
        }

        .retry-button {
          padding: 12px 24px;
          background: var(--tg-theme-button-color, #667eea);
          color: var(--tg-theme-button-text-color, white);
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .dapp-info {
          text-align: center;
          margin-bottom: 24px;
        }

        .dapp-icon {
          width: 80px;
          height: 80px;
          border-radius: 16px;
          margin-bottom: 16px;
          object-fit: cover;
        }

        .dapp-info h3 {
          margin: 0 0 8px 0;
          font-size: 22px;
          font-weight: 600;
          color: var(--tg-theme-text-color, #333);
        }

        .dapp-url {
          margin: 0;
          font-size: 14px;
          color: var(--tg-theme-hint-color, #666);
          word-break: break-all;
        }

        .dapp-permissions {
          background: var(--tg-theme-secondary-bg-color, #f5f5f5);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .dapp-permissions h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--tg-theme-text-color, #333);
        }

        .dapp-permissions ul {
          margin: 0;
          padding-left: 20px;
          list-style: none;
        }

        .dapp-permissions li {
          margin: 8px 0;
          font-size: 14px;
          color: var(--tg-theme-text-color, #666);
        }

        .dapp-links {
          text-align: center;
          font-size: 12px;
          color: var(--tg-theme-hint-color, #666);
          margin-bottom: 16px;
        }

        .dapp-links a {
          color: var(--tg-theme-link-color, #0088cc);
          text-decoration: none;
        }

        .error-message {
          padding: 12px;
          background: var(--tg-theme-destructive-text-color, #ffebee);
          color: var(--tg-theme-text-color, #c62828);
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .dapp-connection-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--tg-theme-secondary-bg-color, #e0e0e0);
        }

        .dapp-connection-button {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .dapp-connection-button.cancel-button {
          background: var(--tg-theme-secondary-bg-color, #f0f0f0);
          color: var(--tg-theme-text-color, #333);
        }

        .dapp-connection-button.connect-button {
          background: var(--tg-theme-button-color, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
          color: var(--tg-theme-button-text-color, white);
        }

        .dapp-connection-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
