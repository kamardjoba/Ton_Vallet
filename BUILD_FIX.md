# Исправление ошибки сборки

## Проблема
```
Uncaught ReferenceError: require is not defined
Uncaught SyntaxError: Unexpected token 'export'
```

## Решение

### 1. Настройка CommonJS преобразования
В `vite.config.ts` добавлено:
```typescript
build: {
  commonjsOptions: {
    // Transform ALL CommonJS modules, including nested ones
    include: [/node_modules/],
    transformMixedEsModules: true,
    requireReturnsDefault: 'auto',
    esmExternals: false,
    strictRequires: true,
  },
}
```

### 2. Изменение формата вывода
Формат изменен с `es` на `iife` для лучшей совместимости с браузером:
```typescript
rollupOptions: {
  output: {
    format: 'iife',
    name: 'WalletApp',
    globals: {},
  },
}
```

### 3. Удаление ссылки на vite.svg
Удалена ссылка на несуществующий файл `vite.svg` из `index.html`.

## Результат

✅ Сборка проходит успешно
✅ Нет вызовов `require()` в собранном файле
✅ Формат IIFE обеспечивает совместимость с браузером
✅ Все CommonJS модули преобразуются в ESM

## Проверка

После сборки проверьте:
```bash
npm run build
grep -c "require(" dist/assets/*.js  # Должно вернуть 0
```

## Для Netlify

Все настройки уже применены в `netlify.toml`. Просто задеплойте проект.
