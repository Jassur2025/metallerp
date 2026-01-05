import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

/**
 * Компонент предупреждения об истечении токена
 * Показывается когда до истечения OAuth токена остается менее 5 минут
 */
export const TokenExpiryWarning: React.FC = () => {
  const { isTokenExpiringSoon, tokenExpiresAt, silentRefresh, logout } = useAuth();
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState<string>('');

  // Update countdown
  React.useEffect(() => {
    if (!isTokenExpiringSoon || !tokenExpiresAt) return;

    const updateTimeLeft = () => {
      const remaining = tokenExpiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft('истёк');
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [isTokenExpiringSoon, tokenExpiresAt]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await silentRefresh();
    } catch {
      // Error will be logged in AuthContext
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isTokenExpiringSoon) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className={`${t.bgCard} border-2 border-amber-500/50 rounded-xl p-4 shadow-xl max-w-sm`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="text-amber-500" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${t.text} text-sm`}>
              Сессия истекает
            </h4>
            <p className={`text-xs ${t.textMuted} mt-1`}>
              Токен доступа истечёт через <span className="font-mono font-bold text-amber-500">{timeLeft}</span>
            </p>
            <p className={`text-xs ${t.textMuted} mt-1`}>
              Обновите сессию, чтобы продолжить работу.
            </p>
            
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Обновление...' : 'Обновить'}
              </button>
              <button
                onClick={logout}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${t.bgInput} ${t.textSecondary} hover:${t.text} text-xs font-medium rounded-lg transition-colors border ${t.border}`}
              >
                <LogOut size={14} />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenExpiryWarning;
