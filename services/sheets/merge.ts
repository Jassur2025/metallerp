/**
 * Интерфейс для записей с поддержкой синхронизации
 */
interface SyncableRecord {
  id: string;
  updatedAt?: string;
  _version?: number;
}

/**
 * Интерфейс для товаров с количеством
 */
interface ProductRecord extends SyncableRecord {
  quantity?: number;
  costPrice?: number;
}

/**
 * Умное слияние локальных и удаленных данных.
 * 
 * Логика приоритета:
 * 1. Если у записи есть updatedAt — побеждает более новая версия
 * 2. Если updatedAt нет — локальная версия имеет приоритет (обратная совместимость)
 * 3. Новые записи (есть только в одном источнике) добавляются
 * 
 * @param localItems - Локальные данные (из state приложения)
 * @param remoteItems - Удаленные данные (из Google Sheets)
 * @returns Слитый массив с самыми актуальными версиями
 */
export function mergeById<T extends SyncableRecord>(localItems: T[], remoteItems: T[]): T[] {
  const merged = new Map<string, T>();
  
  // Сначала добавляем все удаленные записи
  for (const item of remoteItems) {
    merged.set(item.id, item);
  }
  
  // Затем обрабатываем локальные записи
  for (const localItem of localItems) {
    const remoteItem = merged.get(localItem.id);
    
    if (!remoteItem) {
      // Запись есть только локально — добавляем её
      merged.set(localItem.id, localItem);
    } else {
      // Запись есть в обоих источниках — сравниваем по дате
      const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const remoteTime = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;
      
      if (localTime >= remoteTime) {
        // Локальная версия новее или равна — используем её
        merged.set(localItem.id, localItem);
      }
      // Иначе оставляем удаленную версию (она уже в Map)
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Специальное слияние для товаров с учётом quantity.
 * 
 * ВАЖНО: При одновременном изменении товара разными пользователями:
 * - Вычисляем дельту (разницу) локального изменения
 * - Применяем дельту к удалённому значению
 * - Это позволяет корректно складывать приходы от разных пользователей
 * 
 * Пример:
 * - Изначально на складе: 100 шт
 * - Пользователь A добавляет 50 шт → локально 150, дельта +50
 * - Пользователь B добавляет 30 шт → remote стало 130
 * - Merge: 130 + 50 = 180 (правильно!)
 * 
 * @param localItems - Локальные данные (из state приложения)  
 * @param remoteItems - Удаленные данные (из Google Sheets)
 * @param baseItems - Базовые данные (до локальных изменений) - опционально
 */
export function mergeProductsWithDelta<T extends ProductRecord>(
  localItems: T[], 
  remoteItems: T[],
  baseItems?: T[]
): T[] {
  const merged = new Map<string, T>();
  const baseMap = new Map<string, T>();
  
  // Создаём карту базовых значений (если есть)
  if (baseItems) {
    for (const item of baseItems) {
      baseMap.set(item.id, item);
    }
  }
  
  // Сначала добавляем все удаленные записи
  for (const item of remoteItems) {
    merged.set(item.id, item);
  }
  
  // Затем обрабатываем локальные записи
  for (const localItem of localItems) {
    const remoteItem = merged.get(localItem.id);
    const baseItem = baseMap.get(localItem.id);
    
    if (!remoteItem) {
      // Запись есть только локально — добавляем её
      merged.set(localItem.id, localItem);
    } else {
      // Запись есть в обоих источниках
      const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const remoteTime = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;
      
      // Если есть базовое значение и оба изменили quantity - применяем дельту
      if (baseItem && localItem.quantity !== undefined && remoteItem.quantity !== undefined) {
        const localDelta = (localItem.quantity || 0) - (baseItem.quantity || 0);
        const remoteDelta = (remoteItem.quantity || 0) - (baseItem.quantity || 0);
        
        // Если оба изменили - складываем изменения
        if (localDelta !== 0 && remoteDelta !== 0) {
          const mergedQuantity = (baseItem.quantity || 0) + localDelta + remoteDelta;
          
          // Пересчитываем среднюю себестоимость если нужно
          let mergedCostPrice = localItem.costPrice;
          if (localItem.costPrice !== undefined && remoteItem.costPrice !== undefined && baseItem.costPrice !== undefined) {
            // Средневзвешенная цена
            const localValue = localDelta * (localItem.costPrice || 0);
            const remoteValue = remoteDelta * (remoteItem.costPrice || 0);
            const baseValue = (baseItem.quantity || 0) * (baseItem.costPrice || 0);
            mergedCostPrice = mergedQuantity > 0 ? (baseValue + localValue + remoteValue) / mergedQuantity : 0;
          }
          
          merged.set(localItem.id, {
            ...localItem,
            quantity: Math.max(0, mergedQuantity), // Не допускаем отрицательное количество
            costPrice: mergedCostPrice,
            updatedAt: new Date().toISOString() // Обновляем время
          });
          continue;
        }
      }
      
      // Стандартная логика - побеждает более новая версия
      if (localTime >= remoteTime) {
        merged.set(localItem.id, localItem);
      }
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Добавляет/обновляет поле updatedAt для записи
 */
export function withUpdatedAt<T extends { id: string }>(item: T): T & { updatedAt: string } {
  return {
    ...item,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Пакетно обновляет updatedAt для массива записей
 */
export function withUpdatedAtBatch<T extends { id: string }>(items: T[]): (T & { updatedAt: string })[] {
  const now = new Date().toISOString();
  return items.map(item => ({
    ...item,
    updatedAt: now
  }));
}

/**
 * Инкрементирует версию записи для optimistic concurrency control
 * @param item - Запись для обновления
 * @returns Запись с инкрементированной версией и обновлённым updatedAt
 */
export function withIncrementedVersion<T extends SyncableRecord>(item: T): T & { _version: number; updatedAt: string } {
  return {
    ...item,
    _version: (item._version ?? 0) + 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Пакетно инкрементирует версии для массива записей
 */
export function withIncrementedVersionBatch<T extends SyncableRecord>(items: T[]): (T & { _version: number; updatedAt: string })[] {
  const now = new Date().toISOString();
  return items.map(item => ({
    ...item,
    _version: (item._version ?? 0) + 1,
    updatedAt: now
  }));
}

/**
 * Проверяет конфликт версий между локальной и удалённой записью
 * @returns true если есть конфликт (удалённая версия новее)
 */
export function hasVersionConflict<T extends SyncableRecord>(local: T, remote: T): boolean {
  const localVersion = local._version ?? 0;
  const remoteVersion = remote._version ?? 0;
  
  // Конфликт если удалённая версия выше локальной
  return remoteVersion > localVersion;
}

/**
 * Умное слияние с учётом версий (optimistic concurrency control)
 * 
 * Приоритет:
 * 1. Если версия равна - используем updatedAt для разрешения
 * 2. Если локальная версия выше - локальные данные победили
 * 3. Если удалённая версия выше - нужно слить или отклонить локальные изменения
 */
export function mergeByIdWithVersion<T extends SyncableRecord>(
  localItems: T[], 
  remoteItems: T[],
  conflictHandler?: (local: T, remote: T) => T
): { merged: T[]; conflicts: Array<{ local: T; remote: T }> } {
  const merged = new Map<string, T>();
  const conflicts: Array<{ local: T; remote: T }> = [];
  
  // Сначала добавляем все удаленные записи
  for (const item of remoteItems) {
    merged.set(item.id, item);
  }
  
  // Затем обрабатываем локальные записи
  for (const localItem of localItems) {
    const remoteItem = merged.get(localItem.id);
    
    if (!remoteItem) {
      // Запись есть только локально — добавляем её
      merged.set(localItem.id, localItem);
    } else {
      const localVersion = localItem._version ?? 0;
      const remoteVersion = remoteItem._version ?? 0;
      
      if (localVersion > remoteVersion) {
        // Локальная версия новее - используем её
        merged.set(localItem.id, localItem);
      } else if (localVersion < remoteVersion) {
        // Удалённая версия новее - конфликт
        if (conflictHandler) {
          // Используем handler для разрешения
          merged.set(localItem.id, conflictHandler(localItem, remoteItem));
        } else {
          // Записываем конфликт для ручного разрешения
          conflicts.push({ local: localItem, remote: remoteItem });
          // По умолчанию оставляем удалённую версию
        }
      } else {
        // Версии равны - сравниваем по updatedAt
        const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
        const remoteTime = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;
        
        if (localTime >= remoteTime) {
          merged.set(localItem.id, localItem);
        }
      }
    }
  }
  
  return { merged: Array.from(merged.values()), conflicts };
}
