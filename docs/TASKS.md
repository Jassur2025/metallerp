# 📋 МАСТЕР-ПЛАН ЗАДАЧ — MetalMaster ERP Hardening

> Дата: 28.02.2026 (обновлено: 03.03.2026)  
> Общее количество задач: **57 (оригинальных) + 6 (аудит Pre-IPO)**  
> Оригинальных выполнено: **55/57** ✅  
> Pre-IPO аудит выполнено: **5/6** ✅  
> Плановые (Backup + Budget): **2** ⬜ (ручная работа в Firebase Console)  
> Расчётный срок: **20 недель (5 месяцев)**  
> Принцип: каждая задача — конкретное изменение в конкретном файле

---

## УСЛОВНЫЕ ОБОЗНАЧЕНИЯ

- 🔴 **P0 — Критично** (потеря данных / денег / безопасность)
- 🟠 **P1 — Высокий** (блокирует рост)
- 🟡 **P2 — Средний** (технический долг)
- ⚪ **P3 — Низкий** (улучшение)
- ✅ — Готово
- 🔄 — В работе
- ⬜ — Не начато

---

# ═══════════════════════════════════════════
# ЭТАП 1: ФУНДАМЕНТ (Недели 1-4)
# ═══════════════════════════════════════════

## Неделя 1: Критические баги + Backup + Мониторинг

### Задача 1.1 ✅ 🔴 — Исправить баг handleSave* (потеря обновлений)
**Проблема:** В 5 из 8 обработчиков `handleSave*` если одновременно добавляется новый элемент и обновляется существующий — обновления МОЛЧА ТЕРЯЮТСЯ. Условие `if (added.length === 0)` блокирует блок обновлений.

**Файл:** `hooks/useAppHandlers.ts` (289 строк)

**Затронутые функции:**
- `handleSaveEmployees` (строки ~120-131) 
- `handleSavePurchases` (строки ~135-149)
- `handleSaveClients` (строки ~153-167)
- `handleSaveFixedAssets` (строки ~171-185)
- `handleSaveWorkflowOrders` (строки ~243-259)

**Что сделать:** 
1. Убрать условие `if (added.length === 0)` перед блоком обновлений
2. Сделать обработку adds и updates НЕЗАВИСИМОЙ (как в `handleSaveProducts`)
3. Обе операции (add + update) должны выполняться параллельно через `Promise.all`

**Эталон (правильная реализация):** `handleSaveProducts` (строки ~76-89) — обновления идут вне зависимости от adds.

**Тесты:** Написать unit-тест: "при вызове с одним новым и одним обновлённым элементом — оба сохраняются"

---

### Задача 1.2 ✅ 🔴 — Исправить TOCTOU в transactionService.update()
**Проблема:** Метод `update()` читает документ через `getDoc()` ВНЕ `runTransaction()`, затем использует устаревшие данные внутри транзакции. Если между чтением и записью другой пользователь изменит документ — расчёт долга будет неверным.

**Файл:** `services/transactionService.ts` (379 строк)

**Что сделать:**
1. Перенести `getDoc(txRef)` ВНУТРЬ `runTransaction()` → заменить на `tx.get(txRef)`
2. Именно внутри транзакции определять oldData и вычислять дельту долга
3. Тот же fix для метода `delete()` (аналогичная проблема)

**До (сломано):**
```typescript
const oldSnap = await getDoc(txRef);        // ← ВНЕ транзакции
const oldData = oldSnap.data();
await runTransaction(db, async (tx) => {
  // используем устаревший oldData
});
```

**После (правильно):**
```typescript
await runTransaction(db, async (tx) => {
  const oldSnap = await tx.get(txRef);       // ← ВНУТРИ транзакции
  const oldData = oldSnap.data();
  // теперь данные актуальны и защищены от конкуренции
});
```

**Тесты:** Проверить что при конкурентном обновлении транзакции долг клиента остаётся корректным.

---

### Задача 1.3 ✅ 🔴 — Исправить TOCTOU в transactionService.delete()
**Проблема:** Идентичная проблеме 1.2 — чтение вне транзакции в методе `delete()`.

**Файл:** `services/transactionService.ts`

**Что сделать:** Аналогично задаче 1.2 — перенести `getDoc` внутрь `runTransaction`, использовать `tx.get()`.

---

### Задача 1.4 ⬜ 🔴 — Включить автоматический Backup Firestore
**Проблема:** Нет бэкапов. Потеря данных = потеря бизнеса. Одна ошибка, один баг в resetService — и ВСЕ данные потеряны навсегда.

**Что сделать:**
1. В Firebase Console → Firestore → Backups: включить Scheduled Exports
2. Расписание: ежедневно в 03:00 UTC
3. Назначение: Cloud Storage bucket `gs://metalmaster-erp-backups`
4. Retention: 90 дней
5. Задокументировать процедуру восстановления в `docs/disaster-recovery.md`

**Альтернатива (если через CLI):**
```bash
gcloud firestore export gs://metalmaster-erp-backups/$(date +%Y-%m-%d)
```
Поставить на Cloud Scheduler.

---

### Задача 1.5 ✅ 🔴 — Подключить мониторинг ошибок (Sentry)
**Проблема:** Ошибки в продакшне не отслеживаются. Узнаём о проблемах от пользователей.

**Файл:** Новый `lib/sentry.ts` + изменения в `index.tsx`

**Что сделать:**
1. `npm install @sentry/react`
2. Создать `lib/sentry.ts` с инициализацией Sentry DSN
3. Обернуть `<App />` в `Sentry.ErrorBoundary`
4. Интегрировать с существующим `components/ErrorBoundary.tsx`
5. В `utils/logger.ts` — метод `error()` отправляет в Sentry (в production)
6. Добавить `VITE_SENTRY_DSN` в `.env` и в GitHub Secrets

---

### Задача 1.6 ✅ 🟠 — Создать .env.example
**Проблема:** Нет шаблона для переменных окружения. Новый разработчик не знает что настраивать.

**Файл:** Новый `.env.example`

**Что сделать:**
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

