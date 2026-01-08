# 🔒 PROFESSIONAL DATA INTEGRITY AUDIT REPORT
## Google ERP System - MetalERP

**Audit Date:** January 8, 2026  
**Auditor Role:** Principal Software Architect, Data Integrity Specialist  
**System Type:** ERP System with Google Sheets Backend  
**Risk Classification:** HIGH

---

## 📊 EXECUTIVE SUMMARY

### Overall System Health Score: 5.5/10

| Category | Score | Risk Level |
|----------|-------|------------|
| Architecture Design | 6/10 | MEDIUM |
| Data Sync Safety | 4/10 | **CRITICAL** |
| ID Strategy | 5/10 | **HIGH** |
| Race Condition Protection | 6/10 | MEDIUM |
| State Management | 5/10 | **HIGH** |
| Error Recovery | 6/10 | MEDIUM |

### Key Finding
**The system has fundamental architectural risks that can cause data corruption during concurrent operations, cache invalidation, and state desynchronization between local React state and Google Sheets.**

---

## 🚨 CRITICAL ISSUES (MUST FIX IMMEDIATELY)

### 1. **FULL TABLE OVERWRITE PATTERN** (CRITICAL - Data Loss Risk)

**Location:** [services/sheets/service.ts](services/sheets/service.ts#L95-L180)

**Problem:** The `saveAllWithMerge` function uses a **read-merge-clear-write** pattern that overwrites the ENTIRE data range:

```typescript
// Line 170-172: Clears ALL data before writing
if (merged.length === 0) {
  await clearRange(accessToken, clearA1);  // ⚠️ CLEARS ENTIRE RANGE
} else {
  await writeRange(accessToken, writeA1, dataToWrite);  // ⚠️ OVERWRITES ALL
}
```

**Why This Causes Data Corruption:**
1. Between `clearRange` and `writeRange`, ANY network failure = **TOTAL DATA LOSS**
2. If two users save simultaneously, the second write overwrites the first
3. The merge algorithm only considers `updatedAt` timestamps - if clocks are out of sync, older data wins

**Impact:** User A's changes can be completely erased by User B's save operation.

---

### 2. **TIMESTAMP-BASED ID GENERATION** (HIGH - Collision Risk)

**Locations:**
- [components/Inventory.tsx#L107](components/Inventory.tsx#L107)
- [components/Sales/index.tsx#L822](components/Sales/index.tsx#L822)
- [components/Procurement.tsx#L209](components/Procurement.tsx#L209)
- [components/Staff.tsx#L101](components/Staff.tsx#L101)
- [components/CRM.tsx#L338](components/CRM.tsx#L338)

**Problem:** IDs are generated using `Date.now().toString()`:

```typescript
// Multiple places in codebase
id: Date.now().toString()  // ⚠️ DANGEROUS
id: `CLI-${Date.now()}`    // ⚠️ Can collide in same millisecond
id: `TRX-${Date.now()}-1`  // ⚠️ Still risky
```

**Why This Causes Data Corruption:**
1. Two records created in the same millisecond get IDENTICAL IDs
2. The merge algorithm uses `Map<string, T>` - duplicate IDs cause silent data loss
3. High-speed operations (bulk imports) almost guarantee collisions

**Real Scenario:**
```
User creates 5 transactions rapidly → 
Date.now() returns same value for 2 → 
Map.set(id, item) overwrites first item → 
Data loss!
```

---

### 3. **LOCAL STATE ↔ SHEETS DESYNCHRONIZATION** (HIGH)

**Location:** [App.tsx](App.tsx) and all components using `setProducts`, `setOrders`, etc.

**Problem:** React state and Google Sheets can diverge silently:

```typescript
// App.tsx Line 551-555
const handleSaveProducts = async (newProducts: Product[]) => {
  setProducts(newProducts);  // ① Updates local state IMMEDIATELY
  await saveProductsHandler(newProducts);  // ② Saves to Sheets (may fail!)
};
```

**Why This Causes Data Corruption:**
1. Local state updates BEFORE Sheets save completes
2. If save fails, user sees data that doesn't exist in Sheets
3. Next page load fetches from Sheets → user's changes "disappear"
4. User thinks data is saved, but it isn't

**Pattern Found Throughout:**
- [Sales/index.tsx#L242](components/Sales/index.tsx#L242): `setProducts(updatedProducts)` before save
- [Sales/index.tsx#L322](components/Sales/index.tsx#L322): `setTransactions(updatedTx)` before save
- [Procurement.tsx](components/Procurement.tsx): Same pattern

---

### 4. **WEAK MERGE ALGORITHM - updatedAt DEPENDENCY** (HIGH)

**Location:** [services/sheets/merge.ts#L27-L52](services/sheets/merge.ts#L27-L52)

**Problem:** The merge logic relies entirely on `updatedAt` timestamps:

```typescript
export function mergeById<T extends SyncableRecord>(localItems: T[], remoteItems: T[]): T[] {
  // ...
  const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
  const remoteTime = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;
  
  if (localTime >= remoteTime) {
    merged.set(localItem.id, localItem);  // Local wins
  }
  // Remote wins if older timestamp
}
```

**Why This Causes Data Corruption:**
1. **Missing updatedAt:** Records without `updatedAt` get timestamp `0` → always lose
2. **Clock Skew:** Different user devices have different system times
3. **Timezone Issues:** Same moment can have different timestamps across timezones
4. **No Field-Level Merge:** Entire record is replaced, not merged field-by-field

**Scenario:**
```
User A edits product name at 10:00:00.000
User B edits product quantity at 10:00:00.001
User B saves → User A's name change is lost forever
```

---

### 5. **CACHE INVALIDATION WITHOUT REFETCH** (MEDIUM-HIGH)

**Location:** [services/sheets/cache.ts](services/sheets/cache.ts), [services/cacheService.ts](services/cacheService.ts)

**Problem:** Cache is invalidated but data isn't refetched:

```typescript
// service.ts Line 171
cacheService.invalidate(cacheKey);  // Cache cleared
// But NO automatic refetch from Sheets!
```

**Why This Causes Data Corruption:**
1. After save, cache is cleared
2. Next read hits Sheets API (but may get stale data due to Sheets API lag)
3. Google Sheets API has eventual consistency - changes may not be immediately visible
4. User sees old data, edits it, saves → overwrites newer remote changes

---

## ⚠️ HIGH-RISK ISSUES

### 6. **QUANTITY DELTA MERGE NOT USED CONSISTENTLY**

**Location:** [services/sheets/merge.ts#L63-L90](services/sheets/merge.ts#L63-L90)

The codebase has a sophisticated `mergeProductsWithDelta` function that correctly handles concurrent quantity changes:

```typescript
export function mergeProductsWithDelta<T extends ProductRecord>(
  localItems: T[], 
  remoteItems: T[],
  baseItems?: T[]  // Base items needed for delta calculation
): T[] {
```

**Problem:** This function EXISTS but is **NEVER USED**! The `saveAllProducts` uses the basic `mergeById` instead:

```typescript
// service.ts - Uses basic merge, not delta merge
saveAllProducts: (accessToken: string, products: Product[]) =>
  saveAllWithMerge<Product>(  // Uses mergeById internally
    ...
  ),
```

**Impact:** Concurrent inventory operations can cause quantity data loss.

---

### 7. **PARALLEL SAVE OPERATIONS CREATE RACE CONDITIONS**

**Location:** [hooks/useSheets.ts#L222-L232](hooks/useSheets.ts#L222-L232)

```typescript
const saveAll = useCallback(async (data: {...}) => {
  const promises: Promise<void>[] = [];
  
  if (data.products) promises.push(sheetsService.saveAllProducts(...));
  if (data.orders) promises.push(sheetsService.saveAllOrders(...));
  // ... more parallel saves
  
  await Promise.all(promises);  // ⚠️ ALL RUN IN PARALLEL
}, ...);
```

**Problem:** While there's a mutex per table (`writeLocks` Map), parallel saves to DIFFERENT tables that reference each other can create inconsistencies:
- Order saved with productId X
- Product X save fails
- Order references non-existent product

---

### 8. **TRANSACTION ID SUFFIX COLLISION**

**Location:** [components/Sales/index.tsx#L588-L595](components/Sales/index.tsx#L588-L595)

```typescript
if (cashUSD > 0) newTrx.push({ ...baseTrx, id: `TRX-${Date.now()}-1`, ... });
if (cashUZS > 0) newTrx.push({ ...baseTrx, id: `TRX-${Date.now()}-2`, ... });
if (cardUZS > 0) newTrx.push({ ...baseTrx, id: `TRX-${Date.now()}-3`, ... });
```

**Problem:** If `Date.now()` returns same value (common in fast execution), only the suffix differs. But if another user creates transactions at exact same millisecond, IDs WILL collide.

---

### 9. **NO OPTIMISTIC LOCKING / VERSION CONTROL**

The system has no mechanism to detect if a record was modified between read and write:

```typescript
// No version field like:
interface Product {
  id: string;
  version?: number;  // ❌ MISSING
  updatedAt?: string;  // Only timestamp, not version
}
```

**Why This Matters:**
- Can't detect "dirty read" scenarios
- Can't implement proper optimistic concurrency control
- `updatedAt` is unreliable for concurrency control

---

### 10. **GOOGLE SHEETS API LIMITS NOT HANDLED**

**Location:** [services/sheets/api.ts#L53](services/sheets/api.ts#L53)

```typescript
if (response.status === 429) {
  throw new Error('QUOTA_EXCEEDED: Превышен лимит запросов.');
}
```

**Problem:** Error is thrown but no queue/backoff mechanism exists. Heavy usage triggers:
1. Multiple users hit quota
2. Saves fail
3. Data remains only in local state
4. User refreshes → data lost

---

## 📋 MEDIUM ISSUES

### 11. **FIXED COLUMN RANGES IN API CALLS**

**Location:** [services/sheets/service.ts](services/sheets/service.ts)

```typescript
getProducts: (...) => getAll<Product>('products', accessToken, 'Products!A2:L', ...),
getOrders: (...) => getAll<Order>('orders', accessToken, 'Orders!A2:R', ...),
```

**Problem:** Hardcoded ranges (`A2:L`, `A2:R`) mean:
- Adding a column requires code changes
- If sheet structure changes, data corrupts silently
- Column M data in Products sheet would be ignored

---

### 12. **NO DATA VALIDATION BEFORE SAVE**

The system accepts any data without validation:

```typescript
// mappers.ts - Parsing is forgiving, saving is trusting
export function mapProductToRow(p: Product): unknown[] {
  return [
    p.id,  // No validation that ID exists
    p.name,  // No validation it's not empty
    p.type,  // No validation it's a valid ProductType
    // ...
  ];
}
```

---

### 13. **JOURNAL APPEND-ONLY BUT NO INTEGRITY CHECK**

**Location:** [services/sheets/service.ts#L367](services/sheets/service.ts#L367)

```typescript
addJournalEvent: async (accessToken: string, event: JournalEvent) => {
  await fetchSheets(accessToken, 'Journal!A:M', 'POST', { values: [mapJournalEventToRow(event)] });
}
```

**Problem:** Journal uses `POST` (append) which is safer, but:
- No check if event was actually written
- No retry on failure
- Journal can have gaps if network fails

---

## 🔍 ROOT CAUSE ANALYSIS

### Why Data "Opens Up" (Becomes Corrupted)

The primary causes of data corruption in this system are:

```
                    ┌─────────────────────────────────────┐
                    │     DATA CORRUPTION FLOW           │
                    └─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  RACE         │         │  DESYNC         │         │  OVERWRITE      │
│  CONDITIONS   │         │  STATE/SHEETS   │         │  PATTERN        │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Two users     │         │ Local state     │         │ Full table      │
│ edit same     │         │ differs from    │         │ clear + write   │
│ record        │         │ Sheets data     │         │ loses data      │
│ simultaneously│         │                 │         │ on failure      │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────┐
                    │         DATA CORRUPTION!           │
                    │   - Records overwritten            │
                    │   - Quantities wrong               │
                    │   - Changes lost                   │
                    │   - Duplicates created             │
                    └─────────────────────────────────────┘
```

### Specific Trigger Scenarios

1. **Column Addition Trigger:**
   - Add column X to Products sheet in Google Sheets
   - Mapper still reads `A2:L` (12 columns)
   - Column X data ignored on read
   - Save writes only 12 columns → Column X cleared!

2. **Formula Change Trigger:**
   - If any calculated fields exist in Sheets, app overwrites them
   - Array formulas get broken by data writes

3. **Concurrent Edit Trigger:**
   - User A opens Products page
   - User B edits and saves Product #5
   - User A edits Product #10 and saves
   - User A's save includes old Product #5 data
   - Merge sees User A's `updatedAt` is older for #5, but entire row was sent
   - Result: Depends on timing, often corrupts

---

## 🛡️ SAFE FIX STRATEGY

### Phase 1: Immediate Stabilization (1-2 days)

#### 1.1 Implement UUID for ID Generation

```typescript
// utils/idGenerator.ts - CREATE THIS FILE
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  const unique = crypto.randomUUID ? 
    crypto.randomUUID().substring(0, 8) : 
    Math.random().toString(36).substring(2, 10);
  
  return prefix ? `${prefix}-${timestamp}-${random}-${unique}` : 
    `${timestamp}-${random}-${unique}`;
}
```

**Replace all `Date.now().toString()` calls with `generateId()`**

#### 1.2 Add Version Field to All Types

```typescript
// types.ts - Add to each interface
export interface Product {
  id: string;
  version: number;  // ADD THIS
  updatedAt?: string;
  // ... other fields
}
```

#### 1.3 Save-After-Confirm Pattern

```typescript
// Change from:
setProducts(newProducts);
await saveProductsHandler(newProducts);

// To:
try {
  await saveProductsHandler(newProducts);
  setProducts(newProducts);  // Only update if save succeeded
  toast.success('Сохранено');
} catch (err) {
  toast.error('Ошибка сохранения. Данные не изменены.');
  // State unchanged, no corruption
}
```

### Phase 2: Architecture Improvements (1 week)

#### 2.1 Implement Row-Level Updates Instead of Full Table Overwrite

```typescript
// services/sheets/api.ts - ADD THIS
export async function updateRow(
  accessToken: string, 
  sheetName: string, 
  rowNumber: number, 
  values: unknown[]
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const range = `${sheetName}!A${rowNumber}:${getLastColumn(values.length)}${rowNumber}`;
  
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
}
```

#### 2.2 Implement Optimistic Locking

```typescript
// services/sheets/merge.ts - MODIFY
export function mergeByIdWithVersion<T extends { id: string; version: number }>(
  localItems: T[], 
  remoteItems: T[]
): { merged: T[], conflicts: T[] } {
  const conflicts: T[] = [];
  
  for (const localItem of localItems) {
    const remoteItem = merged.get(localItem.id);
    
    if (remoteItem && remoteItem.version !== localItem.version - 1) {
      // Conflict detected!
      conflicts.push({ local: localItem, remote: remoteItem });
    }
  }
  
  return { merged: Array.from(merged.values()), conflicts };
}
```

#### 2.3 Use Delta Merge for Products

```typescript
// services/sheets/service.ts - CHANGE
saveAllProducts: async (accessToken: string, products: Product[], baseProducts?: Product[]) => {
  // ... read remote ...
  
  const merged = mergeProductsWithDelta(products, remoteItems, baseProducts);
  
  // ... write ...
}
```

### Phase 3: Long-term Stability (2-4 weeks)

#### 3.1 Implement Change Queue

```typescript
// services/changeQueue.ts
interface ChangeEntry {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
}

class ChangeQueue {
  private queue: ChangeEntry[] = [];
  
  enqueue(entry: Omit<ChangeEntry, 'id' | 'timestamp' | 'status'>) {
    this.queue.push({
      ...entry,
      id: generateId('CHG'),
      timestamp: Date.now(),
      status: 'pending'
    });
    this.persist();
  }
  
  async sync() {
    for (const entry of this.queue.filter(e => e.status === 'pending')) {
      try {
        await this.processEntry(entry);
        entry.status = 'synced';
      } catch {
        entry.status = 'failed';
      }
    }
  }
}
```

#### 3.2 Migrate to Proper Database

Consider migrating to:
- **Firebase Firestore** - Real-time sync, automatic conflict resolution
- **Supabase** - PostgreSQL with real-time capabilities
- **PlanetScale** - MySQL with branching for safe schema changes

Keep Google Sheets as **read-only reporting layer** only.

---

## ✅ DO's and DON'Ts

### ✅ DO

| Action | Why |
|--------|-----|
| Use UUID for IDs | Prevents collisions |
| Save before updating local state | Prevents desync |
| Add version numbers to records | Enables conflict detection |
| Use row-level updates | Prevents data loss |
| Log all write operations | Enables audit trail |
| Implement retry with backoff | Handles API limits |
| Validate data before save | Prevents corruption |
| Test with multiple concurrent users | Catches race conditions |

### ❌ DON'T

| Action | Why |
|--------|-----|
| Use `Date.now()` for IDs | Causes collisions |
| Clear entire range before write | Causes data loss on failure |
| Update local state before save confirms | Causes desync |
| Trust `updatedAt` alone for merging | Clock skew issues |
| Ignore save errors | User thinks data is saved |
| Add columns to Sheets without code update | Data loss |
| Use formulas in data ranges | Gets overwritten |
| Allow parallel writes to related tables | Breaks referential integrity |

---

## 📋 DATA PROTECTION CHECKLIST

### Before Every Release

- [ ] All ID generations use UUID pattern
- [ ] No `Date.now().toString()` for IDs
- [ ] Save operations use try-catch with state rollback
- [ ] Column ranges match current sheet structure
- [ ] Merge logic handles missing `updatedAt`
- [ ] Error messages are user-friendly
- [ ] Network failure doesn't corrupt data

### Before Modifying Sheet Structure

- [ ] Backup all sheets first
- [ ] Update column ranges in code
- [ ] Update mappers (mapRowTo*, map*ToRow)
- [ ] Update TypeScript interfaces
- [ ] Test with production data copy
- [ ] Deploy code BEFORE changing sheet

### Weekly Maintenance

- [ ] Check for orphaned records (orders with invalid productIds)
- [ ] Verify client debt matches transaction sum
- [ ] Compare inventory quantities with journal entries
- [ ] Review error logs for failed saves

---

## 🏗️ RECOMMENDED ARCHITECTURE

### Current (Problematic)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  React App  │────▶│  API Layer  │────▶│Google Sheets│
│  (State)    │◀────│  (Direct)   │◀────│  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │         PROBLEM: Desync               │
       └───────────────────────────────────────┘
```

### Recommended (Safe)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  React App  │────▶│Change Queue │────▶│  Database   │────▶│Google Sheets│
│  (Local)    │◀────│  (Buffer)   │◀────│  (Primary)  │     │  (Reports)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │    ┌──────────────┘                   │
       │    ▼                                  │
       │  ┌─────────────┐                      │
       └─▶│IndexedDB    │◀─────────────────────┘
          │(Offline)    │     One-way sync
          └─────────────┘
```

---

## 📊 PRIORITY ACTION MATRIX

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Fix ID generation | HIGH | LOW | **P0** |
| Save-after-confirm | HIGH | LOW | **P0** |
| Add version field | HIGH | MEDIUM | **P1** |
| Row-level updates | HIGH | HIGH | **P1** |
| Use delta merge | MEDIUM | LOW | **P1** |
| Change queue | MEDIUM | HIGH | **P2** |
| Database migration | HIGH | VERY HIGH | **P3** |

---

## 📝 FINAL RECOMMENDATIONS

1. **Immediate (Today):**
   - Implement UUID for ID generation
   - Change save pattern to confirm-then-update
   - Add error boundaries around save operations

2. **This Week:**
   - Add version field to all entities
   - Implement row-level updates for Products
   - Enable delta merge for inventory

3. **This Month:**
   - Implement offline-first architecture with IndexedDB
   - Add change queue for reliable syncing
   - Create data integrity monitoring dashboard

4. **Long Term:**
   - Migrate to proper database (Firestore/Supabase)
   - Use Google Sheets only for reporting/dashboards
   - Implement real-time sync with WebSockets

---

**Report Generated:** January 8, 2026  
**Confidence Level:** HIGH (based on complete codebase analysis)  
**Data at Risk:** All production data in current architecture

---

*This report identifies critical data integrity issues. Implementation of P0 fixes should begin immediately to prevent further data corruption.*
