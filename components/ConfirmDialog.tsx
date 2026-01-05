import React, { useState, useCallback, createContext, useContext } from 'react';
import { AlertTriangle, Trash2, X, Check, Info, AlertCircle } from 'lucide-react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (itemName: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
};

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        ...options,
        variant: options.variant || 'warning',
        confirmText: options.confirmText || 'Подтвердить',
        cancelText: options.cancelText || 'Отмена',
        resolve,
      });
    });
  }, []);

  const confirmDelete = useCallback((itemName: string): Promise<boolean> => {
    return confirm({
      title: 'Удалить?',
      message: `Вы уверены, что хотите удалить "${itemName}"? Это действие нельзя отменить.`,
      variant: 'danger',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });
  }, [confirm]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  return (
    <ConfirmContext.Provider value={{ confirm, confirmDelete }}>
      {children}
      {state.isOpen && (
        <ConfirmDialog
          {...state}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
};

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  variant = 'warning',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'Escape', action: onCancel },
    { key: 'Enter', action: onConfirm },
  ]);

  const variantConfig = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-500',
      buttonBg: 'bg-red-600 hover:bg-red-500',
      borderColor: 'border-red-500/20',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-500',
      buttonBg: 'bg-amber-600 hover:bg-amber-500',
      borderColor: 'border-amber-500/20',
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
      buttonBg: 'bg-blue-600 hover:bg-blue-500',
      borderColor: 'border-blue-500/20',
    },
    success: {
      icon: Check,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-500',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-500',
      borderColor: 'border-emerald-500/20',
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div 
        className={`${t.bgCard} rounded-2xl border ${config.borderColor} shadow-2xl max-w-md w-full overflow-hidden animate-scale-in`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 pb-4 flex items-start gap-4`}>
          <div className={`p-3 ${config.iconBg} rounded-xl flex-shrink-0`}>
            <Icon className={config.iconColor} size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${t.text}`}>{title}</h3>
            <p className={`mt-2 text-sm ${t.textMuted} leading-relaxed`}>{message}</p>
          </div>
          <button
            onClick={onCancel}
            className={`p-1 ${t.textMuted} hover:${t.text} rounded-lg transition-colors`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className={`px-6 py-4 ${t.bgPanelAlt} border-t ${t.border} flex justify-end gap-3`}>
          <button
            onClick={onCancel}
            className={`px-4 py-2.5 ${t.bgInput} ${t.textSecondary} hover:${t.text} text-sm font-medium rounded-xl transition-colors border ${t.border}`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 ${config.buttonBg} text-white text-sm font-medium rounded-xl transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmProvider;