### Задача 1.7 ⬜ 🟠 — Бюджетные алерты Firebase
**Проблема:** DDoS через billing — злоумышленник может генерировать миллионы reads, и мы узнаем об этом из счёта на $1800.

**Что сделать:**
1. Firebase Console → Billing → Budget alerts
2. Установить порог: $50/мес (alert), $100/мес (critical), $200/мес (stop)
3. Настроить email-уведомления
4. Опционально: Cloud Function для автоматического отключения при превышении

---

## Неделя 2: Firestore Rules + Soft Delete + Security

### Задача 2.1 ✅ 🔴 — Усилить Firestore Security Rules (серверная валидация)
**Проблема:** Rules проверяют только auth и роль, но НЕ бизнес-правила. Можно создать заказ с отрицательной суммой или нулевой ценой через DevTools.

**Файл:** `firestore.rules` (127 строк)

**Что добавить для orders:**
```rules
match /orders/{docId} {
  allow create: if isAuthenticated()
    && request.resource.data.totalAmount > 0
    && request.resource.data.items.size() > 0
    && request.resource.data.status in ['pending', 'completed']
    && request.resource.data.customerName is string
    && request.resource.data.customerName.size() > 0;
}
```

**Что добавить для transactions:**
```rules
match /transactions/{docId} {
  allow write: if isAdmin()
    && request.resource.data.amount > 0
    && request.resource.data.type in ['client_payment', 'supplier_payment', 'client_return', 'debt_obligation', 'client_refund', 'expense']
    && request.resource.data.currency in ['USD', 'UZS'];
}
```

**Что добавить для products:**
```rules
match /products/{docId} {
  allow write: if isAdmin()
    && request.resource.data.quantity >= 0
    && request.resource.data.pricePerUnit >= 0
    && request.resource.data.costPrice >= 0;
}
```

**Аналогично:** expenses, purchases, workflowOrders — добавить проверки на положительные суммы, допустимые статусы, обязательные поля.

---

### Задача 2.2 ✅ 🔴 — Реализовать Soft Delete для финансовых документов
**Проблема:** `orderService.delete()` и `transactionService.delete()` физически удаляют документы. Потерянные данные невосстановимы. Удаление заказа не реверсит склад.

**Файлы:**
- `services/orderService.ts`
- `services/transactionService.ts`
- `services/purchaseService.ts`
- `services/workflowOrderService.ts`

**Что сделать:**
1. Вместо `deleteDoc(ref)` → `updateDoc(ref, { deletedAt: serverTimestamp(), deletedBy: auth.currentUser.email, _deleted: true })`
2. Во всех `subscribe()` и `getAll()` — добавить `where('_deleted', '!=', true)` или фильтр на клиенте
3. В `computeBalance()` и `calculateBaseTotals()` — исключать документы с `_deleted: true`
4. Добавить в типы: `_deleted?: boolean; deletedAt?: string; deletedBy?: string`

**Результат:** Данные никогда не удаляются физически. Можно восстановить. Аудит-trail полный.

---

### Задача 2.3 ✅ 🔴 — Реверс склада при удалении/отмене заказа
**Проблема:** `orderService.delete()` удаляет заказ, но товар НЕ возвращается на склад. При отмене заказа — аналогично.

**Файл:** `services/orderService.ts` (127 строк)

**Что сделать:**
1. Метод `delete()` → превратить в `softDelete()` 
2. Перед soft-delete: для каждого item в order → `product.quantity += item.quantity`
3. Обернуть в Firestore `runTransaction`: атомарно обновить ВСЕ товары И заказ
4. Если заказ был с долгом (`paymentMethod === 'debt'`) → обновить `client.totalDebt`
5. Записать `journalEvent` с описанием отмены

**Аналогично для cancelOrder():** при статусе 'cancelled' → реверс склада.

---

### Задача 2.4 ✅ 🟠 — Закрыть утечку данных (field-level access)
**Проблема:** Любой аутентифицированный пользователь может прочитать ВСЕ данные: зарплаты, себестоимость, ИНН, банковские реквизиты.

**Файл:** `firestore.rules`

**Что сделать (минимум):**
1. Employees: только admin видит salary, только сам сотрудник видит свой профиль
2. Products: `costPrice` — отдельная sub-коллекция `products/{id}/sensitive` с isAdmin()
3. Или: Cloud Function для получения данных с фильтрацией полей по роли

**Примечание:** Firestore rules не поддерживают field-level security. Варианты:
- **Вариант А:** Чувствительные поля в отдельную коллекцию (products_cost, employees_salary)
- **Вариант Б:** Cloud Function как прокси для чтения (фильтрует поля по роли)
- **Вариант В (быстрый):** Добавить в клиент фильтрацию, понимая что это не безопасность а UX

---

### Задача 2.5 ✅ 🟠 — Вынести super-admin emails из клиентского кода
**Проблема:** `SUPER_ADMIN_EMAILS` захардкожены в `constants.ts` и видны в публичном JS bundle.

**Файл:** `constants.ts`

**Что сделать:**
1. Убрать массив `SUPER_ADMIN_EMAILS` из `constants.ts`
2. Хранить super-admin emails в коллекции `/config/admins` в Firestore
3. Super-admin проверка через Firestore rules (или Custom Claims через Cloud Functions)
4. На клиенте — загружать из Firestore при старте

**Идеальный вариант (с Cloud Functions):**
```typescript
// Cloud Function: setAdminClaim
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  // Проверить что вызывающий — super admin
  await admin.auth().setCustomUserClaims(uid, { admin: true });
});
```

---


## Неделя 3: Атомарные операции

### Задача 3.1 ✅ 🔴 — Атомарная закупка (purchase + inventory)
**Проблема:** `purchaseService.add()` сохраняет только закупку. Товар на складе НЕ обновляется атомарно. Если сбой между записями — закупка есть, товара нет.

**Файл:** `services/purchaseService.ts` (138 строк)

