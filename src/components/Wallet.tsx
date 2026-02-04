/**
 * Wallet component for TON Wallet Telegram Mini App
 * Main UI component displaying wallet balance, address, and transaction controls
 */

import { useEffect, useState } from 'react';
import useWalletStore from '../app/store';
import { nanoToTon } from '../blockchain/ton';
import QRScanner from './QRScanner';
import DAppConnectionModal from './DAppConnectionModal';
import LogoutModal from './LogoutModal';
import { parseTONConnectURL, decodeTONConnectRequest } from '../utils/tonconnect';

// Token prices in USD (approximate, can be updated from API)
const TOKEN_PRICES: { [key: string]: number } = {
  'TON': 2.5, // Approximate TON price
  'USDT': 1.0,
  'USDC': 1.0,
  'DAI': 1.0,
  'WBTC': 45000, // Approximate BTC price
};

// Cache for token prices
let priceCache: { [key: string]: { price: number; timestamp: number } } = {};
const PRICE_CACHE_DURATION = 300000; // 5 minutes

/**
 * Gets token price in USD
 */
async function getTokenPrice(symbol: string): Promise<number> {
  const cacheKey = symbol.toUpperCase();
  
  // Check cache
  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
    return cached.price;
  }
  
  // Try to get price from API
  try {
    // Use CoinGecko API for TON
    if (cacheKey === 'TON') {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        if (data['the-open-network']?.usd) {
          const price = data['the-open-network'].usd;
          priceCache[cacheKey] = { price, timestamp: Date.now() };
          return price;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to fetch token price from API:', error);
  }
  
  // Use default price if API fails
  const defaultPrice = TOKEN_PRICES[cacheKey] || 0;
  priceCache[cacheKey] = { price: defaultPrice, timestamp: Date.now() };
  return defaultPrice;
}


interface WalletProps {
  onSendClick?: () => void;
  onReceiveClick?: () => void;
  onHistoryClick?: () => void;
  onNFTClick?: () => void;
}

export default function Wallet({ onSendClick, onReceiveClick, onHistoryClick, onNFTClick }: WalletProps) {
  const {
    wallet,
    balance,
    isUnlocked,
    isLoadingBalance,
    error,
    updateBalance,
    clearError,
    hasLoadedBalance,
    jettonTokens,
    isLoadingJettons,
    loadJettons,
  } = useWalletStore();

  const [copied, setCopied] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<{ [key: string]: number }>({});
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showDAppConnection, setShowDAppConnection] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [dAppConnectionData, setDAppConnectionData] = useState<{
    manifestUrl: string;
    requestId: string;
    returnUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (isUnlocked && wallet) {
      // Load all data in parallel for fastest response
      const loadAllData = async () => {
        // Load balance, jettons, and prices in parallel
        await Promise.all([
          updateBalance(),
          loadJettons(),
          (async () => {
            const prices: { [key: string]: number } = {};
            try {
              prices['TON'] = await getTokenPrice('TON');
            } catch (error) {
              prices['TON'] = TOKEN_PRICES['TON'] || 0;
            }
            setTokenPrices(prices);
          })(),
        ]);
      };
      
      loadAllData();
      
      // Auto-refresh balance every 120 seconds (2 minutes) to reduce rate limits
      const interval = setInterval(() => {
        updateBalance();
        loadJettons();
        (async () => {
          const prices: { [key: string]: number } = { ...tokenPrices };
          try {
            prices['TON'] = await getTokenPrice('TON');
          } catch (error) {
            prices['TON'] = TOKEN_PRICES['TON'] || 0;
          }
          setTokenPrices(prices);
        })();
      }, 120000); // 2 minutes to significantly reduce API calls
      return () => clearInterval(interval);
    }
  }, [isUnlocked, wallet?.address]); // Use wallet.address instead of wallet and updateBalance

  // Update prices when jetton tokens change
  useEffect(() => {
    if (jettonTokens.length > 0) {
      const loadPrices = async () => {
        const prices: { [key: string]: number } = { ...tokenPrices };
        // Load prices for all jetton tokens
        for (const token of jettonTokens) {
          if (!prices[token.symbol]) {
            try {
              prices[token.symbol] = await getTokenPrice(token.symbol);
            } catch (error) {
              prices[token.symbol] = TOKEN_PRICES[token.symbol.toUpperCase()] || 0;
            }
          }
        }
        setTokenPrices(prices);
      };
      loadPrices();
    }
  }, [jettonTokens.length]);

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

  const handleQRScanClick = () => {
    setShowQRScanner(true);
  };

  const handleQRScan = (qrData: string) => {
    console.log('QR Code scanned:', qrData);
    setShowQRScanner(false);
    
    // Clean up QR data - remove newlines and extra spaces
    const cleanedQRData = qrData.trim().replace(/\s+/g, '').replace(/\n/g, '');
    console.log('Cleaned QR data:', cleanedQRData);
    
    // First, try to parse as TON Connect URL (tc:// or tonconnect://)
    // Try both original and cleaned versions
    let tonConnectRequest = parseTONConnectURL(cleanedQRData);
    if (!tonConnectRequest) {
      tonConnectRequest = parseTONConnectURL(qrData);
    }
    
    if (tonConnectRequest) {
      // This is a TON Connect request
      handleTONConnectRequest(tonConnectRequest);
      return;
    }
    
    // Parse TON Connect QR code
    // TON Connect QR codes can be in format:
    // - tonconnect://<protocol>?<params>
    // - https://<domain>/ton-connect?<params>
    // - https://getgems.io/... (GetGems and other DApps)
    
    try {
      // Check for TON Connect protocol (also check cleaned version)
      if (cleanedQRData.startsWith('tonconnect://') || cleanedQRData.startsWith('tc://') ||
          qrData.startsWith('tonconnect://') || qrData.startsWith('tc://')) {
        const request = parseTONConnectURL(cleanedQRData) || parseTONConnectURL(qrData);
        if (request) {
          handleTONConnectRequest(request);
          return;
        }
      }
      
      // Check for HTTPS/HTTP URLs
      if (qrData.startsWith('https://') || qrData.startsWith('http://')) {
        try {
          const url = new URL(qrData);
          
          // Check for TON Connect parameters
          const hasTonConnectParams = 
            url.searchParams.has('v') || 
            url.searchParams.has('id') ||
            url.searchParams.has('r') ||
            url.pathname.includes('ton-connect') ||
            url.pathname.includes('tonconnect');
          
          if (hasTonConnectParams) {
            const request = parseTONConnectURL(qrData);
            if (request) {
              handleTONConnectRequest(request);
              return;
            }
          }
          
          // Check for known DApp domains
          const dappDomains = [
            'getgems.io',
            'getgems.org',
            'fragment.com',
            'ton.diamonds',
            'tonapi.io',
          ];
          
          const isKnownDApp = dappDomains.some(domain => 
            url.hostname.includes(domain)
          );
          
          if (isKnownDApp) {
            // Try to parse as TON Connect
            const request = parseTONConnectURL(qrData);
            if (request) {
              handleTONConnectRequest(request);
              return;
            }
            handleDAppConnection(qrData);
            return;
          }
          
          // Generic URL - try as DApp
          const request = parseTONConnectURL(qrData);
          if (request) {
            handleTONConnectRequest(request);
            return;
          }
          handleDAppConnection(qrData);
          return;
        } catch (urlError) {
          console.error('Error parsing URL:', urlError);
          // Fall through to generic handler
        }
      }
      
      // Check if it's a TON address
      if (qrData.match(/^[A-Za-z0-9_-]{48}$/) || 
          qrData.startsWith('EQ') || 
          qrData.startsWith('UQ') ||
          qrData.startsWith('0:')) {
        handleTONAddress(qrData);
        return;
      }
      
      // Try to decode as JSON (some QR codes contain JSON)
      try {
        const jsonData = JSON.parse(qrData);
        if (jsonData.url || jsonData.connect) {
          const request = parseTONConnectURL(jsonData.url || jsonData.connect);
          if (request) {
            handleTONConnectRequest(request);
            return;
          }
        }
      } catch (jsonError) {
        // Not JSON, continue
      }
      
      // Generic handler
      handleGenericQR(qrData);
    } catch (error) {
      console.error('Error processing QR code:', error);
      // Show more helpful error message
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `QR Code Error\n\n` +
          `Scanned: ${qrData.substring(0, 50)}...\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try scanning again or check if the QR code is valid.`
        );
      } else {
        alert(`QR Code Error: ${errorMsg}\n\nScanned: ${qrData.substring(0, 50)}...`);
      }
    }
  };

  const handleTONConnectRequest = async (request: { version: string; requestId: string; request: string }) => {
    try {
      console.log('Processing TON Connect request:', {
        version: request.version,
        requestId: request.requestId,
        requestLength: request.request.length,
        requestPreview: request.request.substring(0, 200) + '...',
      });

      // Decode the request
      const decodedRequest = decodeTONConnectRequest(request.request);
      
      console.log('Decoded request:', decodedRequest);

      if (!decodedRequest) {
        throw new Error('Failed to decode TON Connect request');
      }

      // Extract manifestUrl - it might be in different places
      const manifestUrl = decodedRequest.manifestUrl || 
                         decodedRequest.manifest?.url ||
                         decodedRequest.url;

      // Extract returnUrl/callbackUrl for sending response back
      const returnUrl = decodedRequest.returnUrl || 
                       decodedRequest.return_url ||
                       decodedRequest.callbackUrl ||
                       decodedRequest.callback_url;

      if (!manifestUrl) {
        console.error('Decoded request structure:', decodedRequest);
        throw new Error('Invalid TON Connect request: missing manifestUrl');
      }

      console.log('TON Connect request decoded successfully:', {
        version: request.version,
        requestId: request.requestId,
        manifestUrl: manifestUrl,
        returnUrl: returnUrl,
        fullRequest: decodedRequest,
      });

      // Show connection modal
      setDAppConnectionData({
        manifestUrl: manifestUrl,
        requestId: request.requestId,
        returnUrl: returnUrl, // Pass returnUrl to modal
      });
      setShowDAppConnection(true);
    } catch (error) {
      console.error('Error handling TON Connect request:', error);
      console.error('Request object:', request);
      const errorMsg = error instanceof Error ? error.message : 'Failed to process connection request';
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `Connection Error\n\n${errorMsg}\n\nPlease try scanning the QR code again.\n\nIf the problem persists, make sure you're scanning a valid TON Connect QR code.`
        );
      } else {
        alert(`Connection Error: ${errorMsg}`);
      }
    }
  };

  const handleTONConnect = (connectUrl: string) => {
    // Parse TON Connect URL
    // Format: tonconnect://<protocol>?v=2&id=<request_id>&r=<request>
    // or: https://<domain>/ton-connect?<params>
    // GetGems and other DApps use: https://getgems.io/...
    
    try {
      let url: URL;
      let isTonConnectProtocol = false;
      
      if (connectUrl.startsWith('tonconnect://')) {
        isTonConnectProtocol = true;
        // Convert tonconnect:// to https:// for parsing
        const httpsUrl = connectUrl.replace('tonconnect://', 'https://');
        url = new URL(httpsUrl);
      } else {
        url = new URL(connectUrl);
      }

      const version = url.searchParams.get('v') || url.searchParams.get('version') || '2';
      const requestId = url.searchParams.get('id') || url.searchParams.get('requestId');
      const request = url.searchParams.get('r') || url.searchParams.get('request');
      const domain = url.hostname;

      console.log('TON Connect params:', { 
        version, 
        requestId, 
        request: request ? request.substring(0, 50) + '...' : null,
        domain,
        fullUrl: connectUrl.substring(0, 100) + '...'
      });

      // Determine DApp name from domain
      let dappName = 'Unknown DApp';
      if (domain.includes('getgems')) {
        dappName = 'GetGems';
      } else if (domain.includes('fragment')) {
        dappName = 'Fragment';
      } else if (domain.includes('ton.diamonds')) {
        dappName = 'TON Diamonds';
      } else {
        dappName = domain.split('.')[0] || 'DApp';
      }

      // Here you would implement TON Connect protocol
      // For now, show a message to the user with connection details
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `🔗 ${dappName} Connection Request\n\n` +
          `Version: ${version}\n` +
          `Request ID: ${requestId || 'N/A'}\n` +
          `Domain: ${domain}\n\n` +
          `TON Connect integration is coming soon!\n\n` +
          `This will allow you to connect your wallet to ${dappName} and interact with DApps.`
        );
      } else {
        alert(
          `TON Connect request from ${dappName}!\n\n` +
          `Version: ${version}\n` +
          `Request ID: ${requestId || 'N/A'}\n` +
          `Domain: ${domain}`
        );
      }
    } catch (error) {
      console.error('Error parsing TON Connect URL:', error);
      console.error('Original URL:', connectUrl);
      
      // Try to extract domain even if parsing fails
      const domainMatch = connectUrl.match(/https?:\/\/([^\/]+)/);
      const domain = domainMatch ? domainMatch[1] : 'unknown';
      
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `⚠️ Connection Request\n\n` +
          `Domain: ${domain}\n\n` +
          `This appears to be a DApp connection request.\n\n` +
          `TON Connect integration is coming soon!`
        );
      } else {
        alert(`Connection request from ${domain}`);
      }
    }
  };

  const handleDAppConnection = (dappUrl: string) => {
    // Handle DApp connection
    console.log('DApp connection:', dappUrl);
    
    try {
      const url = new URL(dappUrl);
      const domain = url.hostname;
      
      // Determine DApp name
      let dappName = 'DApp';
      if (domain.includes('getgems')) {
        dappName = 'GetGems';
      } else if (domain.includes('fragment')) {
        dappName = 'Fragment';
      } else {
        dappName = domain.split('.')[0] || 'DApp';
      }
      
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `🔗 ${dappName} Connection\n\n` +
          `URL: ${domain}\n\n` +
          `DApp integration is coming soon!\n\n` +
          `This will allow you to connect your wallet to ${dappName}.`
        );
      } else {
        alert(`DApp connection: ${dappName} (${domain})`);
      }
    } catch (error) {
      console.error('Error parsing DApp URL:', error);
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `DApp connection detected!\n\n` +
          `URL: ${dappUrl.substring(0, 50)}...\n\n` +
          `DApp integration is coming soon!`
        );
      } else {
        alert(`DApp connection: ${dappUrl.substring(0, 50)}...`);
      }
    }
  };

  const handleTONAddress = (address: string) => {
    // Handle TON address QR code
    console.log('TON Address detected:', address);
    
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      // Telegram WebApp doesn't have showConfirm, use showAlert with callback
      window.Telegram.WebApp.showAlert(
        `TON Address detected!\n\n` +
        `${address}\n\n` +
        `Would you like to send TON to this address?\n\n` +
        `Press OK to open Send screen.`,
        () => {
          if (onSendClick) {
            // Pre-fill send modal with this address
            // This would require passing the address to SendModal
            onSendClick();
          }
        }
      );
    } else {
      const confirmed = confirm(`TON Address: ${address}\n\nWould you like to send TON to this address?`);
      if (confirmed && onSendClick) {
        onSendClick();
      }
    }
  };

  const handleGenericQR = (qrData: string) => {
    // Handle generic QR code (could be address, etc.)
    console.log('Generic QR code:', qrData);
    
    // Show the scanned data to user
    // Try to use Telegram WebApp alert, but fallback to console if not supported
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        // Check if showAlert is available
        if (typeof tg.showAlert === 'function') {
          tg.showAlert(
            `QR Code scanned:\n\n` +
            `${qrData.substring(0, 100)}${qrData.length > 100 ? '...' : ''}\n\n` +
            `Format: Unknown\n\n` +
            `TON Connect integration coming soon!`
          );
        } else {
          console.log('QR Code scanned (showAlert not available):', qrData.substring(0, 100));
        }
      } else {
        alert(`QR Code: ${qrData.substring(0, 100)}${qrData.length > 100 ? '...' : ''}`);
      }
    } catch (error) {
      // If showAlert fails, just log to console
      console.log('QR Code scanned (error showing alert):', qrData.substring(0, 100));
    }
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

  // Create TON token object to display in tokens list
  const tonToken = {
    address: wallet.address,
    symbol: 'TON',
    name: 'TON',
    decimals: 9,
    balance: balanceTon,
    image: 'https://cryptologos.cc/logos/toncoin-ton-logo.svg?v=040',
    verified: true,
  };

  // Combine TON with other jetton tokens (TON always first)
  const allTokens = [tonToken, ...jettonTokens];
  
  // Always show tokens section if we have TON balance or other tokens
  const hasTokens = parseFloat(balanceTon) > 0 || jettonTokens.length > 0;

  return (
    <>
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />
      {dAppConnectionData && wallet && (
        <DAppConnectionModal
          isOpen={showDAppConnection}
          manifestUrl={dAppConnectionData.manifestUrl}
          requestId={dAppConnectionData.requestId}
          returnUrl={dAppConnectionData.returnUrl}
          walletAddress={wallet.address}
          walletPublicKey={wallet.publicKey}
          onConnected={() => {
            setShowDAppConnection(false);
            setDAppConnectionData(null);
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
              try {
                window.Telegram.WebApp.showAlert('Successfully connected to DApp!');
              } catch (e) {
                console.log('showAlert not supported:', e);
              }
            }
          }}
          onCancel={() => {
            setShowDAppConnection(false);
            setDAppConnectionData(null);
          }}
        />
      )}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={() => {
          setShowLogoutModal(false);
          // Wallet will be locked, App.tsx will handle showing login screen
        }}
      />
      <div className="wallet-container">
      {error && (
        <div className="error-banner" onClick={clearError}>
          <span>{error}</span>
          <button className="error-close">×</button>
        </div>
      )}

      <div className="wallet-header">
        <h2>TON Wallet</h2>
        <div className="wallet-header-actions">
          <button
            className="qr-scan-button"
            onClick={handleQRScanClick}
            title="Scan QR Code"
          >
            <span className="qr-scan-icon">📷</span>
          </button>
          <button
            className="logout-button-header"
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
          >
            <span className="logout-icon-header">🚪</span>
          </button>
        </div>
      </div>

      <div className="wallet-address">
        <div className="address-label">Address</div>
        <div className="address-value" onClick={handleCopyAddress}>
          <code>{formatAddress(wallet.address)}</code>
          <span className="copy-indicator">{copied ? '✓ Copied' : '📋'}</span>
        </div>
      </div>

      <div className="wallet-balance">
        <div className="balance-label">Balance</div>
        <div className="balance-value">
          {isLoadingBalance && !hasLoadedBalance ? (
            <span className="loading">Loading...</span>
          ) : (
            <>
              <span className="amount">{balanceTon}</span>
              <span className="currency">TON</span>
            </>
          )}
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

      {/* Tokens Section */}
      {(hasTokens || isLoadingJettons) && (
        <div className="tokens-section">
          <div className="tokens-header">
            <h3>Tokens</h3>
          </div>
          {isLoadingJettons && jettonTokens.length === 0 ? (
            <div className="tokens-loading">
              <div className="loading-wrapper">
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
              </div>
              <p className="loading-text">Loading tokens...</p>
            </div>
          ) : allTokens.length > 0 ? (
            <>
              <div className="tokens-list">
                {(showAllTokens ? allTokens : allTokens.slice(0, 3)).map((token, index) => {
                  // Use alternative icon for TON if main one is not available
                  const iconUrl = token.symbol === 'TON' && !token.image 
                    ? 'https://raw.githubusercontent.com/ton-blockchain/ton-assets/main/icons/ton/ton_symbol.svg'
                    : token.image;
                  
                  return (
                    <div key={token.address || index} className="token-item">
                      <div className="token-icon">
                        {iconUrl ? (
                          <img 
                            src={iconUrl} 
                            alt={token.symbol}
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.style.display = 'none';
                              const fallback = img.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                            onLoad={(e) => {
                              // Hide fallback when image loads successfully
                              const img = e.target as HTMLImageElement;
                              if (img) {
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.add('hidden');
                              }
                            }}
                          />
                        ) : null}
                        <div className={`token-icon-fallback ${iconUrl ? 'hidden' : ''}`}>
                          {token.symbol === 'TON' ? '💎' : token.symbol[0]?.toUpperCase() || '?'}
                        </div>
                      </div>
                      <div className="token-info">
                        <div className="token-name-row">
                          <span className="token-name">{token.name}</span>
                          {token.verified && <span className="token-verified">✓</span>}
                        </div>
                        <span className="token-symbol">{token.symbol}</span>
                      </div>
                      <div className="token-balance">
                        <span className="balance-amount">{token.balance}</span>
                        <span className="balance-usd">
                          {(() => {
                            const balanceNum = parseFloat(token.balance) || 0;
                            const price = tokenPrices[token.symbol] || TOKEN_PRICES[token.symbol.toUpperCase()] || 0;
                            const usdValue = balanceNum * price;
                            if (usdValue < 0.01) return '<$0.01';
                            if (usdValue < 1) return `$${usdValue.toFixed(2)}`;
                            if (usdValue < 1000) return `$${usdValue.toFixed(2)}`;
                            return `$${(usdValue / 1000).toFixed(2)}K`;
                          })()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {allTokens.length > 3 && (
                <button 
                  className="show-more-tokens-button"
                  onClick={() => setShowAllTokens(!showAllTokens)}
                >
                  {showAllTokens ? 'Show Less' : `Show More (${allTokens.length - 3})`}
                </button>
              )}
            </>
          ) : (
            <div className="tokens-loading">
              <p>Loading tokens...</p>
            </div>
          )}
        </div>
      )}

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
          className="nav-button nav-button-active"
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

      <style>{`
        .wallet-container {
          padding: 16px;
          padding-bottom: 120px;
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .wallet-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          flex: 1;
        }

        .wallet-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }

        .qr-scan-button,
        .logout-button-header {
          background: rgba(102, 126, 234, 0.1);
          border: none;
          border-radius: 12px;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
          flex-shrink: 0;
        }

        .qr-scan-button:hover,
        .logout-button-header:hover {
          background: rgba(102, 126, 234, 0.2);
          transform: scale(1.05);
        }

        .qr-scan-button:active,
        .logout-button-header:active {
          transform: scale(0.95);
        }

        .logout-button-header {
          background: rgba(198, 40, 40, 0.1);
        }

        .logout-button-header:hover {
          background: rgba(198, 40, 40, 0.2);
        }

        .qr-scan-icon,
        .logout-icon-header {
          font-size: 24px;
        }

        .wallet-balance {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 24px;
          color: white;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 16px;
          border: 2px solid rgba(102, 126, 234, 0.1);
          transition: all 0.3s;
        }

        .wallet-address:hover {
          border-color: rgba(102, 126, 234, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .address-label {
          font-size: 11px;
          color: #666;
          margin-bottom: 6px;
        }

        .address-value {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .address-value code {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #333;
          word-break: break-all;
        }

        .copy-indicator {
          font-size: 14px;
          color: #667eea;
          margin-left: 8px;
          flex-shrink: 0;
        }

        .wallet-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .tokens-section {
          margin-bottom: 24px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 20px;
          padding: 20px;
          border: 2px solid rgba(102, 126, 234, 0.1);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .tokens-header {
          margin-bottom: 16px;
        }

        .tokens-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .tokens-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .token-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 2px solid rgba(102, 126, 234, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .token-item:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(102, 126, 234, 0.4);
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.25);
        }

        .token-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }

        .token-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .token-icon-fallback {
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .token-icon-fallback.hidden {
          display: none;
        }

        .token-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .token-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .token-name {
          font-size: 15px;
          font-weight: 600;
          color: #333;
        }

        .token-verified {
          color: #667eea;
          font-size: 14px;
        }

        .token-symbol {
          font-size: 13px;
          color: #666;
        }

        .token-balance {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .balance-amount {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .balance-usd {
          font-size: 12px;
          color: #666;
          font-weight: 400;
        }

        .tokens-loading {
          padding: 40px 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .tokens-loading .loading-wrapper {
          position: relative;
          width: 60px;
          height: 60px;
          margin-bottom: 16px;
        }

        .tokens-loading .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .tokens-loading .spinner-ring:nth-child(1) {
          animation-delay: -0.45s;
          border-top-color: #667eea;
        }

        .tokens-loading .spinner-ring:nth-child(2) {
          animation-delay: -0.3s;
          border-top-color: #764ba2;
          width: 50px;
          height: 50px;
          top: 5px;
          left: 5px;
        }

        .tokens-loading .spinner-ring:nth-child(3) {
          animation-delay: -0.15s;
          border-top-color: #667eea;
          width: 40px;
          height: 40px;
          top: 10px;
          left: 10px;
        }

        .tokens-loading .spinner-ring:nth-child(4) {
          border-top-color: #764ba2;
          width: 30px;
          height: 30px;
          top: 15px;
          left: 15px;
        }

        .tokens-loading .loading-text {
          font-size: 14px;
          font-weight: 500;
          color: #667eea;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .show-more-tokens-button {
          width: 100%;
          padding: 12px;
          margin-top: 12px;
          background: rgba(255, 255, 255, 0.5);
          border: 2px solid rgba(102, 126, 234, 0.2);
          border-radius: 12px;
          color: #667eea;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
        }

        .show-more-tokens-button:hover {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(102, 126, 234, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .show-more-tokens-button:active {
          transform: translateY(0);
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

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 22px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .action-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .action-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .receive-button {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }

        .receive-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(17, 153, 142, 0.5);
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

          .tokens-section {
            background: linear-gradient(135deg, #2a2a2a 0%, #1a1a2e 100%);
            border-color: rgba(102, 126, 234, 0.2);
          }

          .tokens-header h3 {
            color: #e0e0e0;
          }

          .token-item {
            background: rgba(42, 42, 42, 0.7);
            border-color: rgba(102, 126, 234, 0.2);
          }

          .token-item:hover {
            background: rgba(42, 42, 42, 0.9);
          }

          .token-name {
            color: #e0e0e0;
          }

          .token-symbol {
            color: #999;
          }

          .balance-amount {
            color: #e0e0e0;
          }

          .balance-usd {
            color: #999;
          }

          .show-more-tokens-button {
            background: rgba(42, 42, 42, 0.5);
            border-color: rgba(102, 126, 234, 0.3);
            color: #667eea;
          }

          .show-more-tokens-button:hover {
            background: rgba(42, 42, 42, 0.7);
            border-color: rgba(102, 126, 234, 0.5);
          }
        }
      `}</style>
      </div>
    </>
  );
}

