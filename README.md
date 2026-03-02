<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MetalMaster ERP

Полнофункциональная ERP-система для управления металлоторговым бизнесом в Узбекистане.  
React 19 + Firebase/Firestore, мультивалютность (USD/UZS), НДС 12%, RBAC.

---

## Возможности

| Модуль | Описание |
|--------|----------|
| **Dashboard** | Аналитика продаж, выручки, остатков в реальном времени |
| **Складской учёт** | Товары, остатки, себестоимость (weighted average), NRV-проверка (IAS 2) |
| **Касса / Продажи** | Оформление заказов, мульти-оплата, чек-печать, возвраты |
| **Workflow** | Очередь заказов: Продажи → Касса → Выполнено / Отмена |
| **Закупки / Импорт** | Локальные и импортные закупки, landed cost, накладные |
| **CRM** | Клиенты, долги, история, заметки |
| **Payroll** | Расчёт зарплаты, KPI-бонусы, авансы |
| **Отчёты** | P&L, Cash Flow, VAT, аналитика продаж |
| **Основные средства** | Учёт и амортизация (линейная) |
| **Журнал** | Аудит-лог всех операций |
| **Настройки** | Модули, курс, НДС, категории расходов, тема |

---

## Технологии

| Слой | Стек |
|------|------|
| **Frontend** | React 19, TypeScript 5.8, Vite 6, TailwindCSS 4 |
| **Backend/Data** | Firebase Firestore (прямой доступ из клиента, persistence + multi-tab) |
| **Auth** | Firebase Auth — Google OAuth (browserLocalPersistence) |
| **Monitoring** | Sentry (`@sentry/react`) — ошибки, replay, performance tracing |
| **Testing** | Vitest (276+ unit/integration tests) |
| **CI/CD** | GitHub Actions → type-check → vitest → build → GitHub Pages |
| **UI** | Lucide React (иконки), Recharts (графики) |

---

## Быстрый старт

### Требования

- Node.js 18+
- Firebase-проект с включённым Firestore и Authentication (Google sign-in)

### Установка

```bash
git clone <repository-url>
cd "Google ERP"
npm install
```

### Настройка окружения

Скопируйте шаблон и заполните значения:

```bash
cp .env.example .env.local
```

```env
# Firebase (обязательно)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Sentry (опционально, только для production)
VITE_SENTRY_DSN=https://xxx@sentry.io/yyy

# Super-admin email addresses (через запятую)
VITE_SUPER_ADMIN_EMAILS=admin@example.com
```

### Запуск

```bash
npm run dev          # Dev-сервер (http://localhost:5173)
npm run build        # Production-сборка → dist/
npm run preview      # Просмотр сборки
```

---

## Тестирование

```bash
npm test             # Запуск Vitest (276+ тестов)
npm run test:coverage # С отчётом покрытия
```

Тесты покрывают: сервисы (Firestore CRUD, атомарные операции), утилиты (финансовые калькуляции, валидация, integrity monitor), хуки.

---

## Архитектура

