import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { setConflictHandler } from '../services/sheetsService';

interface ConflictItem {
  local: { id: string; _version?: number };
  remote: { id: string; _version?: number };
}

/**
 * Хук для настройки глобального обработчика конфликтов версий.
 * Показывает toast-уведомление когда данные пользователя перезаписаны
 * более новой версией с сервера.
 */
export function useConflictHandler(): void {
  const toast = useToast();

  useEffect(() => {
    setConflictHandler((conflicts: ConflictItem[]) => {
      if (conflicts.length === 0) return;

      const count = conflicts.length;
      const ids = conflicts.slice(0, 3).map(c => c.local.id).join(', ');
      const suffix = count > 3 ? ` и ещё ${count - 3}...` : '';

      toast.warning(
        `⚠️ ${count} запись(ей) обновлены другим пользователем: ${ids}${suffix}. Ваши изменения были объединены.`,
        8000
      );
    });

    // Cleanup: сбрасываем обработчик при размонтировании
    return () => {
      setConflictHandler(null);
    };
  }, [toast]);
}
