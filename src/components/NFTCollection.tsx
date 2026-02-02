/**
 * NFT Collection component
 * Displays all NFTs owned by the wallet
 */

import { useEffect, useState } from 'react';
import useWalletStore from '../app/store';
import type { NFTItem } from '../blockchain/ton';

interface NFTCollectionProps {
  onBack: () => void;
  onNFTClick: (nft: NFTItem) => void;
  onWalletClick?: () => void;
  onHistoryClick?: () => void;
}

export default function NFTCollection({ onBack, onNFTClick, onWalletClick, onHistoryClick }: NFTCollectionProps) {
  const { wallet, nfts, isLoadingNFTs, nftError, loadNFTs } = useWalletStore();
  const [error, setError] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (wallet?.address) {
      // If we already have NFTs in store, use them immediately
      // Otherwise, load them
      if (nfts.length === 0) {
        // Load immediately when page opens
        loadNFTs();
      }
    }
  }, [wallet?.address]); // Only depend on address, not nfts to avoid re-renders

  // Sync error from store
  useEffect(() => {
    if (nftError) {
      setError(nftError);
    } else {
      setError(null);
    }
  }, [nftError]);

  const handleRefresh = () => {
    if (wallet?.address) {
      loadNFTs();
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return 'Unknown';
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="nft-collection">
      <div className="collection-header">
        <h2>My NFTs</h2>
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={isLoadingNFTs}
        >
          🔄
        </button>
      </div>

      <div className="collection-content">
        {error && (
          <div className={`error-banner ${error.includes('rate limit') || error.includes('Rate limit') || error.includes('лимит') ? 'rate-limit' : ''}`} onClick={() => setError(null)}>
            <span>{error}</span>
            <button className="error-close">×</button>
          </div>
        )}
        {isLoadingNFTs ? (
          <div className="loading-container">
            <div className="loading-wrapper">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <p className="loading-text">Loading NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🖼️</div>
            <p>No NFTs</p>
            <p className="empty-subtitle">
              You don't have any NFTs in this wallet yet
            </p>
            <div className="empty-info">
              <p className="info-text">
                💡 NFTs will appear here after receiving them
              </p>
              <p className="info-text">
                ⚠️ Note: NFT detection may take some time.
                If you just received an NFT, wait a few minutes and refresh the page.
              </p>
              <p className="info-text">
                🔍 Open the browser console (F12) to view detailed NFT search logs.
              </p>
              <p className="info-text">
                📝 If an NFT is not displayed, check the NFT address on TONScan and make sure
                it belongs to your wallet.
              </p>
            </div>
          </div>
        ) : (
          <div className="nft-grid">
            {nfts.map((nft, index) => (
              <div
                key={nft.address || index}
                className="nft-card"
                onClick={() => onNFTClick(nft)}
              >
                <div className="nft-image-container">
                  {nft.image ? (
                    <>
                      {/* Check if media is video */}
                      {(() => {
                        const imageUrl = nft.image.toLowerCase();
                        const isVideo = imageUrl.endsWith('.mp4') || 
                                       imageUrl.endsWith('.webm') || 
                                       imageUrl.endsWith('.mov') ||
                                       imageUrl.endsWith('.avi') ||
                                       imageUrl.includes('video') ||
                                       imageUrl.includes('.mp4') ||
                                       imageUrl.includes('.webm');
                        
                        // Get preview/poster image for video
                        const previewImage = nft.poster || nft.thumbnail;
                        const nftKey = nft.address || `nft-${index}`;
                        const videoFailed = videoErrors[nftKey];
                        
                        if (isVideo) {
                          // If video failed and we have preview, show preview as image
                          if (videoFailed && previewImage) {
                            return (
                              <img
                                src={previewImage}
                                alt={nft.name || 'NFT'}
                                className="nft-image"
                                loading="lazy"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ENFT%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            );
                          }
                          
                          return (
                            <video
                              src={nft.image}
                              poster={previewImage}
                              className="nft-image nft-video"
                              autoPlay
                              loop
                              muted
                              playsInline
                              onError={() => {
                                // Mark video as failed for this NFT
                                setVideoErrors(prev => ({ ...prev, [nftKey]: true }));
                              }}
                            />
                          );
                        } else {
                          // Check if it's a GIF (animated image)
                          const isGif = imageUrl.endsWith('.gif');
                          return (
                            <img
                              src={nft.image}
                              alt={nft.name || 'NFT'}
                              className={`nft-image ${isGif ? 'nft-animated' : ''} animate-fade-in`}
                              loading="lazy"
                              decoding="async"
                              crossOrigin="anonymous"
                              width="200"
                              height="200"
                              style={{
                                objectFit: 'cover',
                                backgroundColor: 'var(--tg-theme-hint-color, #f0f0f0)',
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ENFT%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          );
                        }
                      })()}
                    </>
                  ) : (
                    <div className="nft-placeholder">
                      <span className="placeholder-icon">🖼️</span>
                      <div className="loading-text">Tap for details</div>
                    </div>
                  )}
                </div>
                <div className="nft-info">
                  <div className="nft-name">
                    {nft.name || `NFT #${nft.index || index + 1}`}
                  </div>
                  {nft.collectionAddress && (
                    <div className="nft-collection-name">
                      Collection: {formatAddress(nft.collectionAddress)}
                    </div>
                  )}
                  <div className="nft-hint">
                    Tap for details
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .nft-collection {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          overflow: hidden;
        }

        .collection-header {
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

        .collection-header h2 {
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

        .collection-content {
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

        .nft-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .nft-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 2px solid rgba(102, 126, 234, 0.1);
        }

        .nft-card:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
          border-color: rgba(102, 126, 234, 0.3);
        }

        .nft-image-container {
          width: 100%;
          aspect-ratio: 1;
          background: #f9f9f9;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .nft-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .nft-image.nft-animated {
          /* Animated NFTs (GIF) should play automatically */
          animation: none;
        }

        .nft-image.nft-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .loading-text {
          font-size: 12px;
          color: #999;
          margin-top: 8px;
        }

        .nft-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow: hidden;
        }

        .nft-placeholder::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%) translateY(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(100%) translateY(100%) rotate(45deg);
          }
        }

        .placeholder-icon {
          font-size: 48px;
          opacity: 0.7;
        }

        .nft-info {
          padding: 12px;
        }

        .nft-name {
          font-weight: 600;
          font-size: 14px;
          color: #333;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nft-collection-name {
          font-size: 12px;
          color: #666;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 4px;
        }

        .nft-hint {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
          font-style: italic;
        }

        @media (prefers-color-scheme: dark) {
          .nft-collection {
            background: #1a1a1a;
          }

          .collection-header {
            background: #2a2a2a;
            border-bottom-color: #444;
          }

          .collection-header h2 {
            color: #e0e0e0;
          }

          .nft-card {
            background: #2a2a2a;
          }

          .nft-image-container {
            background: #333;
          }

          .nft-name {
            color: #e0e0e0;
          }

          .nft-collection-name {
            color: #999;
          }
        }

        @media (min-width: 600px) {
          .nft-grid {
            grid-template-columns: repeat(3, 1fr);
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
          className="nav-button"
          onClick={onHistoryClick}
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
          className="nav-button nav-button-active"
        >
          <div className="nav-icon">🖼️</div>
          <span className="nav-label">NFT</span>
        </button>
      </div>
    </div>
  );
}
