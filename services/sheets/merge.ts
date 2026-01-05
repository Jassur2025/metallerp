/**
 * Интерфейс для записей с поддержкой синхронизации
 */
interface SyncableRecord {
  id: string;
  updatedAt?: string;
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








