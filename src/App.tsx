import { useEffect, useState } from 'react';
import Wallet from './components/Wallet';
import UnlockWallet from './components/UnlockWallet';
import InitializeWallet from './components/InitializeWallet';
import RestoreWallet from './components/RestoreWallet';
import SendModal from './components/SendModal';
import ReceiveModal from './components/ReceiveModal';
import useWalletStore from './app/store';

function App() {
  const { isInitialized, isUnlocked } = useWalletStore();
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [showRestore, setShowRestore] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  }, []);

  const handleSendClick = () => {
    setIsSendModalOpen(true);
  };

  const handleReceiveClick = () => {
    setIsReceiveModalOpen(true);
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
            Восстановить кошелек
          </button>
        </div>
      </>
    );
  }

  // Show unlock screen if wallet is initialized but locked
  if (!isUnlocked) {
    return <UnlockWallet onUnlock={() => {}} />;
  }

  // Show wallet if unlocked
  return (
    <div className="app">
      <Wallet onSendClick={handleSendClick} onReceiveClick={handleReceiveClick} />
      <SendModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} />
      <ReceiveModal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} />
    </div>
  );
}

export default App;

