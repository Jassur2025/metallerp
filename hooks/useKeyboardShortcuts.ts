import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook для глобальных клавиатурных сокращений
 * 
 * @example
 * useKeyboardShortcuts([
 *   { key: 's', ctrl: true, action: handleSave, description: 'Сохранить' },
 *   { key: 'n', ctrl: true, action: handleNew, description: 'Новая запись' },
 *   { key: 'Escape', action: handleClose, description: 'Закрыть' },
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas (except Escape)
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                        event.code.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        // Special handling for Escape - always work
        const isEscape = shortcut.key.toLowerCase() === 'escape';

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // Allow Escape in inputs, but block other shortcuts
          if (isInput && !isEscape && !shortcut.ctrl) continue;

          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, preventDefault]);
}

/**
 * Hook для отдельного shortcut
 */
export function useKeyboardShortcut(
  key: string,
  action: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean; enabled?: boolean } = {}
) {
  const { ctrl, shift, alt, enabled = true } = options;
  
  useKeyboardShortcuts([
    { key, ctrl, shift, alt, action, enabled }
  ], { enabled });
}

/**
 * Стандартные shortcuts для приложения
 */
export const STANDARD_SHORTCUTS = {
  SAVE: { key: 's', ctrl: true, description: 'Сохранить (Ctrl+S)' },
  NEW: { key: 'n', ctrl: true, description: 'Новая запись (Ctrl+N)' },
  CLOSE: { key: 'Escape', description: 'Закрыть (Esc)' },
  SEARCH: { key: 'k', ctrl: true, description: 'Поиск (Ctrl+K)' },
  DELETE: { key: 'Delete', description: 'Удалить (Delete)' },
  UNDO: { key: 'z', ctrl: true, description: 'Отмена (Ctrl+Z)' },
  REFRESH: { key: 'r', ctrl: true, description: 'Обновить (Ctrl+R)' },
} as const;

/**
 * Форматирует shortcut для отображения
 */
export function formatShortcut(shortcut: Partial<KeyboardShortcut>): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  
  let key = shortcut.key || '';
  // Красивые названия клавиш
  const keyNames: Record<string, string> = {
    'escape': 'Esc',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'enter': 'Enter',
    'delete': 'Del',
    'backspace': '⌫',
    'space': 'Space',
  };
  key = keyNames[key.toLowerCase()] || key.toUpperCase();
  parts.push(key);
  
  return parts.join('+');
}

export default useKeyboardShortcuts;
