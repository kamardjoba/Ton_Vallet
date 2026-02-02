import { useEffect, useState } from 'react';
import Wallet from './components/Wallet';
import UnlockWallet from './components/UnlockWallet';
import InitializeWallet from './components/InitializeWallet';
import RestoreWallet from './components/RestoreWallet';
import SendModal from './components/SendModal';
import ReceiveModal from './components/ReceiveModal';
import TransactionHistory from './components/TransactionHistory';
import NFTCollection from './components/NFTCollection';
import NFTDetails from './components/NFTDetails';
import useWalletStore from './app/store';
import type { NFTItem } from './blockchain/ton';
import { Theme, BackButton } from './utils/telegram';

// Wrapper components for BackButton integration
function TransactionHistoryView({ 
  onBack, 
  onNFTClick 
}: { 
  onBack: () => void;
  onNFTClick: () => void;
}) {
  useEffect(() => {
    BackButton.show(onBack);
    return () => BackButton.hide();
  }, [onBack]);

  return (
    <TransactionHistory 
      onBack={onBack}
      onWalletClick={onBack}
      onNFTClick={onNFTClick}
    />
  );
}

function NFTDetailsView({ nft, onBack }: { nft: NFTItem; onBack: () => void }) {
  useEffect(() => {
    BackButton.show(onBack);
    return () => BackButton.hide();
  }, [onBack]);

  return <NFTDetails nft={nft} onBack={onBack} />;
}

function NFTCollectionView({ 
  onBack, 
  onNFTClick, 
  onWalletClick, 
  onHistoryClick 
}: { 
  onBack: () => void;
  onNFTClick: (nft: NFTItem) => void;
  onWalletClick: () => void;
  onHistoryClick: () => void;
}) {
  useEffect(() => {
    BackButton.show(onBack);
    return () => BackButton.hide();
  }, [onBack]);

  return (
    <NFTCollection 
      onBack={onBack}
      onNFTClick={onNFTClick}
      onWalletClick={onWalletClick}
      onHistoryClick={onHistoryClick}
    />
  );
}

function App() {
  const { isInitialized, isUnlocked } = useWalletStore();
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNFT, setShowNFT] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [showRestore, setShowRestore] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Apply Telegram theme
      Theme.applyTheme();
      
      // Listen for theme changes
      const handleThemeChange = () => {
        Theme.applyTheme();
      };
      
      // Note: Telegram WebApp doesn't have a direct theme change event,
      // but we can check on visibility change
      document.addEventListener('visibilitychange', handleThemeChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleThemeChange);
      };
    }
  }, []);

  const handleSendClick = () => {
    setIsSendModalOpen(true);
  };

  const handleReceiveClick = () => {
    setIsReceiveModalOpen(true);
  };

  const handleHistoryClick = () => {
    setShowHistory(true);
  };

  const handleNFTClick = () => {
    setShowNFT(true);
    setSelectedNFT(null);
  };

  const handleNFTSelect = (nft: NFTItem) => {
    setSelectedNFT(nft);
  };

  const handleNFTBack = () => {
    if (selectedNFT) {
      setSelectedNFT(null);
    } else {
      setShowNFT(false);
    }
  };

  // Show initialization screen if wallet is not initialized
  if (!isInitialized) {
    if (showRestore) {
      return (
        <RestoreWallet
          onRestored={() => setShowRestore(false)}
          onBack={() => setShowRestore(false)}
        />
      );
    }
    return (
      <>
        <InitializeWallet onInitialized={() => {}} />
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <button
            onClick={() => setShowRestore(true)}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: '2px solid #0088cc',
              color: '#0088cc',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Restore Wallet
          </button>
        </div>
      </>
    );
  }

  // Show unlock screen if wallet is initialized but locked
  if (!isUnlocked) {
    return <UnlockWallet onUnlock={() => {}} />;
  }

  // Show transaction history if requested
  if (showHistory) {
    return (
      <TransactionHistoryView 
        onBack={() => setShowHistory(false)}
        onNFTClick={() => {
          setShowHistory(false);
          setShowNFT(true);
        }}
      />
    );
  }

  // Show NFT details if selected
  if (showNFT && selectedNFT) {
    return <NFTDetailsView nft={selectedNFT} onBack={handleNFTBack} />;
  }

  // Show NFT collection if requested
  if (showNFT) {
    return (
      <NFTCollectionView
        onBack={handleNFTBack}
        onNFTClick={handleNFTSelect}
        onWalletClick={() => setShowNFT(false)}
        onHistoryClick={() => {
          setShowNFT(false);
          setShowHistory(true);
        }}
      />
    );
  }

  // Show wallet if unlocked
  return (
    <div className="app">
      <Wallet 
        onSendClick={handleSendClick} 
        onReceiveClick={handleReceiveClick}
        onHistoryClick={handleHistoryClick}
        onNFTClick={handleNFTClick}
      />
      <SendModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} />
      <ReceiveModal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} />
    </div>
  );
}

export default App;

