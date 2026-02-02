# Инструкция по деплою на Netlify

## Решение проблемы сборки

Проблема была в том, что React использует CommonJS формат, и Vite нужно было явно указать обрабатывать React как CommonJS модуль.

## Настройки для Netlify

### 1. Файл `netlify.toml` (уже создан)

Файл содержит:
- Команду сборки: `npm run build`
- Директорию публикации: `dist`
- Версию Node.js: 20
- Заголовки безопасности

### 2. Переменные окружения (если нужны)

В настройках Netlify можно добавить:
- `NODE_VERSION=20` (уже указано в netlify.toml)

### 3. Команды сборки

Netlify автоматически использует команду из `netlify.toml`:
```bash
npm run build
```

### 4. Проверка сборки локально

Перед деплоем проверьте сборку локально:
```bash
npm run build
```

Если сборка успешна, можно деплоить на Netlify.

## Важные моменты для Telegram Mini App

1. **HTTPS обязателен** - Telegram Mini Apps работают только по HTTPS
2. **CSP headers** - уже настроены в `index.html`
3. **Telegram WebApp script** - загружается из `https://telegram.org/js/telegram-web-app.js`

## Деплой на Netlify

### Вариант 1: Через Git (рекомендуется)

1. Подключите репозиторий к Netlify
2. Netlify автоматически обнаружит `netlify.toml`
3. Настройки будут применены автоматически

### Вариант 2: Ручной деплой

1. Соберите проект: `npm run build`
2. Загрузите папку `dist` в Netlify через drag & drop

## После деплоя

1. Убедитесь, что сайт доступен по HTTPS
2. Добавьте URL в настройки Telegram Bot через @BotFather
3. Протестируйте Mini App в Telegram

## Возможные проблемы

### Проблема: Сборка падает с ошибкой React

**Решение**: Убедитесь, что в `vite.config.ts` в `commonjsOptions.include` есть `/node_modules\/react/` и `/node_modules\/react-dom/`

### Проблема: Mini App не загружается в Telegram

**Решение**: 
- Проверьте, что сайт доступен по HTTPS
- Проверьте CSP headers в консоли браузера
- Убедитесь, что Telegram WebApp script загружается

### Проблема: Ошибки CORS

**Решение**: 
- Netlify автоматически обрабатывает CORS для статических файлов
- Если используете внешние API, убедитесь, что они поддерживают CORS

## Оптимизация для продакшена

1. **Code splitting** - можно добавить в `vite.config.ts`:
```typescript
rollupOptions: {
  output: {
    manualChunks: {
      'react-vendor': ['react', 'react-dom'],
      'ton-vendor': ['tonweb', '@ton/core', '@ton/crypto'],
    },
  },
}
```

2. **Compression** - Netlify автоматически сжимает файлы (gzip/brotli)

3. **CDN** - Netlify использует CDN автоматически