**Что сделать:**
1. Создать метод `commitPurchase()` по аналогии с `salesAtomicService.commitSale()`
2. Единая Firestore `runTransaction`:
   - Прочитать все продукты из purchase.items
   - Проверить что продукты существуют
   - Обновить `product.quantity += item.quantity`
   - Обновить `product.costPrice` (средневзвешенная себестоимость)
   - Создать purchase документ
   - Если есть поставщик — обновить supplier.totalDebt
   - Создать transaction если оплата
3. Все или ничего — если одна запись не прошла, вся операция откатывается

**Формула средневзвешенной себестоимости:**
```
newCostPrice = (oldQty × oldCostPrice + newQty × landedCost) / (oldQty + newQty)
```

---

### Задача 3.2 ✅ 🔴 — Инкремент _version при update в productService
**Проблема:** `productService.update()` не инкрементирует `_version`. Оптимистичная конкурентность не работает.

**Файл:** `services/productService.ts` (138 строк)

**Что сделать:**
1. Заменить `setDoc(ref, data, { merge: true })` на `runTransaction`
2. Внутри транзакции: прочитать текущую версию, инкрементировать, записать
3. При конфликте — retry (Firestore делает это автоматически)

---

### Задача 3.3 ✅ 🟠 — Инкремент _version при update в transactionService  
**Файл:** `services/transactionService.ts`

**Аналогично задаче 3.2** — `_version` не инкрементируется на update.

---

### Задача 3.4 ✅ 🟠 — Инкремент _version при update в purchaseService
**Файл:** `services/purchaseService.ts`

**Аналогично задаче 3.2** — `_version` не инкрементируется на update.

---

## Неделя 4: Пагинация (начало) + Блокировка уволенных

### Задача 4.1 ✅ 🟠 — Пагинация заказов (orders)
**Проблема:** `orderService.subscribe()` загружает ВСЕ заказы в каждый браузер. При 5000+ заказов → OOM на мобильных.

**Файл:** `services/orderService.ts`, `hooks/useOrders.ts`

**Что сделать:**
1. В `subscribe()` — добавить `limit(100)` + `orderBy('date', 'desc')`
2. Добавить метод `loadMore(lastDoc)` с `startAfter(lastDoc)` + `limit(100)`
3. В хуке `useOrders` — состояние для пагинации + кнопка "Загрузить ещё"
4. Для отчётов — оставить `getAll()` (но вызывать только когда нужно, не при загрузке)

---

### Задача 4.2 ✅ 🟠 — Пагинация транзакций
**Файл:** `services/transactionService.ts`, `hooks/useTransactions.ts`

**Аналогично задаче 4.1.**

---

### Задача 4.3 ✅ 🟠 — Пагинация journalEvents
**Файл:** `services/journalService.ts`, `hooks/useJournal.ts`

**Аналогично задаче 4.1.** journalService уже использует `limit(500)`, но хук должен поддерживать загрузку следующих страниц.

---

### Задача 4.4 ✅ 🟠 — Блокировка доступа уволенных сотрудников
**Проблема:** При увольнении (`status: 'inactive'`) сессия сотрудника продолжает работать до истечения refresh token.

**Что сделать (без Cloud Functions — промежуточное решение):**
1. В `AuthContext.tsx` — после получения `user`, проверять коллекцию `employees`
2. Если `employee.status === 'inactive'` → принудительный `logout()`
3. В `firestore.rules` — добавить проверку active status:
```rules
function isActiveEmployee() {
  return exists(/databases/$(database)/documents/employees/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.status == 'active';
}
```

**Что сделать (с Cloud Functions — правильное решение, этап 2):**
1. Firestore trigger на `employees/{id}` update
2. Если `status` стал 'inactive' → `admin.auth().revokeRefreshTokens(uid)`

---

### Задача 4.5 ✅ 🟡 — Debt recalculation: оптимизация (пересчёт только затронутых)
**Проблема:** `useDebtRecalculation` запускается в КАЖДОМ браузере. 10 онлайн-пользователей = 10 параллельных пересчётов.

**Файл:** `hooks/useDebtRecalculation.ts` (131 строк)

**Что сделать (промежуточное решение):**
1. Проверять роль пользователя — запускать только для admin
2. Или: distributed lock через Firestore doc `locks/debtRecalc` с TTL
3. Или (этап 2): перенести на Cloud Function trigger

---

# ═══════════════════════════════════════════
# ЭТАП 2: СЕРВЕРНАЯ ЛОГИКА (Недели 5-10)
# ═══════════════════════════════════════════

## Неделя 5-6: Firebase Cloud Functions Setup

### Задача 5.1 ✅ 🔴 — Инициализация Firebase Cloud Functions
**Проблема:** Нет серверной стороны. ВСЯ бизнес-логика в браузере.

**Что сделать:**
1. `firebase init functions` → TypeScript, ESLint
2. Структура:
```
functions/
  src/
    index.ts              — entry point
    sales/
      commitSale.ts       — атомарная продажа
    purchases/
      commitPurchase.ts   — атомарная закупка
    payments/
      processPayment.ts   — обработка оплаты
    balance/
      computeBalance.ts   — серверный расчёт баланса
    auth/
      onEmployeeChange.ts — блокировка уволенных
    utils/
      validation.ts       — серверная валидация
      finance.ts          — финансовые расчёты (копия из клиента)
  package.json
  tsconfig.json
```
3. Deploy через GitHub Actions (добавить step в `.github/workflows/deploy.yml`)

---

### Задача 5.2 ✅ 🔴 — Перенести commitSale на Cloud Function
**Проблема:** `salesAtomicService.commitSale()` работает в клиенте — можно подделать данные через DevTools.

**Файлы:**
- Новый `functions/src/sales/commitSale.ts`
- Изменить `services/salesAtomicService.ts` → вызов Cloud Function вместо прямой логики

**Что сделать:**
1. Callable Cloud Function `commitSale`:
   - Принимает: orderData, items, clientId, paymentInfo, workflowOrderId
   - СЕРВЕР читает product prices, client data, stock levels
   - СЕРВЕР вычисляет суммы, НДС, долги (клиент НЕ передаёт суммы)
   - СЕРВЕР выполняет Firestore transaction (та же логика из salesAtomicService)
   - Возвращает: orderId, success/failure
