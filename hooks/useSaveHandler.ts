import { useCallback, useRef } from 'react';
import { sheetsService } from '../services/sheetsService';
import { withUpdatedAtBatch } from '../services/sheets/merge';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

interface SaveOptions {
  /** Имя сущности для логирования (напр. "products", "orders") */
  name: string;
  /** Функция сервиса для сохранения (напр. sheetsService.saveProducts) */
  saveMethod: (data: any[]) => Promise<void>;
  /** Callback при успешном сохранении */
  onSuccess?: () => void;
  /** Callback при ошибке */
  onError?: (error: Error) => void;
  /** Функция для получения актуального токена */
  getAccessToken: () => string | null;
  /** Функция для обновления токена */
  refreshToken?: () => Promise<string | null>;
}

/**
 * Универсальный хук для создания обработчиков сохранения данных.
 * Устраняет дублирование кода в handleSaveProducts, handleSaveOrders и т.д.
 * 
 * Включает:
 * - Автоматическое обновление updatedAt для всех записей
 * - Защиту от повторных вызовов (debounce)
 * - Единообразную обработку ошибок
 * - Автоматическое обновление токена при истечении
 */
export function useSaveHandler<T extends { id: string }>(options: SaveOptions) {
  const { name, saveMethod, onSuccess, onError, getAccessToken, refreshToken } = options;
  
  // Защита от повторных вызовов
  const isSaving = useRef(false);
  
  const save = useCallback(async (data: T[]): Promise<boolean> => {
    // Предотвращаем параллельные сохранения
    if (isSaving.current) {
      logDev(`[${name}] Сохранение уже в процессе, пропускаем`);
      return false;
    }

    const token = getAccessToken();
    if (!token) {
      errorDev(`[${name}] Нет токена доступа`);
      onError?.(new Error('Нет токена доступа'));
      return false;
    }

    isSaving.current = true;

    try {
      // Добавляем updatedAt ко всем записям
      const dataWithTimestamp = withUpdatedAtBatch(data);
      
      logDev(`[${name}] Сохранение ${dataWithTimestamp.length} записей...`);
      await saveMethod(dataWithTimestamp);
      logDev(`[${name}] ✅ Успешно сохранено`);
      
      onSuccess?.();
      return true;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('401') ||
        errorMessage.includes('токен доступа истек');

      if (isAuthError && refreshToken) {
        logDev(`[${name}] Токен истек, пробуем обновить...`);
        try {
          const newToken = await refreshToken();
          if (newToken) {
            // Повторяем сохранение с новым токеном
            await sheetsService.initialize(newToken);
            const dataWithTimestamp = withUpdatedAtBatch(data);
            await saveMethod(dataWithTimestamp);
            logDev(`[${name}] ✅ Успешно сохранено после обновления токена`);
            onSuccess?.();
            return true;
          }
        } catch (retryError) {
          errorDev(`[${name}] Ошибка при повторной попытке:`, retryError);
        }
      }

      errorDev(`[${name}] ❌ Ошибка сохранения:`, error);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
      
    } finally {
      isSaving.current = false;
    }
  }, [name, saveMethod, onSuccess, onError, getAccessToken, refreshToken]);

  return { save, isSaving: isSaving.current };
}

/**
 * Фабрика для создания типизированных save-функций.
 * Используется когда нужно создать несколько обработчиков с общей конфигурацией.
 */
export function createSaveHandlerFactory(
  getAccessToken: () => string | null,
  refreshToken?: () => Promise<string | null>
) {
  return function createHandler<T extends { id: string }>(
    name: string,
    saveMethod: (data: T[]) => Promise<void>,
    callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) {
    let isSaving = false;

    return async (data: T[]): Promise<boolean> => {
      if (isSaving) {
        logDev(`[${name}] Сохранение уже в процессе, пропускаем`);
        return false;
      }

      const token = getAccessToken();
      if (!token) {
        errorDev(`[${name}] Нет токена доступа`);
        callbacks?.onError?.(new Error('Нет токена доступа'));
        return false;
      }

      isSaving = true;

      try {
        const dataWithTimestamp = withUpdatedAtBatch(data);
        logDev(`[${name}] Сохранение ${dataWithTimestamp.length} записей...`);
        await saveMethod(dataWithTimestamp);
        logDev(`[${name}] ✅ Успешно сохранено`);
        callbacks?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAuthError = errorMessage.includes('UNAUTHENTICATED') ||
          errorMessage.includes('401') ||
          errorMessage.includes('токен доступа истек');

        if (isAuthError && refreshToken) {
          logDev(`[${name}] Токен истек, пробуем обновить...`);
          try {
            const newToken = await refreshToken();
            if (newToken) {
              await sheetsService.initialize(newToken);
              const dataWithTimestamp = withUpdatedAtBatch(data);
              await saveMethod(dataWithTimestamp);
              logDev(`[${name}] ✅ Успешно сохранено после обновления токена`);
              callbacks?.onSuccess?.();
              return true;
            }
          } catch (retryError) {
            errorDev(`[${name}] Ошибка при повторной попытке:`, retryError);
          }
        }

        errorDev(`[${name}] ❌ Ошибка сохранения:`, error);
        callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage));
        return false;
      } finally {
        isSaving = false;
      }
    };
  };
}
