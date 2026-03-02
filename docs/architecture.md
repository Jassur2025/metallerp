# MetalMaster ERP — Architecture Documentation

> Версия: 2.0 | Обновлено: Июль 2025

## Содержание
1. [Обзор системы](#обзор-системы)
2. [Технологический стек](#технологический-стек)
3. [Структура проекта](#структура-проекта)
4. [Firestore — Схема данных](#firestore--схема-данных)
5. [Аутентификация и RBAC](#аутентификация-и-rbac)
6. [Сервисный слой](#сервисный-слой)
7. [Потоки данных](#потоки-данных)
8. [Lazy Subscriptions](#lazy-subscriptions)
9. [Пагинация](#пагинация)
10. [Data Integrity](#data-integrity)
11. [CI/CD и деплой](#cicd-и-деплой)
12. [Disaster Recovery](#disaster-recovery)
13. [Onboarding для разработчика](#onboarding-для-разработчика)

---

## Обзор системы

MetalMaster ERP — enterprise-level система для управления металлоторговым бизнесом в Узбекистане.
Основные модули: склад, продажи (касса), закупки, workflow, CRM, отчёты, зарплата, журнал, баланс.

**Архитектурная модель**: SPA (React) → Firestore (client SDK, без backend).
Вся бизнес-логика выполняется клиентским кодом; Firestore Security Rules обеспечивают серверную защиту.

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   React App (SPA)                     │   │
│  │                                                       │   │
│  │  Contexts ─► Hooks ─► Services ─► Firebase SDK        │   │
│  └───────────────────────────┬───────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   Firebase Cloud    │
                    │  Firestore │ Auth   │
                    │  Security Rules     │
                    └─────────────────────┘
```

---

## Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| UI Framework | React | 19.2 |
| Язык | TypeScript | 5.8 |
| Сборщик | Vite | 6.2 |
| CSS | TailwindCSS | 4.1 |
| БД / Auth | Firebase (Firestore + Auth) | 12.6 |
| Мониторинг | Sentry (@sentry/react) | 10.x |
| Unit-тесты | Vitest + jsdom | — |
| E2E-тесты | Playwright | 1.58 |
| CI/CD | GitHub Actions → GitHub Pages | — |
| Иконки | lucide-react | — |
| Графики | recharts | 3.4 |
| PDF | jspdf + html2canvas | — |

---

## Структура проекта

```
├── App.tsx                  # Корневой компонент, routing, permission checks
├── constants.ts             # Дефолтные настройки, категории, роли
├── types/                   # TypeScript типы (Product, Order, Client, …)
│   ├── assets.ts            # FixedAsset, BalanceData
│   ├── commerce.ts          # Product, Order, Purchase, Transaction, Expense
│   ├── common.ts            # AppSettings, JournalEvent, Versionable
│   ├── staff.ts             # Employee, UserRole, Permissions
│   └── index.ts             # Re-exports
│
├── lib/
│   └── firebase.ts          # Инициализация Firebase, Firestore, Auth
│
├── contexts/
│   ├── AuthContext.tsx       # Google Auth + E2E mock bypass
│   ├── ThemeContext.tsx      # Dark/light тема
│   ├── ToastContext.tsx      # Toast-уведомления
│   ├── SalesContext.tsx      # Контекст для модуля продаж (18+ пропсов)
│   └── CurrentEmployeeContext.tsx  # Текущий сотрудник + can(permission)
│
├── hooks/
│   ├── useAppData.ts        # Агрегатор: все подписки + handlers (lazy subs)
│   ├── useAppHandlers.ts    # handleSave* обработчики для всех сущностей
│   ├── useProducts.ts       # Realtime + CRUD + pagination
│   ├── useOrders.ts         # Realtime + CRUD + pagination
│   ├── useTransactions.ts   # Realtime + CRUD + pagination
│   ├── useClients.ts        # Realtime + CRUD + pagination
│   ├── usePurchases.ts      # Realtime + CRUD + pagination (lazy)
│   ├── useJournal.ts        # Realtime + pagination (lazy)
│   ├── useWorkflowOrders.ts # Realtime + CRUD (lazy)
│   ├── useFixedAssets.ts    # Realtime + CRUD (lazy)
│   ├── useExpenses.ts       # Derived from transactions (no own subscription)
│   ├── useEmployees.ts      # Realtime + CRUD
│   ├── useSettings.ts       # Settings singleton
│   ├── useBalance.ts        # Computed balance sheet
│   ├── useDebtRecalculation.ts # Auto-fix client debt
│   └── useNetworkStatus.ts  # Online/offline detection
│
├── services/
│   ├── productService.ts    # products collection
│   ├── orderService.ts      # orders collection
│   ├── salesAtomicService.ts # Atomic sale (runTransaction)
│   ├── purchaseService.ts   # purchases collection
│   ├── clientService.ts     # clients + notes subcollection
│   ├── supplierService.ts   # suppliers collection
│   ├── transactionService.ts # transactions collection
│   ├── employeeService.ts   # employees collection
│   ├── settingsService.ts   # settings/app_settings singleton
│   ├── balanceService.ts    # balance/current singleton
│   ├── fixedAssetsService.ts # fixedAssets collection
│   ├── journalService.ts    # journalEvents collection (immutable)
│   ├── workflowOrderService.ts # workflowOrders collection
│   ├── notesService.ts      # clients/{id}/notes subcollection
│   └── resetService.ts      # Bulk delete for demo resets
│
├── utils/
│   ├── integrityMonitor.ts  # Data integrity checks (7 entities)
│   ├── finance.ts           # calculateBaseTotals, P&L, VAT
│   ├── batchWriter.ts       # Firestore batch write helper
│   ├── logger.ts            # Structured logger + Sentry integration
│   ├── validators.ts        # Financial validators (amount, currency, etc.)
│   ├── errorHandler.ts      # Centralized error handling
│   └── DocumentTemplates.ts # PDF/print templates
│
├── components/              # 25+ lazy-loaded page components
├── tests/                   # Vitest unit tests (276 tests)
├── e2e/                     # Playwright E2E tests
└── docs/                    # This documentation
```

---

## Firestore — Схема данных

### Коллекции

| # | Collection | Документ | Описание |
|---|-----------|----------|----------|
| 1 | `products` | Product | Товары склада (трубы, профили, листы, балки) |
| 2 | `orders` | Order | Заказы/продажи |
| 3 | `workflowOrders` | WorkflowOrder | Заявки (draft → completed) |
| 4 | `clients` | Client | Клиенты (физ./юр. лица) |
| 5 | `clients/{id}/notes` | ClientNote | CRM-заметки по клиенту |
| 6 | `suppliers` | Supplier | Поставщики |
| 7 | `purchases` | Purchase | Закупки с landed cost |
| 8 | `transactions` | Transaction | Денежные операции |
| 9 | `employees` | Employee | Сотрудники + роли/права |
| 10 | `fixedAssets` | FixedAsset | Основные средства + амортизация |
| 11 | `journalEvents` | JournalEvent | Неизменяемый аудит-лог |
| 12 | `balance/current` | BalanceData | Кэш баланса (singleton) |
| 13 | `settings/app_settings` | AppSettings | Настройки (singleton) |
| 14 | `users` | — | Только для Firestore Rules (RBAC) |

### Soft Delete & Versioning

Все сущности (кроме JournalEvent / BalanceData) наследуют `Versionable`:

```typescript
interface Versionable {
  _version?: number;      // Оптимистичная блокировка
  updatedAt?: string;     // ISO timestamp
  _deleted?: boolean;     // Soft delete flag
  _deletedAt?: string;    // Когда удалено
  _deletedBy?: string;    // Кем удалено (email)
}
```

### Ключевые типы

**Product**: `name`, `type` (Труба/Профиль/Лист/Балка/Прочее), `dimensions`, `steelGrade`, `quantity`, `unit` (м/т/шт), `pricePerUnit` (USD продажа), `costPrice` (USD WAC), `warehouse` (main/cloud)

**Order**: `customerName`, `items[]` (с priceAtSale, costAtSale), `totalAmount` (USD), `exchangeRate`, `totalAmountUZS`, `paymentMethod` (cash/bank/card/debt/mixed), `status` (pending/completed/cancelled), `paymentStatus` (paid/unpaid/partial)

**Transaction**: `type` (client_payment / supplier_payment / client_return / debt_obligation / client_refund / expense), `amount`, `currency` (USD/UZS), `method` (cash/bank/card/debt), `orderId?`, `relatedId?`

**Purchase**: `supplierName`, `items[]` (с invoicePrice, landedCost), `overheads` (logistics, customsDuty, importVat), `totalLandedAmount` (USD w/o VAT)

**Employee**: `role` (admin/manager/accountant/sales/warehouse), `permissions` (12 модулей + 6 гранулярных прав: canViewCostPrice, canViewSalary, canProcessReturns, canEditProducts, canDeleteOrders, canManageUsers)

### Валюты и ставки

- Базовая валюта: **USD**, валюта продаж: **UZS**
- Дефолтный курс: `12 800` UZS/USD
- Ставка НДС: **12%**
- Склады: `main` (Основной) и `cloud` (Облачный)

---

## Аутентификация и RBAC

### Auth Flow

```
Пользователь → Google OAuth (popup/redirect)
    ↓
Firebase Auth (browserLocalPersistence)
    ↓
onAuthStateChanged → AuthContext → user state
    ↓
Поиск Employee по email → CurrentEmployeeContext
    ↓
Проверка прав: checkPermission(module)
```

1. **Desktop**: `signInWithPopup` → fallback `signInWithRedirect`
2. **Mobile**: `signInWithRedirect` напрямую
3. **E2E мод**: `window.__E2E_AUTH_USER__` bypass (только при `VITE_E2E_TEST=true`)
4. **Timeout**: 10 секунд safety timeout на загрузку auth

### Уровни авторизации

| Уровень | Механизм | Описание |
|---------|----------|----------|
| **Super Admin** | Env `VITE_SUPER_ADMIN_EMAILS` | Полный доступ ко всем модулям |
| **Admin** | Employee.role = 'admin' | Полный доступ |
| **Per-module** | Employee.permissions.\<module\> | Доступ к конкретному модулю |
| **Granular** | Employee.permissions.can* | Контроль отдельных действий |
| **Firestore Rules** | users/{uid}.role | Серверная защита записей |

### Гранулярные права

| Право | Описание |
|-------|----------|
| `canViewCostPrice` | Видеть себестоимость |
| `canViewSalary` | Видеть зарплаты |
| `canProcessReturns` | Обрабатывать возвраты |
| `canEditProducts` | Редактировать товары |
| `canDeleteOrders` | Удалять заказы |
| `canManageUsers` | Управлять сотрудниками |

---

## Сервисный слой

Каждый сервис — singleton объект с методами:

```typescript
// Типичный сервис
const productService = {
  subscribe(cb, maxItems = 500): Unsubscribe,  // Real-time onSnapshot
  getAll(): Promise<Product[]>,                 // One-shot fetch
  getPage(cursor, size): Promise<Page>,         // Paginated fetch
  add(item): Promise<Product>,                  // Create
  update(id, data): Promise<void>,              // Update with _version++
  delete(id): Promise<void>,                    // Soft delete
};
```

### Список сервисов

| Сервис | Коллекция | Ответственность |
|--------|-----------|-----------------|
| `productService` | products | CRUD товаров, bulk import, подписка |
| `orderService` | orders | CRUD заказов, пагинация |
| `salesAtomicService` | 5 коллекций | **Атомарная продажа** через `runTransaction` |
| `purchaseService` | purchases | Закупки, landed cost |
| `clientService` | clients + notes | Клиенты, долги, CRM-заметки |
| `supplierService` | suppliers | Поставщики |
| `transactionService` | transactions + clients | Платежи, возвраты, обновление долга |
| `employeeService` | employees | Сотрудники, роли, права |
| `settingsService` | settings | Глобальные настройки (singleton) |
| `balanceService` | balance | Полный баланс (вычисляется, кэшируется) |
| `fixedAssetsService` | fixedAssets | ОС, амортизация |
| `journalService` | journalEvents | Неизменяемый аудит-лог |
| `workflowOrderService` | workflowOrders | Заявки, жизненный цикл |
| `notesService` | clients/{id}/notes | CRM-заметки (subcollection) |
| `resetService` | 7 коллекций | Массовое удаление для demo |

---

## Потоки данных

### Продажа (Sale Flow)

```
┌──────────────────────────────────────────────────────────┐
│ [Workflow] Создание заявки (WorkflowOrder, опционально)  │
│     draft → confirmed → sent_to_cash                     │
└───────────────────────┬──────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│ [Касса] salesAtomicService.commitSale()                  │
│                                                          │
│   Firestore runTransaction:                              │
│   1. READ: products[], client, workflowOrder             │
│   2. VALIDATE: stock ≥ quantity, no duplicate IDs        │
│   3. WRITE:                                              │
│      a. product.quantity -= sold_qty                      │
│      b. product.costPrice пересчитан (WAC)               │
│      c. Order doc создан                                 │
│      d. Transaction(s) создан(ы):                        │
│         - client_payment (при оплате)                    │
│         - debt_obligation (при долге)                     │
│      e. client.totalDebt / totalPurchases обновлены      │
│      f. workflowOrder.status → completed                 │
│      g. _version++ на все документы                      │
│                                                          │
│   ⚡ Всё атомарно — откат при любой ошибке               │
└──────────────────────────────────────────────────────────┘
```

### Закупка (Purchase Flow)

```
┌──────────────────────────────────────────────────────────┐
│ [Закуп] purchaseService.create()                         │
│                                                          │
│   1. Purchase doc создан (items + overheads + VAT)       │
│   2. product.quantity += purchased_qty                    │
│   3. product.costPrice пересчитан (weighted average)     │
│   4. Transaction создана (supplier_payment)              │
│   5. Supplier.totalDebt обновлён (если в долг)           │
└──────────────────────────────────────────────────────────┘
```

### Оплата долга (Payment Flow)

```
┌──────────────────────────────────────────────────────────┐
│ [CRM] transactionService.addClientPayment()              │
│                                                          │
│   1. Transaction создана (type: client_payment)          │
│   2. client.totalDebt -= amount                          │
│   3. JournalEvent записан                                │
└──────────────────────────────────────────────────────────┘
```

### Жизненный цикл WorkflowOrder

```
 draft → confirmed → sent_to_cash → completed (→ Order)
                  ↘ sent_to_procurement
         ↘ cancelled (с причиной)
```

### Расчёт баланса

`balanceService` читает ВСЕ данные и вычисляет:
- **Активы**: Склад + Касса (USD/UZS/Банк/Карта) + Дебиторка + ОС
- **Пассивы**: НДС + Кредиторка + Собственный капитал + Нераспределённая прибыль
- **P&L**: Выручка − Себестоимость = Валовая прибыль − Расходы − Амортизация = Чистая прибыль
- Результат кэшируется в `balance/current`

---

## Lazy Subscriptions

Для оптимизации Firestore reads, подписки на вторичные коллекции активируются только при первом посещении соответствующей вкладки.

```
useAppData(activeTab)
    │
    ├── ALWAYS ACTIVE (core):
    │   ├── useProducts()
    │   ├── useOrders()
    │   ├── useTransactions()
    │   ├── useClients()
    │   ├── useEmployees()
    │   └── useSettings()
    │
    └── LAZY (enabled when tab first visited):
        ├── useJournal()        → tab: journal
        ├── useWorkflowOrders() → tabs: import, sales, workflow
        ├── useFixedAssets()    → tabs: fixedAssets, reports, balance
        └── usePurchases()      → tabs: import, reports, balance
```

**Механизм**: `useVisitedTabs(activeTab)` — Set, который только растёт.
Однажды активированная подписка остаётся активной до конца сессии — нет задержки при повторном переходе на вкладку.

Каждый lazy-хук принимает `{ enabled?: boolean }`. Когда `enabled = false`, подписка не создаётся, данные — пустой массив.

---

## Пагинация

Все основные коллекции используют паттерн **"Real-time head + Load more"**:

```
┌────────────────────────────────────────────────┐
│  onSnapshot(limit(500))  — live realtime head  │
│  ┌──────────────────┐                          │
│  │ Latest 500 docs  │ ← Live updates           │
│  └──────────────────┘                          │
│                                                │
│  [Load More] → getPage(cursor, 100)            │
│  ┌──────────────────┐                          │
│  │ Older 100 docs   │ ← Static page            │
│  └──────────────────┘                          │
│  ┌──────────────────┐                          │
│  │ Next 100 docs    │                          │
│  └──────────────────┘                          │
│                                                │
│  allItems = deduplicate(head + olderPages)     │
└────────────────────────────────────────────────┘
```

### Cursor Fields

| Коллекция | Cursor | Порядок |
|-----------|--------|---------|
| orders | `date` | desc |
| transactions | `date` | desc |
| journalEvents | `date` | desc |
| purchases | `date` | desc |
| products | `name` | asc |
| clients | `name` | asc |

### API

```typescript
// Сервис
getPage(afterCursor: string, pageSize: number = 100): Promise<{ items: T[], hasMore: boolean }>

// Хук
const { items, hasMore, loadMore, loadingMore } = useXxx();
```

---

## Data Integrity

### Оптимистичная блокировка

Каждый `update()` в сервисах инкрементирует `_version`. При конфликте (concurrent write) операция откатывается.

### Integrity Monitor

`utils/integrityMonitor.ts` проверяет:

| # | Проверка | Описание |
|---|---------|----------|
| 1 | Duplicate IDs | Одинаковые ID в коллекции |
| 2 | Orphaned refs | Transaction.orderId → несуществующий Order |
| 3 | Negative stock | product.quantity < 0 |
| 4 | Debt mismatch | client.totalDebt ≠ сумма debt_obligation − client_payment |
| 5 | Missing fields | Обязательные поля = null/undefined |
| 6 | Stale versions | _version = undefined (legacy data) |
| 7 | Inactive access | Деактивированные сотрудники с активными правами |

### Soft Delete

```typescript
await service.delete(id);
// → { _deleted: true, _deletedAt: ISO, _deletedBy: email }
```

Queries фильтруют `_deleted != true`.

### Immutable Audit Log

`journalEvents` — запись разрешена, обновление/удаление запрещено Firestore Rules.
Фиксирует: действия сотрудников, операции с чеками, системные события, изменения данных.

---

## CI/CD и деплой

```
GitHub Push → GitHub Actions:
  1. npm ci
  2. tsc --noEmit
  3. vitest run (276 tests)
  4. vite build
  5. Deploy → GitHub Pages
```

### Переменные окружения

| Переменная | Описание |
|-----------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_SUPER_ADMIN_EMAILS` | Comma-separated admin emails |
| `VITE_SENTRY_DSN` | Sentry DSN (опционально) |
| `VITE_E2E_TEST` | E2E тест-мод (только dev) |

---

## Disaster Recovery

### Backup

1. Firebase Console → Firestore → Export → Cloud Storage bucket
2. Рекомендуется: ежедневный scheduled export через Cloud Functions
3. Ключевые коллекции: `products`, `orders`, `clients`, `transactions`, `purchases`

### Restore

1. Firebase Console → Firestore → Import from backup
2. Или: `resetService` для очистки + повторный импорт данных через UI
3. `balance/current` пересчитывается автоматически

### Критические данные (нельзя потерять)

- `journalEvents` — аудит, не восстанавливается из других данных
- `orders` + `transactions` — финансовая отчётность

---

## Onboarding для разработчика

### 1. Клонирование и установка

```bash
git clone <repo-url>
cd "Google ERP"
npm install
npx playwright install chromium   # для E2E
```

### 2. Настройка .env.local

```bash
cp .env.example .env.local
# Заполнить Firebase credentials
```

### 3. Запуск

```bash
npm run dev          # Dev server (port 3000)
npm test             # Unit tests (vitest, 276 tests)
npm run test:e2e     # E2E tests (playwright)
npm run build        # Production build
```

### 4. Ключевые файлы

| Файл | Зачем читать |
|------|-------------|
| `types/` | Все типы данных |
| `hooks/useAppData.ts` | Как собираются все данные + lazy subscriptions |
| `services/salesAtomicService.ts` | Атомарная продажа (самая сложная логика) |
| `contexts/AuthContext.tsx` | Auth flow |
| `constants.ts` | Дефолты и категории |
| `firestore.rules` | Серверная безопасность |
| `docs/TASKS.md` | Текущий roadmap |

### 5. Паттерны для нового кода

| Задача | Шаблон |
|--------|--------|
| Новый сервис | Скопировать `productService.ts`, заменить collection + типы |
| Новый хук | Скопировать `useProducts.ts` (с пагинацией), обновить типы и сервис |
| Новый компонент | Lazy-import в `App.tsx` + case в `renderContent()` + item в `AppSidebar` |
| Новое право | Поле в `types/staff.ts → Permissions` + обработка в `CurrentEmployeeContext.tsx` |
| Новый тест | Создать в `tests/` (unit) или `e2e/` (E2E), следовать existing patterns |
