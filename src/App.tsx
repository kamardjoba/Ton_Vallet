import { useEffect } from 'react';
import Wallet from './components/Wallet';
import useWalletStore from './app/store';

function App() {
  const { isUnlocked, lockWallet } = useWalletStore();

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  }, []);

  const handleSendClick = () => {
    // TODO: Implement send modal
    console.log('Send clicked');
  };

  const handleReceiveClick = () => {
    // TODO: Implement receive modal
    console.log('Receive clicked');
  };

  return (
    <div className="app">
      <Wallet onSendClick={handleSendClick} onReceiveClick={handleReceiveClick} />
    </div>
  );
}

export default App;