2. Клиент передаёт только: список товаров (ID + quantity), клиента, способ оплаты
3. Всё остальное (цены, курс, НДС, суммы) — вычисляет СЕРВЕР из Firestore

**Критически важно:** Клиент НЕ ДОЛЖЕН передавать `priceAtSale`, `costAtSale`, `totalAmount` — это вычисляется на сервере из текущих данных.

---

### Задача 5.3 ✅ 🔴 — Перенести commitSale — клиентская часть
**Файл:** `services/salesAtomicService.ts` (162 строки)

**Что сделать:**
1. Заменить прямую Firestore-транзакцию на вызов Cloud Function
2. `httpsCallable(functions, 'commitSale')(params)`
3. Обработка ошибок: если CF вернула ошибку → show toast
4. Оставить старый код как fallback для offline-режима (с пометкой deprecated)

---

## Неделя 7-8: Purchase + Payment на сервере

### Задача 6.1 ✅ 🔴 — Cloud Function: commitPurchase
**Файл:** Новый `functions/src/purchases/commitPurchase.ts`

**Что сделать:**
1. Callable Function принимает: supplierId, items (productId + quantity + invoicePrice), overheads, paymentInfo
2. Сервер вычисляет:
   - landedCost = (invoicePriceWithoutVat + overheads) / exchangeRate
   - Средневзвешенная себестоимость для каждого товара
   - supplier.totalDebt обновление
3. Атомарная транзакция: products update + purchase create + supplier update + transaction create
4. Валидация: все productId существуют, цены > 0, quantities > 0

---

### Задача 6.2 ✅ 🔴 — Cloud Function: processPayment (оплата долга)
**Файл:** Новый `functions/src/payments/processPayment.ts`

**Что сделать:**
1. Callable Function принимает: clientId/supplierId, amount, currency, method, orderId (optional)
2. Сервер проверяет: клиент существует, сумма > 0, сумма ≤ totalDebt (или разрешить переплату?)
3. Атомарная транзакция: transaction create + client/supplier debt update
4. Заменяет `transactionService.createPayment()` и `transactionService.addDebt()`

---

### Задача 6.3 ✅ 🟠 — Cloud Function: updateTransaction (исправление TOCTOU)
**Файл:** Новый `functions/src/payments/updateTransaction.ts`

**Что сделать:**
1. Перенести `transactionService.update()` на сервер
2. Сервер читает старую транзакцию ВНУТРИ runTransaction (нет TOCTOU)
3. Вычисляет дельту долга и обновляет client.totalDebt атомарно

---

### Задача 6.4 ✅ 🟠 — Cloud Function: deleteTransaction
**Аналогично задаче 6.3** для метода delete.

---

## Неделя 9: Balance на сервере

### Задача 7.1 ✅ 🟠 — Cloud Function: computeBalance (серверный расчёт)
**Проблема:** `computeBalance()` загружает ВСЕ документы в каждый браузер. При 10K документов = 10 секунд на мобильном + OOM.

**Файл:** Новый `functions/src/balance/computeBalance.ts`

**Что сделать:**
1. Firestore trigger: onWrite для orders, transactions, expenses, purchases → запуск пересчёта
2. Или: Cloud Scheduler — пересчёт каждые 5 минут (дешевле по reads)
3. Результат записывается в `balance/current`
4. Клиент только ЧИТАЕТ `balance/current` (не вычисляет)
5. Перенести логику из `services/balanceService.ts.computeBalance()` и `utils/finance.ts.calculateBaseTotals()`

**Важно:** Не запускать на каждую запись (expensive). Debounce через Cloud Tasks с 30-секундным окном.

---

### Задача 7.2 ✅ 🟠 — Убрать клиентский computeBalance
**Файлы:** `hooks/useBalance.ts` (69 строк), `services/balanceService.ts` (189 строк)

**Что сделать:**
1. `useBalance` → подписка на `balance/current` через `onSnapshot`
2. Убрать `useMemo(computeBalance(...))` — больше не вычислять в браузере
3. Убрать передачу ВСЕХ данных (products, orders, transactions...) в useBalance
4. Оставить fallback: если `balance/current` пустой → вычислить локально (для первого запуска)

---

## Неделя 10: Rate Limiting + Серверная валидация

### Задача 8.1 ✅ 🟠 — Firebase App Check
**Проблема:** Любой может вызвать Firebase SDK напрямую без нашего приложения.

**Что сделать:**
1. `firebase init appcheck`
2. Подключить reCAPTCHA Enterprise provider
3. В Cloud Functions: `context.app` проверка (отклонять вызовы без App Check)
4. В Firestore rules: `request.auth.token.firebase.app_check` (опционально)

---

### Задача 8.2 ✅ 🟠 — Rate limiting в Cloud Functions
**Файл:** Новый `functions/src/utils/rateLimiter.ts`

**Что сделать:**
1. Для каждой callable function — лимит по uid:
   - commitSale: 10 вызовов/минуту
   - processPayment: 20 вызовов/минуту
   - computeBalance: 1 вызов/минуту
2. Хранить счётчики в Firestore `rateLimits/{uid}/{functionName}`
3. Или использовать `firebase-functions-rate-limiter` пакет

---

### Задача 8.3 ✅ 🟠 — Cloud Function: onEmployeeDeactivated (token revocation)
**Файл:** Новый `functions/src/auth/onEmployeeChange.ts`

**Что сделать:**
1. Firestore trigger: `onDocumentUpdated('employees/{id}')`
2. Если `status` изменился на 'inactive':
   - Найти uid по email через `admin.auth().getUserByEmail(email)`
   - `admin.auth().revokeRefreshTokens(uid)`
   - Логировать в journalEvents

---

# ═══════════════════════════════════════════
# ЭТАП 3: ДОМЕН (Недели 11-16)
# ═══════════════════════════════════════════

## Неделя 11-13: General Ledger (Двойная запись)

### Задача 9.1 ✅ 🔴 — Спроектировать план счетов (Chart of Accounts)
**Проблема:** Нет двойной записи. Без General Ledger это не ERP. Невозможно пройти аудит.

