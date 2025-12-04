# TON Wallet Telegram Mini App

Безсерверный криптокошелёк TON для Telegram Mini Apps.

## Технологии

- **Frontend**: React 18 + TypeScript + Vite
- **Blockchain**: TonWeb + @ton/core + @ton/crypto
- **Crypto**: WebCrypto API (AES-GCM, PBKDF2)
- **State Management**: Zustand
- **Mini App**: Telegram WebApp API

## Структура проекта

```
src/
├── app/
│   └── store.ts              # Zustand store для управления состоянием
├── blockchain/
│   └── ton.ts                # Интеграция с TON blockchain
├── crypto/
│   └── crypto.ts             # Шифрование seed phrase (AES-GCM)
├── components/
│   └── Wallet.tsx            # Основной компонент кошелька
├── polyfills.ts              # Полифиллы для Node.js API (Buffer, process)
├── App.tsx                    # Корневой компонент
├── main.tsx                   # Точка входа
└── index.css                  # Глобальные стили
```

## Установка

```bash
npm install
```

**Важно**: Проект использует полифиллы для Node.js API (Buffer, process) для работы `tonweb` в браузере. Полифиллы автоматически инициализируются при запуске приложения.

## Разработка

```bash
npm run dev
```

## Сборка

```bash
npm run build
```

## Основные модули

### 1. Crypto Module (`src/crypto/crypto.ts`)

Модуль для шифрования seed phrase с использованием AES-GCM:
- `encryptSeedPhrase()` - шифрование seed phrase
- `decryptSeedPhrase()` - расшифровка seed phrase
- `generateRandomBytes()` - генерация случайных байтов

### 2. Blockchain Module (`src/blockchain/ton.ts`)

Модуль для работы с TON blockchain:
- `initTonWeb()` - инициализация TonWeb
- `generateWalletFromSeed()` - генерация кошелька из seed phrase
- `getBalance()` - получение баланса
- `sendTransaction()` - отправка транзакции
- `getTransactionHistory()` - история транзакций

### 3. Store (`src/app/store.ts`)

Zustand store для управления состоянием:
- `initializeWallet()` - инициализация кошелька
- `unlockWallet()` - разблокировка кошелька
- `lockWallet()` - блокировка кошелька
- `updateBalance()` - обновление баланса
- `sendTon()` - отправка TON
- `refreshTransactions()` - обновление истории транзакций

### 4. Wallet Component (`src/components/Wallet.tsx`)

React компонент для отображения кошелька:
- Отображение баланса
- Отображение адреса
- Кнопки Send/Receive
- Автообновление баланса каждые 30 секунд

## Безопасность

- Seed phrase шифруется с использованием AES-GCM
- Ключ шифрования выводится из пароля через PBKDF2 (100,000 итераций)
- Приватные ключи не сохраняются в localStorage
- В localStorage сохраняется только зашифрованный seed phrase

## Лицензия

MIT

