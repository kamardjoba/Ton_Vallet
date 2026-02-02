/**
 * NFT Details component
 * Shows NFT details and allows sending NFT
 */

import { useEffect, useState } from 'react';
import useWalletStore from '../app/store';
import { getNFTDetails, sendNFT } from '../blockchain/ton';
import type { NFTItem } from '../blockchain/ton';

interface NFTDetailsProps {
  nft: NFTItem;
  onBack: () => void;
}

export default function NFTDetails({ nft, onBack }: NFTDetailsProps) {
  const { wallet } = useWalletStore();
  const [nftDetails, setNftDetails] = useState<NFTItem>(nft);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    loadNFTDetails();
  }, [nft.address]);

  const loadNFTDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Loading NFT details for:', nft.address);
      
      // Check if we already have complete data
      const hasCompleteData = 
        nft.name && 
        nft.name !== `NFT ${nft.address.slice(-8)}` &&
        nft.name !== 'NFT Item' &&
        (nft.description || nft.image);
      
      if (hasCompleteData) {
        console.log('✅ Using existing complete NFT data, skipping API calls');
        setNftDetails(nft);
        setIsLoading(false);
        return;
      }
      
      // Start with the NFT info we already have
      let details: NFTItem = { ...nft };
      
      // Only try to fetch additional details if we don't have complete info
      try {
        const fetchedDetails = await getNFTDetails(nft.address, nft);
        if (fetchedDetails) {
          // Merge fetched details with existing info, prioritizing fetched data
          details = {
            ...details,
            ...fetchedDetails,
            // Use fetched name if it's better than what we have
            name: fetchedDetails.name && 
                  fetchedDetails.name !== 'NFT Item' &&
                  fetchedDetails.name !== `NFT ${nft.address.slice(-8)}`
              ? fetchedDetails.name 
              : (details.name || `NFT ${nft.address.slice(-8)}`),
            // Use fetched description if it's better
            description: fetchedDetails.description && 
                        fetchedDetails.description !== 'NFT item' &&
                        fetchedDetails.description !== 'NFT details' &&
                        fetchedDetails.description.trim().length > 0
              ? fetchedDetails.description
              : (details.description && 
                 details.description !== 'NFT item' && 
                 details.description !== 'NFT details' &&
                 details.description.trim().length > 0
                 ? details.description 
                 : undefined),
            // Use fetched image if available
            image: fetchedDetails.image || details.image,
            // Use fetched poster/thumbnail if available
            poster: fetchedDetails.poster || details.poster,
            thumbnail: fetchedDetails.thumbnail || details.thumbnail,
          };
          console.log('✅ NFT details loaded:', details);
        }
      } catch (fetchError) {
        console.log('ℹ️ Could not fetch additional NFT details (using existing info):', fetchError);
        // Use what we have - don't fail
      }
      
      // Ensure we have at least basic info
      if (!details.name) {
        details.name = `NFT ${details.address.slice(-8)}`;
      }
      // Don't set default description - let it be undefined if not available
      // This way we can show "Description not available" in UI instead of "NFT item"
      
      setNftDetails(details);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load NFT details';
      console.log('ℹ️ Failed to load NFT details (using existing info):', err);
      // Use basic NFT info we have
      const basicDetails: NFTItem = {
        ...nft,
        name: nft.name || `NFT ${nft.address.slice(-8)}`,
        description: nft.description && 
                     nft.description !== 'NFT item' && 
                     nft.description !== 'NFT details' &&
                     nft.description.trim().length > 0
          ? nft.description 
          : undefined,
      };
      setNftDetails(basicDetails);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!wallet?.privateKey) {
      setError('Wallet is not unlocked');
      return;
    }

    if (!recipientAddress.trim()) {
      setError('Enter recipient address');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const txHash = await sendNFT(
        wallet.privateKey,
        nft.address,
        recipientAddress.trim()
      );
      setSuccess(`NFT sent successfully! Hash: ${txHash}`);
      setShowSendModal(false);
      setRecipientAddress('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send NFT';
      setError(errorMessage);
      console.error('Failed to send NFT:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return 'Unknown';
    if (address.length <= 13) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setSuccess('Address copied!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="nft-details">
      <div className="details-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h2>NFT Details</h2>
        <div style={{ width: '60px' }}></div>
      </div>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          <span>{error}</span>
          <button className="error-close">×</button>
        </div>
      )}

      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)}>
          <span>{success}</span>
          <button className="error-close">×</button>
        </div>
      )}

      <div className="details-content">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading details...</p>
          </div>
        ) : (
          <>
            <div className="nft-image-section">
              {nftDetails.image ? (
                <>
                  {/* Check if media is video */}
                  {(() => {
                    const imageUrl = nftDetails.image.toLowerCase();
                    const isVideo = imageUrl.endsWith('.mp4') || 
                                   imageUrl.endsWith('.webm') || 
                                   imageUrl.endsWith('.mov') ||
                                   imageUrl.endsWith('.avi') ||
                                   imageUrl.includes('video') ||
                                   imageUrl.includes('.mp4') ||
                                   imageUrl.includes('.webm');
                    
                    // Get preview/poster image for video
                    const previewImage = nftDetails.poster || nftDetails.thumbnail;
                    
                    if (isVideo) {
                      // If video failed and we have preview, show preview as image
                      if (videoFailed && previewImage) {
                        return (
                          <img
                            src={previewImage}
                            alt={nftDetails.name || 'NFT'}
                            className="nft-large-image"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="24"%3ENFT%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        );
                      }
                      
                      return (
                        <video
                          src={nftDetails.image}
                          poster={previewImage}
                          className="nft-large-image nft-video"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls
                          onError={() => {
                            // Mark video as failed
                            setVideoFailed(true);
                          }}
                        />
                      );
                    } else {
                      // Check if it's a GIF (animated image)
                      const isGif = imageUrl.endsWith('.gif');
                      return (
                        <img
                          src={nftDetails.image}
                          alt={nftDetails.name || 'NFT'}
                          className={`nft-large-image ${isGif ? 'nft-animated' : ''} animate-fade-in`}
                          loading="lazy"
                          decoding="async"
                          width="500"
                          height="500"
                          style={{
                            objectFit: 'cover',
                            backgroundColor: 'var(--tg-theme-hint-color, #f0f0f0)',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="24"%3ENFT%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      );
                    }
                  })()}
                </>
              ) : (
                <div className="nft-large-placeholder">
                  <span className="placeholder-icon">🖼️</span>
                  <div className="loading-text">Loading image...</div>
                </div>
              )}
            </div>

            <div className="nft-info-section">
              <h3 className="nft-title">
                {nftDetails.name || `NFT #${nftDetails.index || nftDetails.address.slice(-8)}`}
              </h3>

              <div className="info-block">
                <div className="info-label">Description</div>
                <div className="info-value">
                  {nftDetails.description || 'Description not available'}
                </div>
              </div>

              <div className="info-block">
                <div className="info-label">NFT Address</div>
                <div className="info-value address-value" onClick={() => handleCopyAddress(nftDetails.address)}>
                  <code>{formatAddress(nftDetails.address)}</code>
                  <span className="copy-icon">📋</span>
                </div>
              </div>

              {nftDetails.collectionAddress && (
                <div className="info-block">
                  <div className="info-label">Collection</div>
                  <div className="info-value address-value" onClick={() => handleCopyAddress(nftDetails.collectionAddress!)}>
                    <code>{formatAddress(nftDetails.collectionAddress)}</code>
                    <span className="copy-icon">📋</span>
                  </div>
                </div>
              )}

              {nftDetails.ownerAddress && (
                <div className="info-block">
                  <div className="info-label">Owner</div>
                  <div className="info-value address-value" onClick={() => handleCopyAddress(nftDetails.ownerAddress!)}>
                    <code>{formatAddress(nftDetails.ownerAddress)}</code>
                    <span className="copy-icon">📋</span>
                  </div>
                </div>
              )}

              {nftDetails.index !== undefined && (
                <div className="info-block">
                  <div className="info-label">Index</div>
                  <div className="info-value">#{nftDetails.index}</div>
                </div>
              )}

              {nftDetails.attributes && nftDetails.attributes.length > 0 && (
                <div className="info-block">
                  <div className="info-label">Attributes</div>
                  <div className="attributes-list">
                    {nftDetails.attributes.map((attr, index) => (
                      <div key={index} className="attribute-item">
                        <span className="attribute-trait">{attr.trait_type}:</span>
                        <span className="attribute-value">{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="action-buttons">
                <a
                  href={`https://tonscan.org/nft/${nftDetails.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-button"
                >
                  <span className="button-icon">🔍</span>
                  <span>View on TONScan</span>
                </a>
                <button
                  className="send-button"
                  onClick={() => setShowSendModal(true)}
                  disabled={isSending}
                >
                  <span className="button-icon">📤</span>
                  <span>Send NFT</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showSendModal && (
        <div className="modal-overlay" onClick={() => !isSending && setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send NFT</h3>
              <button
                className="modal-close"
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Recipient Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter TON wallet address"
                  disabled={isSending}
                />
              </div>
              <div className="form-info">
                <p>💡 Sending NFT requires ~0.05 TON for fees</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={handleSend}
                disabled={isSending || !recipientAddress.trim()}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .nft-details {
          min-height: 100vh;
          background: #f5f5f5;
          padding-bottom: 20px;
        }

        .details-header {
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
        }

        .back-button {
          background: none;
          border: none;
          font-size: 16px;
          color: #0088cc;
          cursor: pointer;
          padding: 8px;
          font-weight: 500;
        }

        .back-button:hover {
          opacity: 0.8;
        }

        .details-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
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

        .success-banner {
          background-color: #00aa44;
          color: white;
          padding: 12px 16px;
          margin: 16px;
          border-radius: 8px;
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

        .details-content {
          padding: 16px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #666;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0088cc;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .nft-image-section {
          margin-bottom: 24px;
        }

        .nft-large-image {
          width: 100%;
          max-width: 500px;
          border-radius: 12px;
          display: block;
          margin: 0 auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .nft-large-image.nft-animated {
          /* Ensure animated NFTs play smoothly */
          image-rendering: auto;
        }

        .nft-large-image.nft-video {
          width: 100%;
          max-width: 500px;
          border-radius: 12px;
          display: block;
          margin: 0 auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .nft-large-placeholder {
          width: 100%;
          max-width: 500px;
          aspect-ratio: 1;
          margin: 0 auto;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .placeholder-icon {
          font-size: 120px;
          opacity: 0.7;
        }

        .nft-info-section {
          background: white;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
          border: 2px solid rgba(102, 126, 234, 0.1);
        }

        .nft-title {
          margin: 0 0 20px 0;
          font-size: 24px;
          font-weight: 600;
          color: #333;
        }

        .info-block {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-block:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .info-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .info-value {
          font-size: 14px;
          color: #333;
          word-break: break-all;
        }

        .address-value {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .address-value:hover {
          background: #f5f5f5;
        }

        .address-value code {
          font-family: 'Courier New', monospace;
          flex: 1;
        }

        .copy-icon {
          font-size: 16px;
          color: #0088cc;
        }

        .attributes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .attribute-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f9f9f9;
          border-radius: 6px;
        }

        .attribute-trait {
          font-weight: 500;
          color: #666;
        }

        .attribute-value {
          color: #333;
        }

        .action-buttons {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .view-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-decoration: none;
          box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
        }

        .view-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(74, 144, 226, 0.5);
        }

        .send-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
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

        .send-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button-icon {
          font-size: 20px;
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

        .modal-close:hover:not(:disabled) {
          background: #f0f0f0;
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #0088cc;
        }

        .form-input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .form-info {
          padding: 12px;
          background: #f0f8ff;
          border-radius: 8px;
          font-size: 13px;
          color: #666;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
        }

        .cancel-button,
        .confirm-button {
          flex: 1;
          padding: 12px;
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

        .confirm-button {
          background: #0088cc;
          color: white;
        }

        .confirm-button:hover:not(:disabled) {
          background: #0066aa;
        }

        .cancel-button:disabled,
        .confirm-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (prefers-color-scheme: dark) {
          .nft-details {
            background: #1a1a1a;
          }

          .details-header {
            background: #2a2a2a;
            border-bottom-color: #444;
          }

          .details-header h2 {
            color: #e0e0e0;
          }

          .back-button {
            color: #4fc3f7;
          }

          .nft-info-section {
            background: #2a2a2a;
          }

          .nft-title {
            color: #e0e0e0;
          }

          .info-label {
            color: #999;
          }

          .info-value {
            color: #e0e0e0;
          }

          .address-value:hover {
            background: #333;
          }

          .attribute-item {
            background: #333;
          }

          .attribute-value {
            color: #e0e0e0;
          }

          .modal-content {
            background: #2a2a2a;
          }

          .modal-header {
            border-bottom-color: #444;
          }

          .modal-header h3 {
            color: #e0e0e0;
          }

          .form-input {
            background: #333;
            border-color: #444;
            color: #e0e0e0;
          }

          .form-input:focus {
            border-color: #0088cc;
          }

          .cancel-button {
            background: #333;
            color: #e0e0e0;
          }
        }
      `}</style>
    </div>
  );
}
