/**
 * Telegram Bot for TON Wallet
 * Responds to /start command and provides a button to open the web application
 */

// Use createRequire to import CommonJS module in ES module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');

// Replace with your bot token from @BotFather
const BOT_TOKEN = process.env.BOT_TOKEN || '8151674191:AAG0YD7gweXcqZ7cHckMf15ny86fRIG5nvE';

// URL of your web application (replace with your Netlify URL or other hosting)
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://tonvallet.netlify.app';

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Handler for /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'User';

  const welcomeMessage = `👋 Hello, ${firstName}!

💰 Welcome to TON Wallet!

This is a secure wallet for working with TON cryptocurrency (The Open Network). 

🔐 Main Features:
• Create new wallet
• Restore wallet from seed phrase
• Send and receive TON
• View transaction history
• Manage NFT collections
• Work with Jetton tokens

🛡️ Security:
• Your private keys are stored only on your device
• Seed phrase is encrypted with a password
• All operations are performed locally in the browser

Click the button below to open the wallet:`;

  // Create inline keyboard with button to open web application
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Open TON Wallet',
            web_app: { url: WEB_APP_URL }
          }
        ],
        [
          {
            text: '📖 Help',
            callback_data: 'help'
          },
          {
            text: 'ℹ️ About Wallet',
            callback_data: 'about'
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeMessage, options);
});

// Handler for callback buttons
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'help') {
    const helpMessage = `📖 TON Wallet Usage Guide

🔹 Creating a Wallet:
1. Click "Open TON Wallet"
2. Select "Create Wallet"
3. Create a strong password (minimum 8 characters)
4. Save your seed phrase in a safe place
5. Confirm your seed phrase

🔹 Restoring a Wallet:
1. Click "Restore Wallet"
2. Enter your seed phrase (24 words)
3. Create a new password

🔹 Sending TON:
1. Unlock your wallet
2. Click "Send"
3. Enter recipient address
4. Enter amount
5. Confirm transaction

⚠️ Important:
• Never share your seed phrase
• Store your seed phrase in a safe place
• Use a strong password`;

    bot.sendMessage(chatId, helpMessage);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'about') {
    const aboutMessage = `ℹ️ About TON Wallet

TON Wallet is a secure and convenient wallet for working with TON cryptocurrency (The Open Network).

🌐 Technologies:
• React + TypeScript
• TON Blockchain
• Telegram Mini App API
• Web Crypto API for security

🔒 Security:
• All operations are performed locally
• Private keys never leave your device
• Encryption using AES-GCM
• Protection against timing attacks

💡 Features:
• Works directly in Telegram
• No installation required
• NFT support
• Jetton token support
• Transaction history

Version: 1.0.0`;

    bot.sendMessage(chatId, aboutMessage);
    bot.answerCallbackQuery(query.id);
  }
});

// Handler for /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Use the /start command to begin working with the bot.');
});

// Error handler
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Bot startup handler
console.log('🤖 TON Wallet Bot started!');
console.log(`📱 Web App URL: ${WEB_APP_URL}`);
console.log('Waiting for messages...');

// Export for use in other modules (if needed)
export default bot;
