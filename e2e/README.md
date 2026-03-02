# E2E Tests — MetalMaster ERP

## Структура

```
e2e/
├── fixtures/          # Playwright fixtures (auth, data seeding)
│   └── auth.ts        # Fixture для авторизации через Firebase Emulator
├── helpers/           # Утилиты для тестов
│   └── selectors.ts   # Селекторы UI-элементов
├── sale-flow.spec.ts  # Полный цикл продажи
├── purchase-flow.spec.ts  # Полный цикл закупки
└── payment-flow.spec.ts   # Оплата долга
```

## Prerequistes

### 1. Firebase Emulators

Тесты используют Firebase Auth + Firestore эмуляторы. Установите Firebase CLI:

```bash
npm install -g firebase-tools
```

### 2. Настройка эмуляторов

Файл `firebase.json` уже настроен. Запустите:

```bash
firebase emulators:start --only auth,firestore
```

- Auth Emulator: `http://localhost:9099`
- Firestore Emulator: `http://localhost:8080`

### 3. Environment

При запуске E2E тестов dev-сервер автоматически поднимается (см. `playwright.config.ts` → `webServer`).

Убедитесь что `.env.local` содержит:
```
VITE_FIREBASE_AUTH_EMULATOR_URL=http://localhost:9099
VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:8080
VITE_E2E_TEST=true
```

## Запуск

```bash
# Все E2E тесты
npm run test:e2e

# С визуальным UI Playwright
npm run test:e2e:ui

# С видимым браузером
npm run test:e2e:headed

# Конкретный файл
npx playwright test e2e/sale-flow.spec.ts
```

## Debugging

```bash
# Пошаговый режим
npx playwright test --debug

# Посмотреть trace после падения
npx playwright show-trace test-results/*/trace.zip
```
