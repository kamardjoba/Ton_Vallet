# TON Wallet Telegram Mini App

A secure, serverless cryptocurrency wallet for the TON blockchain, built as a Telegram Mini App. This wallet enables users to manage their TON assets directly within Telegram without requiring any additional installations.

## 🌟 Features

### Core Functionality
- **Wallet Management**
  - Create new wallet with 24-word BIP39 seed phrase generation
  - Restore existing wallet from seed phrase
  - Secure wallet locking/unlocking with password protection
  - Encrypted seed phrase storage using AES-GCM encryption

- **Transaction Management**
  - Send TON to any TON address
  - Receive TON with QR code and address display
  - Transaction history with detailed information
  - Real-time balance updates
  - Transaction comments support

- **Token Support**
  - Automatic Jetton token detection
  - Display token balances and USD values
  - Support for multiple Jetton tokens
  - Token price fetching from CoinGecko API

- **NFT Support**
  - Automatic NFT collection detection
  - NFT metadata display (name, description, image, attributes)
  - IPFS metadata resolution
  - NFT collection browsing

- **TON Connect Integration**
  - Connect to decentralized applications (dApps)
  - QR code scanning for TON Connect requests
  - DApp connection modal with manifest verification

- **Security Features**
  - AES-GCM encryption for seed phrase (256-bit key)
  - PBKDF2 key derivation (100,000 iterations)
  - Local storage only (no server-side data storage)
  - XSS and timing attack protection
  - Rate limiting for API requests
  - Constant-time password comparison

## 🛠️ Technology Stack

### Frontend
- **React 18.2.0** - UI library
- **TypeScript 5.2.2** - Type safety
- **Vite 5.0** - Build tool and dev server
- **Zustand 4.4.7** - State management
- **CSS3** - Styling with modern features

### Blockchain Integration
- **@ton/core 0.57.0** - TON blockchain core library
- **@ton/crypto 3.2.0** - Cryptographic functions (mnemonic, key generation)
- **tonweb 0.0.65** - TON blockchain API client

### Security
- **WebCrypto API** - Native browser cryptography
- **AES-GCM** - Symmetric encryption
- **PBKDF2** - Key derivation function

### Telegram Integration
- **Telegram Mini App API** - Native Telegram integration
- **Telegram WebApp** - Theme, back button, haptic feedback

## 📋 Prerequisites

- **Node.js** 20.x or higher
- **npm** or **yarn** package manager
- **Telegram** app (for testing Mini App)
- Modern browser with WebCrypto API support

## 🚀 Installation

### Clone the Repository

```bash
git clone <repository-url>
cd Wallet_Ton_Uni
```

### Install Dependencies

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

Build the application for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
```

### Linting

Run ESLint:

```bash
npm run lint
```

## 📁 Project Structure

```
Wallet_Ton_Uni/
├── src/
│   ├── app/
│   │   └── store.ts              # Zustand store for state management
│   ├── blockchain/
│   │   └── ton.ts                # TON blockchain integration
│   ├── components/
│   │   ├── Wallet.tsx            # Main wallet component
│   │   ├── InitializeWallet.tsx  # Wallet creation component
│   │   ├── UnlockWallet.tsx      # Wallet unlock component
│   │   ├── RestoreWallet.tsx     # Wallet restoration component
│   │   ├── SendModal.tsx         # Send transaction modal
│   │   ├── ReceiveModal.tsx      # Receive transaction modal
│   │   ├── TransactionHistory.tsx # Transaction history component
│   │   ├── NFTCollection.tsx     # NFT collection component
│   │   ├── NFTDetails.tsx        # NFT details component
│   │   ├── QRScanner.tsx         # QR code scanner
│   │   ├── DAppConnectionModal.tsx # TON Connect modal
│   │   └── ...                   # Other components
│   ├── crypto/
│   │   └── crypto.ts             # Encryption/decryption module
│   ├── utils/
│   │   ├── validation.ts         # Input validation utilities
│   │   ├── security.ts           # Security utilities
│   │   ├── errors.ts             # Error handling utilities
│   │   ├── telegram.ts           # Telegram API integration
│   │   └── tonconnect.ts         # TON Connect utilities
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Application entry point
│   ├── polyfills.ts              # Node.js polyfills (Buffer, process)
│   └── index.css                 # Global styles
├── dist/                         # Production build output
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── netlify.toml                  # Netlify deployment configuration
└── package.json                  # Project dependencies
```

## 🔐 Security

### Encryption
- Seed phrases are encrypted using **AES-GCM** with a 256-bit key
- Encryption key is derived from user password using **PBKDF2** with 100,000 iterations
- Each encryption uses a unique salt and IV (Initialization Vector)
- Encrypted data is stored only in browser's localStorage

### Data Storage
- **Private keys** are never stored - only encrypted seed phrase
- **Sensitive data** is cleared from memory when wallet is locked
- **No server-side storage** - all data stays on user's device
- **LocalStorage** is used only for encrypted seed phrase

### Security Measures
- **XSS Protection**: Input sanitization and React's automatic escaping
- **Timing Attack Protection**: Constant-time string comparison
- **Rate Limiting**: 10 requests per minute per wallet
- **Password Validation**: Minimum 8 characters, strength checking
- **Address Validation**: Format validation before transactions

## 💻 Usage

### Creating a New Wallet

1. Open the Telegram Mini App
2. Click "Create Wallet"
3. Enter a password (minimum 8 characters)
4. Confirm the password
5. **Save the 24-word seed phrase** in a secure location
6. Confirm that you've saved the seed phrase
7. Click "Create Wallet"

⚠️ **Important**: The seed phrase is the only way to restore your wallet. If you lose it, you'll lose access to your wallet and funds.

### Restoring a Wallet

1. Open the app
2. Click "Restore Wallet"
3. Enter your 24-word seed phrase
4. Enter a new password
5. Confirm the password
6. Click "Restore"

### Sending TON

1. Unlock your wallet
2. Click "Send"
3. Enter recipient address
4. Enter amount (in TON)
5. (Optional) Add a comment
6. Enter your password
7. Click "Send"

### Receiving TON

1. Unlock your wallet
2. Click "Receive"
3. Copy the address or share the QR code
4. Send the address/QR code to the sender

### Viewing Transaction History

1. Unlock your wallet
2. Click "History" in the bottom navigation
3. Browse your transactions
4. Click on a transaction to see details

### Managing NFTs

1. Unlock your wallet
2. Click "NFT" in the bottom navigation
3. Browse your NFT collection
4. Click on an NFT to see details

## 🔧 Configuration

### API Endpoints

The application uses the following TON API endpoints (configurable in `src/blockchain/ton.ts`):

- **Primary**: `https://toncenter.com/api/v2/jsonRPC`
- **NFT API**: `https://tonapi.io/v2/`
- **Price API**: `https://api.coingecko.com/api/v3/`

