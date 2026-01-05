import React, { useState } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertOctagon, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Fallback UI when error is caught
 */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-500/10 border-b border-red-500/20 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <AlertOctagon className="text-red-400" size={32} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Упс! Что-то пошло не так
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Произошла непредвиденная ошибка
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error message */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-300 text-sm font-mono">
              {error?.message || 'Unknown error'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={resetErrorBoundary}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
            >
              <RefreshCw size={18} />
              Попробовать снова
            </button>
            <button
              onClick={handleReload}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              <RefreshCw size={18} />
              Перезагрузить
            </button>
            <button
              onClick={handleGoHome}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              <Home size={18} />
              На главную
            </button>
          </div>

          {/* Technical details toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            <Bug size={16} />
            Технические детали
            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Technical details */}
          {showDetails && (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 overflow-auto max-h-48">
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                {error?.stack || 'No stack trace available'}
              </pre>
            </div>
          )}

          {/* Help text */}
          <p className="text-slate-500 text-xs">
            Если ошибка повторяется, попробуйте очистить кэш браузера или обратитесь к администратору.
          </p>
        </div>
      </div>
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

/**
 * Error Boundary компонент с красивым UI
 * Использует react-error-boundary под капотом
 */
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, onError }) => {
  const handleError = (error: Error, info: React.ErrorInfo) => {
    console.error('ErrorBoundary caught an error:', error, info);
    onError?.(error, info);
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset state when user clicks "Try again"
        console.log('Error boundary reset');
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export { ReactErrorBoundary, ErrorFallback };
export default ErrorBoundary;