**Файл:** Новый `types/accounting.ts`

**Что сделать — спроектировать типы:**
```typescript
// План счетов по НСБУ Узбекистана (упрощённый для металлоторговли)
export enum AccountCode {
  // Активы (0100-2900)
  CASH_USD = '5010',           // Касса USD
  CASH_UZS = '5020',           // Касса UZS
  BANK_UZS = '5110',           // Расчётный счёт
  ACCOUNTS_RECEIVABLE = '4010', // Дебиторская задолженность
  INVENTORY = '2900',          // ТМЗ (Товарно-материальные запасы)
  FIXED_ASSETS = '0100',       // Основные средства
  ACCUM_DEPRECIATION = '0200', // Амортизация ОС

  // Пассивы
  ACCOUNTS_PAYABLE = '6010',   // Кредиторская задолженность (поставщики)
  VAT_PAYABLE = '6410',        // НДС к уплате
  VAT_RECEIVABLE = '4410',     // НДС к возмещению
  SALARY_PAYABLE = '6710',     // Задолженность по зарплате

  // Капитал
  EQUITY = '8300',             // Уставный капитал
  RETAINED_EARNINGS = '8700',  // Нераспределённая прибыль

  // Доходы/Расходы
  REVENUE = '9010',            // Выручка от реализации
  COGS = '9110',               // Себестоимость
  ADMIN_EXPENSES = '9420',     // Административные расходы
  COMMERCIAL_EXPENSES = '9410', // Коммерческие расходы
  DEPRECIATION_EXPENSE = '9430', // Амортизация
}

export interface LedgerEntry {
  id: string;
  date: string;
  debitAccount: AccountCode;
  creditAccount: AccountCode;
  amount: number;           // Всегда в USD
  amountUZS?: number;       // Для UZS-операций
  exchangeRate?: number;
  description: string;
  relatedType?: 'order' | 'purchase' | 'expense' | 'transaction' | 'depreciation';
  relatedId?: string;
  periodId?: string;        // Ссылка на accounting period
  createdBy: string;
  createdAt: string;
}

export interface AccountingPeriod {
  id: string;               // формат: "2026-02"
  year: number;
  month: number;
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: string;
  openingBalances?: Record<AccountCode, number>;
}
```

---

### Задача 9.2 ✅ 🔴 — Создать ledgerService (сервис двойной записи)
**Файл:** Новый `services/ledgerService.ts`

**Что сделать:**
1. `addEntry(debit, credit, amount, description, related)` — создаёт проводку
2. `getTrialBalance(periodId)` — пробный баланс: сумма дебетов = сумма кредитов
3. `getAccountBalance(accountCode, periodId)` — сальдо по счёту
4. `getJournalEntries(periodId, filters)` — журнал проводок с фильтрами

**Правило:** Сумма ВСЕХ дебетов ВСЕГДА равна сумме ВСЕХ кредитов. Если нет — ошибка в системе.

---

### Задача 9.3 ✅ 🔴 — Генерация проводок при продаже
**Где:** Cloud Function `commitSale` (задача 5.2)

**Проводки при продаже (пример: товар за $100, себестоимость $70, НДС 12%):**
```
Дт 4010 (Дебиторка)     Кт 9010 (Выручка)        $100.00 — Выручка
Дт 9110 (Себестоимость)  Кт 2900 (ТМЗ)            $70.00  — Списание себестоимости
Дт 9010 (Выручка)        Кт 6410 (НДС к уплате)   $12.00  — Начислен НДС
```

**При получении оплаты:**
```
Дт 5010 (Касса USD)      Кт 4010 (Дебиторка)      $112.00 — Получена оплата
```

---

### Задача 9.4 ✅ 🔴 — Генерация проводок при закупке
**Где:** Cloud Function `commitPurchase` (задача 6.1)

**Проводки при закупке (пример: товар за 1,280,000 UZS, курс 12800):**
```
Дт 2900 (ТМЗ)            Кт 6010 (Кредиторка)     $100.00 — Оприходование
Дт 4410 (НДС к возмещ.)  Кт 6010 (Кредиторка)     $12.00  — Входящий НДС
```

**При оплате поставщику:**
```
Дт 6010 (Кредиторка)     Кт 5110 (Банк)           $112.00 — Оплата поставщику
```

---

### Задача 9.5 ✅ 🟠 — Генерация проводок при расходах
**Где:** При создании расхода

**Проводки (пример: аренда $500):**
```
Дт 9420 (Адм. расходы)   Кт 5010 (Касса USD)      $500.00 — Аренда
```

---

### Задача 9.6 ✅ 🟠 — Trial Balance (Пробный баланс) — UI
**Файл:** Новый `components/TrialBalance.tsx`

**Что сделать:**
1. Таблица: Счёт | Дебетовый оборот | Кредитовый оборот | Сальдо
2. Итого дебет = Итого кредит (если нет — показать ошибку красным)
3. Фильтр по периоду
4. Добавить в Reports.tsx как ещё одну вкладку

---

## Неделя 14: Accounting Periods

### Задача 10.1 ✅ 🔴 — Создать систему учётных периодов
**Файлы:** 
- Новый `services/accountingPeriodService.ts`
- Новый `types/accounting.ts` (дополнение к задаче 9.1)

**Что сделать:**
1. Коллекция `accountingPeriods` в Firestore
2. При закрытии периода:
   - Сверить Trial Balance (дебит = кредит)
   - Рассчитать начальные сальдо для следующего периода
   - Установить `status: 'closed'`
3. Запрет создания операций в закрытых периодах:
   - Firestore rules: проверка что period для даты операции `status === 'open'`
   - Cloud Function: валидация перед записью

---

### Задача 10.2 ✅ 🟠 — UI закрытия периода
**Файл:** Новый раздел в `components/Settings.tsx`

**Что сделать:**
1. Список периодов с статусами (open/closed)
2. Кнопка "Закрыть период" — с предупреждением
3. Отображение начальных сальдо
4. Только admin может закрывать периоды

---

## Неделя 15-16: Модуляризация