```
├── App.tsx                  # Главная оболочка (routing, permissions, lazy-load)
├── components/
│   ├── Sales/               # Модуль продаж (18 файлов, SalesContext)
│   ├── Procurement/         # Модуль закупок
│   ├── CRM/                 # CRM модуль
│   ├── Workflow/            # Workflow модуль
│   ├── Settings/            # Настройки
│   ├── Import/              # Импорт товаров
│   ├── AppSidebar.tsx       # Config-driven sidebar
│   ├── AppHeader.tsx        # Dynamic header
│   └── ...                  # Dashboard, Inventory, Balance, etc.
├── contexts/
│   ├── AuthContext.tsx       # Firebase Auth provider
│   ├── ThemeContext.tsx      # Light/dark theme
│   ├── ToastContext.tsx      # Toast notifications
│   ├── SalesContext.tsx      # Sales data/handlers (eliminates prop drilling)
│   └── CurrentEmployeeContext.tsx  # Current employee + field permissions
├── hooks/
│   ├── useAppData.ts        # Aggregate hook (14 data hooks + handlers)
│   ├── useOrders.ts         # Orders CRUD + real-time + pagination
│   ├── useTransactions.ts   # Transactions CRUD + real-time + pagination
│   ├── useJournal.ts        # Journal events + pagination
│   └── ...                  # useProducts, useClients, useEmployees, etc.
├── services/
│   ├── orderService.ts      # Firestore CRUD + pagination + soft delete
│   ├── transactionService.ts # Atomic TOCTOU-safe CRUD
│   ├── productService.ts    # Optimistic locking (_version)
│   ├── salesAtomicService.ts # Atomic sale completion
│   └── ...                  # purchaseService, clientService, etc.
├── utils/
│   ├── integrityMonitor.ts  # Data integrity checks (17+ checks)
│   ├── validation.ts        # Financial validators + sanitizers
│   ├── logger.ts            # Pluggable logger → Sentry
│   ├── finance.ts           # Currency formatting, totals
│   └── ...
├── config/
│   └── navigation.tsx       # Sidebar items, header titles
├── lib/
│   ├── firebase.ts          # Firebase init + persistence
│   └── sentry.ts            # Sentry init + user identification
├── types/
│   ├── staff.ts             # Employee, UserRole, RBAC permissions
│   ├── commerce.ts          # Order, Transaction, Purchase
│   ├── assets.ts            # FixedAsset
│   ├── common.ts            # Versionable, soft-delete fields
│   └── index.ts             # Re-exports
└── types.ts                 # Legacy types (re-exports + AppSettings)
```

### Ключевые архитектурные решения

- **No backend**: Весь доступ к Firestore напрямую из клиента. Безопасность — через Firestore Security Rules + клиентский RBAC.
- **Soft delete**: Удалённые записи помечаются `_deleted: true`, а не стираются физически. Позволяет восстановление и аудит.
- **Optimistic locking**: `_version` на products/transactions — `runTransaction` проверяет версию перед записью.
- **Pagination**: Заказы, транзакции, журнал — первые 500 записей real-time через `onSnapshot`, остальные подгружаются страницами через `getPage()`.
- **Context-driven permissions**: `CurrentEmployeeContext` предоставляет `can('canViewCostPrice')` и `can('canViewSalary')` для field-level access control.

---

## Безопасность и RBAC

### Роли

| Роль | Описание |
|------|----------|
| `admin` | Полный доступ ко всем модулям |
| `manager` | Продажи, закупки, CRM, отчёты |
| `accountant` | Касса, финансы, отчёты |
| `sales` | Продажи, workflow |
| `warehouse` | Склад |

### Права доступа

- **Модульные**: dashboard, inventory, sales, workflow, reports, balance, crm, staff, journal, priceList, fixedAssets, import
- **Гранулярные**: `canViewCostPrice`, `canViewSalary`, `canProcessReturns`, `canEditProducts`, `canDeleteOrders`, `canManageUsers`
- **Super Admin**: email в `VITE_SUPER_ADMIN_EMAILS` или `role === 'admin'` — bypass всех проверок

---

## Firestore Structure

```
/products/{id}        — Product (name, type, quantity, costPrice, pricePerUnit, _version)
/orders/{id}          — Order (date, items, paymentMethod, totalAmount, _deleted)
/transactions/{id}    — Transaction (type, amount, clientId, _version, _deleted)
/clients/{id}         — Client (name, debt, phone)
/purchases/{id}       — Purchase (items, overheads, status, _version)
/employees/{id}       — Employee (name, role, permissions, salary, status)
/workflowOrders/{id}  — WorkflowOrder (status, paymentStatus, items)
/journalEvents/{id}   — JournalEvent (type, module, action, employeeName)
/fixedAssets/{id}      — FixedAsset (name, cost, depreciation)
/expenses/{id}        — Expense (category, amount, method)
/settings/main        — AppSettings (exchangeRate, vatRate, modules, theme)
/notes/{id}           — Note (title, content)
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. `npm ci`
2. `npx tsc --noEmit` (type check)
3. `npx vitest run` (unit tests)
4. `npm run build`
5. Deploy dist/ → GitHub Pages

---

## Лицензия

Private project

## Авторы

MetalMaster ERP Team
