import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => React.ReactNode;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  className?: string;
}

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 56,
  emptyMessage = 'Нет данных',
  onRowClick,
  getRowKey,
  className = '',
}: VirtualTableProps<T>) {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 10, // Render 10 extra items above/below viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0) {
    return (
      <div className={`${t.bgCard} rounded-xl border ${t.border} p-12 text-center ${t.textMuted}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden ${t.shadow} ${className}`}>
      {/* Header */}
      <div className={`${t.bgPanelAlt} text-xs uppercase tracking-wider ${t.textMuted} font-medium flex`}>
        {columns.map((col, idx) => (
          <div
            key={String(col.key) + idx}
            className={`px-4 py-3 ${col.width || 'flex-1'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 320px)' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            return (
              <div
                key={getRowKey(item)}
                className={`absolute top-0 left-0 w-full flex items-center ${t.bgCardHover} transition-colors border-b ${t.border} ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  height: `${rowHeight}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col, colIdx) => (
                  <div
                    key={String(col.key) + colIdx}
                    className={`px-4 ${col.width || 'flex-1'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${t.text}`}
                  >
                    {col.render(item, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className={`px-4 py-2 ${t.bgPanelAlt} border-t ${t.border} text-xs ${t.textMuted}`}>
        Всего: {data.length} записей
      </div>
    </div>
  );
}

// Mobile Virtual List Component
interface VirtualListProps<T> {
  data: T[];
  rowHeight?: number;
  emptyMessage?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  getRowKey: (item: T) => string;
  className?: string;
}

export function VirtualList<T>({
  data,
  rowHeight = 160,
  emptyMessage = 'Нет данных',
  renderItem,
  getRowKey,
  className = '',
}: VirtualListProps<T>) {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0) {
    return (
      <div className={`${t.bgCard} rounded-xl border ${t.border} p-12 text-center ${t.textMuted}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = data[virtualRow.index];
          return (
            <div
              key={getRowKey(item)}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
                padding: '6px 0',
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualTable;