### Задача 11.1 ✅ 🟠 — Разбить App.tsx на модули
**Проблема:** `App.tsx` = 641 строка God Component, 14 хуков, все данные в одном месте.

**Файл:** `App.tsx`

**Что сделать:**
1. Создать `contexts/DataContext.tsx` — глобальный провайдер данных
2. Или лучше: **Context per feature module**:
   - `contexts/SalesContext.tsx` — orders, transactions, settings
   - `contexts/InventoryContext.tsx` — products, purchases
   - `contexts/CRMContext.tsx` — clients
   - `contexts/StaffContext.tsx` — employees
   - `contexts/FinanceContext.tsx` — balance, expenses, fixedAssets
3. App.tsx → только routing/layout + context providers (< 100 строк)
4. Каждый модуль подписывается только на НУЖНЫЕ ему данные

---

### Задача 11.2 ✅ 🟡 — Избавиться от prop drilling в Sales
**Проблема:** `Sales` компонент принимает 18 props.

**Файл:** `components/Sales.tsx`

**Что сделать:**
1. Создать `contexts/SalesContext.tsx` со всеми нужными данными и функциями
2. Sales и его подкомпоненты берут данные из контекста
3. `<Sales />` в App.tsx — без props

---

### Задача 11.3 ✅ 🟡 — Заменить JSON.stringify diff в useAppHandlers
**Проблема:** `handleSaveOrders` и другие используют `JSON.stringify(prev) !== JSON.stringify(current)` для детекции изменений. Это O(n) по размеру данных и ломается на circular references.

**Файл:** `hooks/useAppHandlers.ts`

**Что сделать:**
1. Для сравнения — использовать `_version` field (уже есть на большинстве entity)
2. Или: сравнивать только `id` + `updatedAt` (O(1) per entity)
3. Или: явный tracking изменений через Map<id, 'added'|'updated'|'deleted'>

---

# ═══════════════════════════════════════════
# ЭТАП 4: QUALITY & SCALE (Недели 17-20)
# ═══════════════════════════════════════════

## Неделя 17-18: E2E Тесты

### Задача 12.1 ✅ 🟠 — Настроить Playwright
**Что сделать:**
1. `npm install -D @playwright/test`
2. Создать `playwright.config.ts`
3. Создать `e2e/` папку
4. Добавить `test:e2e` script в package.json
5. Добавить в CI/CD pipeline

---

### Задача 12.2 ✅ 🟠 — E2E: Тест полного цикла продажи
**Файл:** Новый `e2e/sale-flow.spec.ts`

**Что покрыть:**
1. Login через Google (мок через Firebase Emulator)
2. Открыть Workflow → создать заявку
3. Подтвердить заявку → отправить в кассу
4. В кассе → оформить продажу
5. Проверить: склад уменьшился, заказ создан, баланс обновился
6. Если долг — проверить client.totalDebt

---

### Задача 12.3 ✅ 🟠 — E2E: Тест полного цикла закупки
**Файл:** Новый `e2e/purchase-flow.spec.ts`

---

### Задача 12.4 ✅ 🟠 — E2E: Тест оплаты долга
**Файл:** Новый `e2e/payment-flow.spec.ts`

---

### Задача 12.5 ✅ 🟡 — Unit тесты для Cloud Functions
**Файлы:** `functions/src/__tests__/`

**Что покрыть:**
1. commitSale — проверка stock validation, суммы, проводки
2. commitPurchase — средневзвешенная себестоимость, проводки
3. processPayment — корректность обновления долга
4. computeBalance — соответствие Trial Balance

---

## Неделя 19: Полная пагинация + Оптимизация

### Задача 13.1 ✅ 🟠 — Пагинация для всех коллекций
**Файлы:** Все services + hooks

**Что сделать:** Аналогично задачам 4.1-4.3, но для:
- purchases
- expenses  
- clients (если >1000)
- products (если >500)

---

### Задача 13.2 ✅ 🟡 — Серверная агрегация для отчётов
**Проблема:** PnL, CashFlow, VatReport загружают ВСЕ данные в браузер.

**Что сделать:**
1. Cloud Function `generateReport(type, dateFrom, dateTo)`
2. Сервер вычисляет агрегаты и возвращает готовый результат
3. Клиент показывает — не вычисляет

---

### Задача 13.3 ✅ 🟡 — Оптимизация onSnapshot подписок
**Что сделать:**
1. Lazy subscribe — подписываться только когда модуль открыт
2. Unsubscribe при уходе с вкладки (уже lazily loaded, но подписки не отменяются)
3. Compound queries — загружать только нужные поля (`select()`)

---

## Неделя 20: Финальный аудит + Документация

### Задача 14.1 ✅ 🟡 — Обновить интеграционный мониторинг
**Файл:** `utils/integrityMonitor.ts` (427 строк)

**Что добавить:**
1. Проверка Trial Balance (дебит = кредит)
2. Проверка что все операции имеют проводки в ledger
3. Проверка что закрытые периоды не содержат новых записей
4. Cloud Function для периодического запуска (Cloud Scheduler, 1 раз/день)

---

### Задача 14.2 ✅ 🟡 — Документация архитектуры
**Файл:** Новый `docs/architecture.md`

**Что покрыть:**
1. Диаграмма компонентов (обновлённая)
2. Описание каждого Cloud Function endpoint
3. План счетов с пояснениями
4. Описание потоков данных (продажа, закупка, оплата)
5. Процедура disaster recovery
6. Onboarding guide для нового разработчика

---

### Задача 14.3 ✅ 🟡 — Финальный аудит безопасности
**Что сделать:**
1. Проверить все Firestore rules на полноту валидации
2. Проверить все Cloud Functions на авторизацию
3. Проверить что клиент НЕ вычисляет суммы для финансовых операций
4. Penetration test: попытка создать заказ с поддельными ценами
5. Обновить INVESTOR_DUE_DILIGENCE_REPORT.md с новыми оценками

---

### Задача 14.4 ✅ ⚪ — Обновить README.md
**Файл:** `README.md`

**Что добавить:**
1. Архитектурная диаграмма
2. Инструкция по установке (с .env.example)
3. Описание Cloud Functions
4. Описание системы двойной записи
5. Как запустить тесты

