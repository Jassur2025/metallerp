import React from 'react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Базовый Skeleton компонент
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'md',
}) => {
  const { theme } = useTheme();
  
  const roundedClass = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  const bgClass = theme === 'light' 
    ? 'bg-slate-200' 
    : 'bg-slate-700';

  return (
    <div
      className={`animate-pulse ${bgClass} ${roundedClass} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};

/**
 * Skeleton для текста
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
};

/**
 * Skeleton для карточки товара/клиента
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 space-y-3 ${className}`}>
      <div className="flex justify-between items-start">
        <Skeleton width="60%" height={20} />
        <div className="flex gap-2">
          <Skeleton width={32} height={32} rounded="lg" />
          <Skeleton width={32} height={32} rounded="lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton width="40%" height={12} className="mb-1" />
            <Skeleton width="70%" height={16} />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton для строки таблицы
 */
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 6 }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b ${t.border}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width="100%" height={16} className="flex-1" />
      ))}
    </div>
  );
};

/**
 * Skeleton для таблицы
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
      {/* Header */}
      <div className={`${t.bgPanelAlt} px-4 py-3 flex gap-4`}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="100%" height={14} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
};

/**
 * Skeleton для статистики/карточек метрик
 */
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${t.bgCard} rounded-xl border ${t.border} p-4`}>
          <Skeleton width={40} height={40} rounded="lg" className="mb-3" />
          <Skeleton width="40%" height={12} className="mb-2" />
          <Skeleton width="60%" height={24} />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton для списка
 */
export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
  count = 5,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/**
 * Full page loading skeleton
 */
export const SkeletonPage: React.FC = () => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  return (
    <div className={`p-6 space-y-6 ${t.bg} min-h-screen`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton width={200} height={28} className="mb-2" />
          <Skeleton width={300} height={16} />
        </div>
        <Skeleton width={120} height={40} rounded="lg" />
      </div>

      {/* Stats */}
      <SkeletonStats count={4} />

      {/* Table */}
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
};

export default Skeleton;