### Environment Variables

Currently, the application uses public API endpoints. For production, you may want to:

1. Set up your own TON API proxy
2. Add API keys for rate limit increases
3. Configure custom endpoints

## 🧪 Testing

### Manual Testing

The application has been tested for:

- ✅ Wallet creation and restoration
- ✅ Transaction sending and receiving
- ✅ Balance updates
- ✅ NFT and Jetton token detection
- ✅ Security features (encryption, validation)
- ✅ Error handling
- ✅ Performance optimization

### Test Scenarios

1. **Create Wallet**: Generate new wallet with seed phrase
2. **Restore Wallet**: Restore from existing seed phrase
3. **Send Transaction**: Send TON to another address
4. **Receive Transaction**: Receive TON and verify balance update
5. **View History**: Check transaction history accuracy
6. **NFT Display**: Verify NFT metadata loading
7. **Token Display**: Verify Jetton token detection

## 🚢 Deployment

### Netlify

The project includes `netlify.toml` configuration for easy deployment:

```bash
# Build command is already configured
npm run build
```

Deploy to Netlify:
1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy

### Other Platforms

The application can be deployed to any static hosting service:

- **Vercel**: `vercel --prod`
- **GitHub Pages**: Configure in repository settings
- **Cloudflare Pages**: Connect repository
- **Any static host**: Upload `dist/` folder contents

## 🐛 Troubleshooting

### Common Issues

**Problem**: App doesn't load
- **Solution**: Check internet connection, clear browser cache, ensure browser supports WebCrypto API

**Problem**: Can't unlock wallet
- **Solution**: Verify password is correct, check if wallet was properly initialized

**Problem**: Transaction failed
- **Solution**: Check internet connection, verify sufficient balance, confirm recipient address is valid

**Problem**: Balance not updating
- **Solution**: Refresh the app, check internet connection, wait a few minutes

**Problem**: NFTs not showing
- **Solution**: Verify wallet actually has NFTs (check on TONScan), refresh app, check internet connection

### Rate Limiting

If you encounter rate limit errors:
- Wait 1-2 minutes before retrying
- The app implements automatic retry with exponential backoff
- Cached data will be used when available

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all new files
- Follow React best practices (hooks, functional components)
- Use ESLint for code quality
- Write descriptive commit messages

### Adding New Features

1. Create feature branch: `git checkout -b feature/your-feature`
2. Implement feature with tests
3. Run type checking: `npm run type-check`
4. Run linter: `npm run lint`
5. Submit pull request

### Security Considerations

- Never log sensitive data (passwords, private keys, seed phrases)
- Always validate user input
- Use constant-time comparisons for passwords
- Implement rate limiting for API calls
- Sanitize data before displaying

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **TON Foundation** - For the TON blockchain
- **Telegram** - For the Mini App platform
- **Open Source Community** - For the excellent libraries used in this project

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review the code comments

## 🔮 Future Enhancements

Planned features for future releases:

- [ ] Full TON Connect protocol implementation
- [ ] TON staking support
- [ ] Token swapping functionality
- [ ] Push notifications via Telegram
- [ ] Multi-wallet support
- [ ] Hardware wallet integration
- [ ] Advanced analytics and charts
- [ ] DeFi protocol integration
- [ ] Multi-chain support

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Users are responsible for:
- Securing their seed phrases
- Verifying transaction details before sending
- Understanding the risks of cryptocurrency transactions
- Complying with local regulations

**Always test with small amounts first!**

---

**Built with ❤️ for the TON ecosystem**