---

# ═══════════════════════════════════════════
# СВОДНАЯ ТАБЛИЦА
# ═══════════════════════════════════════════

| Этап | Задач | 🔴 P0 | 🟠 P1 | 🟡 P2 | ⚪ P3 | Недели |
|------|-------|-------|-------|-------|-------|--------|
| **1. Фундамент** | 19 | 9 | 8 | 2 | 0 | 1-4 |
| **2. Серверная логика** | 13 | 5 | 8 | 0 | 0 | 5-10 |
| **3. Домен** | 11 | 5 | 3 | 3 | 0 | 11-16 |
| **4. Quality & Scale** | 14 | 0 | 6 | 6 | 2 | 17-20 |
| **ИТОГО** | **57** | **19** | **25** | **11** | **2** | **20** |

---

## ПОРЯДОК ЗАПУСКА (с чего начинаем)

```
СЕГОДНЯ → Задача 1.1 (handleSave* баг — 30 мин)
        → Задача 1.2 (TOCTOU update — 1 час)
        → Задача 1.3 (TOCTOU delete — 30 мин)
        → Задача 1.4 (Backup — 30 мин)
        → Задача 1.5 (Sentry — 1 час)
        → Задача 1.6 (.env.example — 5 мин)
```

**Готов начинать. Скажи "поехали" — и я начну с Задачи 1.1.**

---

# ═══════════════════════════════════════════
# Pre-IPO АУДИТ — Выполненные задачи (03.03.2026)
# ═══════════════════════════════════════════

### Задача A.1 ✅ 🔴 — Ключи идемпотентности на всех CF
Добавлен `requestId` + `idempotencyKeys/{requestId}` коллекция. Все 3 CF (commitSale, commitPurchase, processPayment) проверяют и записывают ключ внутри `runTransaction`.

### Задача A.2 ✅ 🔴 — Удалить Reset Service
`resetService.ts` заменён на stub с throw. UI "Опасная зона" удалён из Settings.

### Задача A.3 ✅ 🔴 — Леджер внутри транзакции
Все 3 CF: проводки теперь пишутся через `tx.set()` ВНУТРИ `runTransaction`, а не fire-and-forget после.

### Задача A.4 ✅ 🔴 — Удалить клиентский fallback продаж
`salesAtomicService.ts`: 310 → 87 строк. `_commitSaleLocal()` удалён. Только CF-путь.

### Задача A.5 ✅ 🔴 — Сторно-проводки при удалении
3 точки удаления (deleteTransaction CF, orderService.delete, purchaseService.delete) теперь создают contra-entries (СТОРНО) с swap debit↔credit.

### Задача A.6 ⬜ 🔴 — Backup Firestore (ПЛАНОВАЯ — ручная)
Firebase Console → Firestore → Backups → Scheduled Exports.

---

# ═══════════════════════════════════════════
# ЭТАП 5: НОВЫЙ АУДИТ — Оставшиеся задачи
# ═══════════════════════════════════════════
#
# Дата аудита: 03.03.2026
# Найдено: 4 Критических, 6 Высоких, 5 Средних, 2 Низких
#

## 🔴 КРИТИЧЕСКИЕ (C1-C4)

### Задача B.1 ✅ 🔴 — Подключить commitPurchase CF к клиенту
**Решение (03.03.2026):**
- Создан `services/purchaseAtomicService.ts` — `commitPurchase()` вызывает `httpsCallable('commitPurchase')` с `requestId`
- Рефакторинг `components/Procurement.tsx` — `finalizeProcurement` заменён с 3-шагового клиентского процесса на единый CF-вызов
- CF атомарно создаёт закупку, обновляет остатки, записывает транзакцию и ledger

---

### Задача B.2 ✅ 🔴 — Подключить processPayment CF к клиенту
**Решение (03.03.2026):**
- Создан `services/paymentAtomicService.ts` — `processPayment()` вызывает `httpsCallable('processPayment')` с `requestId`
- Модифицирован `hooks/useTransactions.ts` — `addTransaction` теперь маршрутизируется через CF
- Заменены 5 прямых вызовов `transactionService.createPayment()` в `components/CRM.tsx` на `paymentAtomicService.processPayment()`
- `transactionService.add()`, `createPayment()`, `addDebt()` теперь мёртвый код (можно удалить)

---

### Задача B.3 ✅ 🔴 — Подключить deleteTransaction CF к клиенту
**Решение (03.03.2026):**
- `paymentAtomicService.deleteTransaction()` вызывает `httpsCallable('deleteTransaction')` с atomic debt reversal + ledger СТОРНО
- Модифицирован `hooks/useTransactions.ts` — `deleteTransaction` теперь маршрутизируется через CF
- `transactionService.delete()` теперь мёртвый код (можно удалить)

---

### Задача B.4 ✅ 🔴 — Перенести удаление заказов/закупок в CF
**Решение (03.03.2026):**
- Создан CF `deleteOrder` (`functions/src/orders/deleteOrder.ts`) — atomic: restore inventory + reverse client debt/totalPurchases + ledger СТОРНО + journal event
- Создан CF `deletePurchase` (`functions/src/purchases/deletePurchase.ts`) — atomic: reverse product quantities + ledger СТОРНО + journal event
- Создан `services/orderAtomicService.ts` — клиентский враппер `deleteOrder()` через `httpsCallable`
- Расширен `services/purchaseAtomicService.ts` — добавлен `deletePurchase()` через `httpsCallable`
- Модифицирован `hooks/useOrders.ts` — `deleteOrder` маршрутизируется через CF
- Модифицирован `hooks/usePurchases.ts` — `deletePurchase` маршрутизируется через CF
- `orderService.delete()` и `purchaseService.delete()` теперь мёртвый код (можно удалить)
- Зарегистрированы оба CF в `functions/src/index.ts` (итого 10 CF)

---

## 🟠 ВЫСОКИЕ (H1-H6)

