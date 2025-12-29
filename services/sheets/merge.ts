/**
 * Интерфейс для записей с поддержкой синхронизации
 */
interface SyncableRecord {
  id: string;
  updatedAt?: string;
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








