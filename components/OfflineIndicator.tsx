import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Offline индикатор с красивым UI
 * Показывается когда нет интернета
 */
export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      setDismissed(false);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Reset dismissed when going offline again
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  // Don't show if dismissed or online (unless just reconnected)
  if (dismissed || (isOnline && !showReconnected)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      {!isOnline ? (
        // Offline banner
        <div className="flex items-center gap-3 bg-red-500/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-lg border border-red-400/20">
          <div className="p-2 bg-red-600/50 rounded-lg">
            <WifiOff size={20} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Нет подключения к интернету</p>
            <p className="text-red-200 text-xs">Изменения будут сохранены при восстановлении связи</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-red-600/50 rounded-lg transition-colors"
            title="Обновить страницу"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-red-600/50 rounded-lg transition-colors"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
      ) : showReconnected ? (
        // Reconnected banner
        <div className="flex items-center gap-3 bg-emerald-500/95 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-400/20">
          <div className="p-2 bg-emerald-600/50 rounded-lg">
            <Wifi size={20} />
          </div>
          <div>
            <p className="font-medium text-sm">Подключение восстановлено</p>
            <p className="text-emerald-200 text-xs">Синхронизация данных...</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Компактный индикатор в header
 */
export const NetworkStatusBadge: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg">
      <WifiOff size={14} className="text-red-400" />
      <span className="text-xs text-red-400 font-medium">Офлайн</span>
    </div>
  );
};

export default OfflineIndicator;