### Задача B.5 ✅ 🟠 — Учёт долга поставщиков в CF
**Решение (03.03.2026):**
- **commitPurchase CF**: добавлен optional `supplierId`, авто-поиск по `supplierName` если не передан. При нахождении — обновляет `suppliers/{id}.totalDebt` (+=неоплаченная часть) и `totalPurchases` (+=totalLandedAmountUSD). Хранит `supplierId` в документе закупки.
- **processPayment CF**: добавлен `supplierId` в input. Для `supplier_payment` — `debtDelta = -amountUSD` (уменьшает долг). Чтение поставщика по `supplierId` приоритетнее fallback по `relatedId`.
- **deleteTransaction CF**: добавлен `supplier_payment` в DEBT_TYPES. При удалении — читает `supplierId` из транзакции и увеличивает долг поставщика обратно.
- **deletePurchase CF**: при удалении закупки — реверсит долг и totalPurchases поставщика если `supplierId` есть в документе.
- **Типы**: `Transaction.supplierId` и `Purchase.supplierId` добавлены в types.ts и types/commerce.ts
- **Клиент**: `paymentAtomicService` и `purchaseAtomicService` пробрасывают `supplierId`. Procurement.tsx передаёт `supplierId` из документа закупки при погашении долга.

---

### Задача B.6 ✅ 🟠 — Проводки для амортизации ОС
**Решение:** Создан CF `runDepreciation` (`functions/src/assets/runDepreciation.ts`). Атомарно обновляет все активы + создаёт проводки Дт 9430 / Кт 0200 + journal. Идемпотентность через `lastDepreciationMonth`. Клиент вызывает через `fixedAssetsAtomicService.runDepreciation()`.

---

### Задача B.7 ✅ 🟠 — Soft-delete для основных средств (вместо hard delete)
**Решение:** Создан CF `deleteFixedAsset` (`functions/src/assets/deleteFixedAsset.ts`). Soft-delete (`deletedAt/deletedBy`) + проводка списания остаточной стоимости (IAS 16.67). Клиент вызывает через `fixedAssetsAtomicService.deleteFixedAsset()`.

---

### Задача B.8 ✅ 🟠 — Закрыть клиентскую запись в ledgerEntries
**Решение:** `firestore.rules` — `ledgerEntries` теперь `allow create, update, delete: if false`. Все записи идут ТОЛЬКО через Admin SDK (CF). Включено после завершения B.1-B.4.

---

### Задача B.9 ✅ 🟠 — Зарплатные проводки
**Решение:** Создан CF `processPayroll` (`functions/src/payroll/processPayroll.ts`). Кнопка «Начислить ЗП» в Payroll.tsx. Читает сотрудников/заказы/расходы, рассчитывает salary+KPI, создаёт проводки Дт 9420 / Кт 6710. Идемпотентность через journalEvents query по `metadata.monthKey`.

---

### Задача B.10 ✅ 🟠 — Покупка ОС через CF (не fake transaction)
**Решение:** Создан CF `purchaseFixedAsset` (`functions/src/assets/purchaseFixedAsset.ts`). Атомарно создаёт asset + payment transaction + проводки (Дт 0100 / Кт 6010 капитализация + Дт 6010 / Кт cash оплата) + journal. Клиент вызывает через `fixedAssetsAtomicService.purchaseFixedAsset()`.

---

## 🟡 СРЕДНИЕ (M1-M5)

### Задача B.11 ✅ 🟡 — Создать firestore.indexes.json
**Решение:** Создан `firestore.indexes.json` с 9 composite indexes: orders/purchases/transactions/workflowOrders (`_deleted` + `date` desc), transactions (`relatedId` + `date` desc), ledgerEntries (`periodId`/`relatedId`/`relatedType` combos), journalEvents (`action` + `metadata.monthKey`).

---

### Задача B.12 ✅ 🟡 — Soft-delete для клиентов/поставщиков/товаров
**Решение:** Заменён `deleteDoc()` на `updateDoc()` + `_deleted: true, _deletedAt` во всех 3 сервисах. Добавлен `.filter(x => !x._deleted)` в `getAll()` и `subscribe()`. Удалены неиспользуемые импорты `deleteDoc`.

---

### Задача B.13 ⬜ 🟡 — Бюджетные алерты Firebase (ПЛАНОВАЯ — ручная)
Firebase Console → Billing → Budget alerts. $50/$100/$200 пороги.

---

## ⚪ НИЗКИЕ (L1-L2)

### Задача B.14 ✅ ⚪ — Soft-delete для workflow orders через транзакцию
**Решение:** `workflowOrderService.delete()` уже корректно реализован через soft-delete `updateDoc()` + `_deleted/_deletedAt/_deletedBy`. Не требует `runTransaction` т.к. это единичный updateDoc.

### Задача B.15 ✅ ⚪ — Пометить мёртвый код как @deprecated
**Решение:** 6 методов помечены `@deprecated` с указанием CF-замены: `transactionService.add/createPayment/addDebt/delete`, `orderService.delete`, `purchaseService.delete`. Все они пишут в `ledgerEntries` который заблокирован firestore.rules.

---

## РЕКОМЕНДУЕМЫЙ ПОРЯДОК

```
Фаза 1 (Самый большой ROI — подключить готовые CF):
  B.1 → commitPurchase CF к клиенту
  B.2 → processPayment CF к клиенту
  B.3 → deleteTransaction CF к клиенту

Фаза 2 (Перенести оставшиеся delete в CF):
  B.4 → deleteOrder + deletePurchase CF

Фаза 3 (Закрыть записи с клиента):
  B.8 → ledgerEntries: allow create: if false

Фаза 4 (Финансовая полнота):
  B.5 → Supplier debt tracking
  B.6 → Depreciation ledger entries
  B.9 → Payroll ledger entries
  B.10 → Fixed asset purchase via CF

Фаза 5 (Cleanup):
  B.7  → Soft-delete для ОС
  B.11 → firestore.indexes.json
  B.12 → Soft-delete для clients/suppliers/products
  B.14 → Workflow order transaction
  B.15 → Dead import cleanup

Плановые (ручная работа в Firebase Console):
  A.6  → Backup Firestore
  B.13 → Budget alerts
```
ываавыавы update