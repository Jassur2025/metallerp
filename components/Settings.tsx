
import React, { useState } from 'react';
import { AppSettings, ExpenseCategory, ExpensePnLCategory } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { Save, Settings as SettingsIcon, AlertCircle, Database, CheckCircle, XCircle, Loader2, Send, Plus, Trash2, Receipt, RefreshCw } from 'lucide-react';
import { getSpreadsheetId, saveSpreadsheetId, sheetsService } from '../services/sheetsService';
import { telegramService } from '../services/telegramService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

// Компонент кнопки очистки данных
const ClearDataButton: React.FC<{ accessToken: string | null }> = ({ accessToken }) => {
    const [status, setStatus] = useState<'idle' | 'confirm' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    const handleClear = async () => {
        if (status === 'idle') {
            setStatus('confirm');
            return;
        }
        
        if (status === 'confirm') {
            if (!accessToken) {
                setMessage('Нет токена доступа');
                setStatus('error');
                return;
            }
            
            setStatus('loading');
            try {
                const result = await sheetsService.clearAllData(accessToken);
                setMessage(result);
                setStatus('success');
                // Перезагрузить страницу через 2 секунды
                setTimeout(() => window.location.reload(), 2000);
            } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Ошибка');
                setStatus('error');
            }
        }
    };

    const handleCancel = () => {
        setStatus('idle');
        setMessage('');
    };

    return (
        <div className="flex items-center gap-3">
            {status === 'confirm' && (
                <button
                    onClick={handleCancel}
                    className={`px-4 py-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} rounded-lg text-sm transition-colors`}
                >
                    Отмена
                </button>
            )}
            <button
                onClick={handleClear}
                disabled={status === 'loading' || status === 'success'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    status === 'confirm' 
                        ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                        : status === 'loading'
                        ? 'bg-red-600/50 text-white cursor-wait'
                        : status === 'success'
                        ? 'bg-emerald-600 text-white'
                        : status === 'error'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                }`}
            >
                {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
                {status === 'success' && <CheckCircle size={16} />}
                {status === 'error' && <XCircle size={16} />}
                {status === 'idle' && <Trash2 size={16} />}
                {status === 'confirm' && <AlertCircle size={16} />}
                
                {status === 'idle' && 'Очистить все данные'}
                {status === 'confirm' && 'Подтвердить удаление?'}
                {status === 'loading' && 'Удаление...'}
                {status === 'success' && 'Удалено! Перезагрузка...'}
                {status === 'error' && message}
            </button>
        </div>
    );
};

// Дефолтные категории расходов
const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'rent', name: 'Аренда земельных участков, зданий и сооружений', pnlCategory: 'administrative' },
    { id: 'special_equipment', name: 'Аренда специальной техники', pnlCategory: 'operational' },
    { id: 'bank_fees', name: 'Банковские комиссии', pnlCategory: 'administrative' },
    { id: 'sales_bonus', name: 'Бонусы от продаж', pnlCategory: 'commercial' },
    { id: 'customs', name: 'Государственные пошлины', pnlCategory: 'administrative' },
    { id: 'salary', name: 'Зарплата', pnlCategory: 'administrative' },
    { id: 'crane_costs', name: 'Затраты крана', pnlCategory: 'operational' },
    { id: 'food', name: 'Затраты питания', pnlCategory: 'operational' },
    { id: 'corporate_events', name: 'Затраты по корпоративно-культурным мероприятиям', pnlCategory: 'operational' },
    { id: 'office_supplies', name: 'Канцелярские затраты', pnlCategory: 'administrative' },
    { id: 'business_trips', name: 'Командировки и встречи', pnlCategory: 'administrative' },
    { id: 'utilities', name: 'Коммунальные затраты', pnlCategory: 'administrative' },
    { id: 'training', name: 'Корпоративное обучение', pnlCategory: 'administrative' },
    { id: 'corporate_gifts', name: 'Корпоративные подарки', pnlCategory: 'administrative' },
    { id: 'courier_fuel', name: 'Курьерские\\ГСМ затраты', pnlCategory: 'administrative' },
    { id: 'marketing', name: 'Маркетинг и реклама', pnlCategory: 'commercial' },
    { id: 'loading', name: 'Погрузочные затраты', pnlCategory: 'commercial' },
    { id: 'postal', name: 'Почтовые затраты', pnlCategory: 'administrative' },
    { id: 'bonus', name: 'Премии', pnlCategory: 'commercial' },
    { id: 'professional_services', name: 'Профессиональные услуги', pnlCategory: 'administrative' },
    { id: 'other_services', name: 'Прочие услуги', pnlCategory: 'administrative' },
    { id: 'metal_services', name: 'Прочие услуги по металл сервису', pnlCategory: 'operational' },
    { id: 'materials', name: 'Расходные материалы для обработки металла', pnlCategory: 'operational' },
    { id: 'overtime', name: 'Сверхурочная работа', pnlCategory: 'operational' },
    { id: 'internet', name: 'Связь и интернет', pnlCategory: 'administrative' },
    { id: 'social', name: 'Социальная политика', pnlCategory: 'administrative' },
    { id: 'construction', name: 'Строительные затраты', pnlCategory: 'operational' },
    { id: 'telecom_it', name: 'Телекоммуникации и ИТ', pnlCategory: 'administrative' },
    { id: 'os_maintenance', name: 'Техническое обслуживание ОС', pnlCategory: 'administrative' },
    { id: 'transport_purchases', name: 'Транспортные услуги при закупках', pnlCategory: 'operational' },
    { id: 'crane_services', name: 'Услуги крана при закупках', pnlCategory: 'operational' },
    { id: 'insurance', name: 'Услуги страхования', pnlCategory: 'commercial' },
    { id: 'household', name: 'Хозяйственные затраты', pnlCategory: 'administrative' },
];

interface SettingsProps {
    settings: AppSettings;
    onSave: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const { accessToken } = useAuth();
    const envSheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || '';
    const envBotToken = import.meta.env.VITE_BOT_TOKEN || '';
    const envChatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || import.meta.env.VITE_ADMIN_CHAT_ID || '';

    const isSheetFromEnv = Boolean(envSheetId);
    const isBotFromEnv = Boolean(envBotToken);
    const isChatFromEnv = Boolean(envChatId);

    const [formData, setFormData] = useState<AppSettings>({
        ...settings,
        telegramBotToken: envBotToken || settings.telegramBotToken,
        telegramChatId: envChatId || settings.telegramChatId,
        expenseCategories: settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
    });
    const [message, setMessage] = useState<string | null>(null);

    // Expense Categories State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryPnL, setNewCategoryPnL] = useState<ExpensePnLCategory>('administrative');

    const addExpenseCategory = () => {
        if (!newCategoryName.trim()) return;
        const newCat: ExpenseCategory = {
            id: IdGenerator.generate('CAT'),
            name: newCategoryName.trim(),
            pnlCategory: newCategoryPnL
        };
        setFormData(prev => ({
            ...prev,
            expenseCategories: [...(prev.expenseCategories || []), newCat]
        }));
        setNewCategoryName('');
    };

    const removeExpenseCategory = (id: string) => {
        setFormData(prev => ({
            ...prev,
            expenseCategories: (prev.expenseCategories || []).filter(c => c.id !== id)
        }));
    };

    const updateCategoryPnL = (id: string, pnl: ExpensePnLCategory) => {
        setFormData(prev => ({
            ...prev,
            expenseCategories: (prev.expenseCategories || []).map(c =>
                c.id === id ? { ...c, pnlCategory: pnl } : c
            )
        }));
    };

    const pnlCategoryLabel = (cat: ExpensePnLCategory) => {
        switch (cat) {
            case 'administrative': return 'Административные';
            case 'operational': return 'Операционные';
            case 'commercial': return 'Коммерческие';
        }
    };

    const pnlCategoryColor = (cat: ExpensePnLCategory) => {
        switch (cat) {
            case 'administrative': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'operational': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'commercial': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        }
    };

    // Tab state
    const [activeTab, setActiveTab] = useState<'general' | 'expenses'>('general');

    // Sync state with props when they change (e.g. loaded from localStorage)
    React.useEffect(() => {
        setFormData((prev) => ({
            ...settings,
            telegramBotToken: envBotToken || settings.telegramBotToken || prev.telegramBotToken,
            telegramChatId: envChatId || settings.telegramChatId || prev.telegramChatId,
            expenseCategories: settings.expenseCategories || prev.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
        }));
    }, [settings, envBotToken, envChatId]);

    // Google Sheets State
    const [spreadsheetId, setSpreadsheetId] = useState(envSheetId || getSpreadsheetId());
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');

    // Ensure env Sheet ID сохраняется локально, но не показывается
    React.useEffect(() => {
        if (envSheetId) {
            saveSpreadsheetId(envSheetId);
            setSpreadsheetId(envSheetId);
        }
    }, [envSheetId]);

    const handleSaveId = () => {
        saveSpreadsheetId(spreadsheetId);
        setConnectionMessage('ID сохранен локально');
        setConnectionStatus('idle');
        setTimeout(() => setConnectionMessage(''), 3000);
    };

    const handleTestConnection = async () => {
        if (!accessToken) return;
        setConnectionStatus('loading');
        try {
            const msg = await sheetsService.testConnection(accessToken, spreadsheetId);
            setConnectionStatus('success');
            setConnectionMessage(msg);
            saveSpreadsheetId(spreadsheetId); // Auto-save on success
        } catch (e: unknown) {
            setConnectionStatus('error');
            setConnectionMessage(e instanceof Error ? e.message : 'Ошибка соединения');
        }
    };

    const handleTestTelegram = async () => {
        if (!formData.telegramBotToken || !formData.telegramChatId) {
            setMessage('Введите Token и Chat ID');
            return;
        }
        try {
            await telegramService.sendMessage(formData.telegramBotToken, formData.telegramChatId, '🔔 Тестовое сообщение от Google ERP');
            setMessage('Тестовое сообщение отправлено!');
        } catch (e: unknown) {
            setMessage(`Ошибка Telegram: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSave = () => {
        onSave(formData);
        setMessage('Настройки успешно сохранены');
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div className={`border-b ${t.border} pb-6`}>
                <h2 className={`text-3xl font-bold ${t.text} tracking-tight flex items-center gap-3`}>
                    <SettingsIcon size={32} className="text-primary-500" />
                    Настройки Системы
                </h2>
                <p className={`${t.textMuted} mt-2`}>Конфигурация налогов и валютных курсов</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'general'
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <SettingsIcon size={18} className="inline mr-2" />
                    Основные настройки
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'expenses'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <Receipt size={18} className="inline mr-2" />
                    Категории расходов
                </button>
            </div>

            {/* Tab: General Settings */}
            {activeTab === 'general' && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} p-8 shadow-lg space-y-8`}>

                    {/* Google Sheets Connection */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-blue-500 pl-4 flex items-center gap-2`}>
                            <Database size={24} className="text-blue-500" />
                            Подключение к Google Sheets
                        </h3>

                        <div className="space-y-2">
                            <label className={`block text-sm font-medium ${t.textMuted}`}>
                                ID Таблицы (Spreadsheet ID)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type={isSheetFromEnv ? 'password' : 'text'}
                                    className={`flex-1 ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm disabled:opacity-60`}
                                    value={isSheetFromEnv ? '••••••••••••••••' : spreadsheetId}
                                    readOnly={isSheetFromEnv}
                                    onChange={(e) => setSpreadsheetId(e.target.value)}
                                    placeholder="1Sz3dpCAJqgY5oF-d0K50TlItj7gySubJ-iNhPFS5RzE"
                                />
                                <button
                                    onClick={handleSaveId}
                                    disabled={isSheetFromEnv}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Сохранить
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={connectionStatus === 'loading' || !spreadsheetId}
                                    className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4 disabled:opacity-50 disabled:no-underline"
                                >
                                    Проверить соединение
                                </button>

                                {connectionStatus !== 'idle' && (
                                    <div className={`text-sm flex items-center gap-2 ${connectionStatus === 'success' ? 'text-emerald-400' :
                                        connectionStatus === 'error' ? 'text-red-400' : t.textMuted
                                        }`}>
                                        {connectionStatus === 'loading' && <Loader2 size={16} className="animate-spin" />}
                                        {connectionStatus === 'success' && <CheckCircle size={16} />}
                                        {connectionStatus === 'error' && <XCircle size={16} />}
                                        {connectionMessage}
                                    </div>
                                )}
                            </div>

                            <p className={`text-xs ${t.textMuted}`}>
                                {isSheetFromEnv
                                    ? 'ID таблицы задается через env и скрыт для безопасности.'
                                    : 'Вставьте ID вашей Google Таблицы. Приложение будет автоматически сохранять туда товары и заказы.'}
                            </p>
                        </div>
                    </div>

                    {/* Danger Zone - Clear Data */}
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                            <AlertCircle size={20} />
                            Опасная зона
                        </h4>
                        <p className={`text-sm ${t.textMuted} mb-4`}>
                            Очистка всех данных в Google Sheets. Используйте для тестирования. <strong className="text-red-400">Это действие нельзя отменить!</strong>
                        </p>
                        <ClearDataButton accessToken={accessToken} />
                    </div>

                    <div className={`border-t ${t.border} my-6`}></div>

                    {/* Theme Settings */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-purple-500 pl-4 flex items-center gap-2`}>
                            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            Тема интерфейса
                        </h3>

                        <div className="space-y-4">
                            <label className={`block text-sm font-medium ${t.textMuted}`}>
                                Цветовая схема
                            </label>
                            <p className={`text-xs ${t.textMuted} mb-3`}>
                                Выберите светлую тему (Material Design, стиль Google Drive) или темную тему для работы.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, theme: 'light' })}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                                        formData.theme === 'light' || !formData.theme
                                            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                                            : `${t.border} ${t.bgCard} hover:border-slate-500`
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <div className={`font-bold ${t.text} text-lg`}>Светлая</div>
                                        <div className={`text-xs ${t.textMuted} mt-1`}>Material Design</div>
                                        <div className={`text-xs ${t.textMuted}`}>Google Drive стиль</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setFormData({ ...formData, theme: 'dark' })}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                                        formData.theme === 'dark'
                                            ? 'border-slate-400 bg-slate-700/30 shadow-lg shadow-slate-500/20'
                                            : `${t.border} ${t.bgCard} hover:border-slate-500`
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <div className={`font-bold ${t.text} text-lg`}>Темная</div>
                                        <div className={`text-xs ${t.textMuted} mt-1`}>Текущая тема</div>
                                        <div className={`text-xs ${t.textMuted}`}>Для вечерней работы</div>
                                    </div>
                                </button>
                            </div>

                            {formData.theme === 'light' && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
                                    <div className="flex gap-3">
                                        <AlertCircle className="text-amber-400 flex-shrink-0" size={20} />
                                        <div>
                                            <div className={`font-medium text-sm ${t.text}`}>Светлая тема активна</div>
                                            <div className={`text-xs mt-1 ${t.textMuted}`}>Фон слоновая кость (#F8F9FA), скругленные карточки, стиль Material Design 3</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`border-t ${t.border} my-6`}></div>

                    {/* Financial Settings */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-primary-500 pl-4`}>
                            Финансы и Налоги
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>
                                    Ставка НДС (%)
                                </label>
                                <p className={`text-xs ${t.textMuted} mb-2`}>
                                    Налог на добавленную стоимость, применяемый к продажам.
                                </p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                        value={formData.vatRate}
                                        onChange={(e) => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                                    />
                                    <span className={`absolute right-4 top-3 ${t.textMuted}`}>%</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>
                                    Курс валют по умолчанию (USD → UZS)
                                </label>
                                <p className={`text-xs ${t.textMuted} mb-2`}>
                                    Базовый курс, используемый при инициализации продажи.
                                </p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                        value={formData.defaultExchangeRate}
                                        onChange={(e) => setFormData({ ...formData, defaultExchangeRate: Number(e.target.value) })}
                                    />
                                    <span className={`absolute right-4 top-3 ${t.textMuted}`}>UZS</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`border-t ${t.border} my-6`}></div>

                    {/* Report Number Settings */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-amber-500 pl-4 flex items-center gap-2`}>
                            <Receipt size={24} className="text-amber-500" />
                            Нумерация Отчётов
                        </h3>
                        <p className={`text-sm ${t.textMuted}`}>Последовательная нумерация отчётов о продаже.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>
                                    Текущий номер отчёта
                                </label>
                                <p className={`text-xs ${t.textMuted} mb-2`}>
                                    Следующий созданный отчёт получит этот номер.
                                </p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-amber-500 outline-none`}
                                        value={formData.nextReportNo ?? 1}
                                        onChange={(e) => setFormData({ ...formData, nextReportNo: Math.max(1, Number(e.target.value)) })}
                                        min={1}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 flex flex-col justify-end">
                                <button
                                    onClick={() => {
                                        if (confirm('Вы уверены, что хотите сбросить нумерацию отчётов до 1?')) {
                                            setFormData({ ...formData, nextReportNo: 1 });
                                            setMessage('Нумерация отчётов сброшена до 1');
                                            setTimeout(() => setMessage(null), 3000);
                                        }
                                    }}
                                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={18} />
                                    Обнулить нумерацию
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={`border-t ${t.border} my-6`}></div>

                    {/* Company Status */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-indigo-500 pl-4 flex items-center gap-2`}>
                            <div className="i-lucide-building-2 text-indigo-500" />
                            Реквизиты Компании
                        </h3>
                        <p className={`text-sm ${t.textMuted}`}>Эти данные будут отображаться в счетах на оплату и накладных.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Название компании</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.name || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, name: e.target.value } as any })}
                                    placeholder="ООО 'METAL MASTER'"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Телефон</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.phone || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, phone: e.target.value } as any })}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                            <div className="col-span-full space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Юридический адрес</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.address || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, address: e.target.value } as any })}
                                    placeholder="г. Ташкент, ул. Примерная, 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>ИНН (STIR)</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.inn || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, inn: e.target.value } as any })}
                                    placeholder="123456789"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>МФО (MFO)</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.mfo || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, mfo: e.target.value } as any })}
                                    placeholder="00123"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Название Банка</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.bankName || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, bankName: e.target.value } as any })}
                                    placeholder="АКБ 'Kapitalbank'"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Расчетный счет</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none font-mono`}
                                    value={formData.companyDetails?.accountNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, accountNumber: e.target.value } as any })}
                                    placeholder="2020 8000 ..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Директор</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.director || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, director: e.target.value } as any })}
                                    placeholder="Иванов И.И."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Главный бухгалтер</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.accountant || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...formData.companyDetails, accountant: e.target.value } as any })}
                                    placeholder="Петрова А.А."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Telegram Settings */}
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold ${t.text} border-l-4 border-blue-400 pl-4 flex items-center gap-2`}>
                            <Send size={24} className="text-blue-400" />
                            Интеграция с Telegram
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>
                                    Bot Token
                                </label>
                                <p className={`text-xs ${t.textMuted} mb-2`}>
                                    Токен от @BotFather
                                </p>
                                <input
                                    type="password"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm disabled:opacity-60`}
                                    value={isBotFromEnv ? '••••••••••••••••' : (formData.telegramBotToken || '')}
                                    readOnly={isBotFromEnv}
                                    onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                                    placeholder="123456789:ABCdef..."
                                />
                                {isBotFromEnv && (
                                    <p className={`text-xs ${t.textMuted}`}>
                                        Bot Token задан через env и скрыт.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>
                                    Chat ID
                                </label>
                                <p className={`text-xs ${t.textMuted} mb-2`}>
                                    ID вашего чата (можно узнать через @userinfobot)
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type={isChatFromEnv ? 'password' : 'text'}
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm disabled:opacity-60`}
                                        value={isChatFromEnv ? '••••••••••' : (formData.telegramChatId || '')}
                                        readOnly={isChatFromEnv}
                                        onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                                        placeholder="123456789"
                                    />
                                    <button
                                        onClick={handleTestTelegram}
                                        className={`bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg transition-colors`}
                                        title="Отправить тестовое сообщение"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                {isChatFromEnv && (
                                    <p className={`text-xs ${t.textMuted}`}>
                                        Chat ID задан через env и скрыт.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                        <div className={`text-sm ${t.textMuted}`}>
                            <span className={`font-bold ${t.text}`}>Внимание:</span> Изменение ставки НДС повлияет только на будущие заказы. История существующих заказов останется неизменной для сохранения точности финансового учета.
                        </div>
                    </div>

                    <div className={`pt-6 flex items-center justify-between border-t ${t.border}`}>
                        <span className={`text-emerald-400 text-sm transition-opacity ${message ? 'opacity-100' : 'opacity-0'}`}>
                            {message}
                        </span>
                        <button
                            onClick={handleSave}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-600/20 transition-all active:scale-95"
                        >
                            <Save size={20} />
                            Сохранить настройки
                        </button>
                    </div>
                </div>
            )}

            {/* Tab: Expense Categories */}
            {activeTab === 'expenses' && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} shadow-lg overflow-hidden h-[calc(100vh-280px)] max-h-[600px] flex flex-col`}>
                    <div className={`p-6 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                        <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                            <Receipt size={24} className="text-purple-400" />
                            Категории расходов (для PnL)
                        </h3>
                        <p className={`text-sm ${t.textMuted} mt-1`}>Настройте категории расходов и их классификацию для отчёта о прибылях и убытках</p>
                    </div>

                    {/* Add new category */}
                    <div className={`p-4 border-b ${t.border} ${t.bgCard} bg-opacity-50`}>
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <label className={`block text-xs ${t.textMuted} mb-1`}>Название расхода</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} text-sm`}
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Например: Аренда офиса"
                                    onKeyDown={(e) => e.key === 'Enter' && addExpenseCategory()}
                                />
                            </div>
                            <div className="w-48">
                                <label className={`block text-xs ${t.textMuted} mb-1`}>Классификация PnL</label>
                                <select
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} text-sm`}
                                    value={newCategoryPnL}
                                    onChange={(e) => setNewCategoryPnL(e.target.value as ExpensePnLCategory)}
                                >
                                    <option value="administrative">Административные</option>
                                    <option value="operational">Операционные</option>
                                    <option value="commercial">Коммерческие</option>
                                </select>
                            </div>
                            <button
                                onClick={addExpenseCategory}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                            >
                                <Plus size={16} /> Добавить
                            </button>
                        </div>
                    </div>

                    {/* Categories list - scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className={`${t.bgCard} text-xs ${t.textMuted} uppercase sticky top-0`}>
                                <tr>
                                    <th className="px-4 py-3 text-left">Расход</th>
                                    <th className="px-4 py-3 text-left w-48">Классификация для PnL</th>
                                    <th className="px-4 py-3 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${t.border} divide-opacity-50`}>
                                {(formData.expenseCategories || []).map((cat) => (
                                    <tr key={cat.id} className={`hover:${t.hover}`}>
                                        <td className={`px-4 py-2 ${t.text}`}>{cat.name}</td>
                                        <td className="px-4 py-2">
                                            <select
                                                className={`px-2 py-1 rounded-lg text-xs font-medium border ${pnlCategoryColor(cat.pnlCategory)} bg-transparent cursor-pointer`}
                                                value={cat.pnlCategory}
                                                onChange={(e) => updateCategoryPnL(cat.id, e.target.value as ExpensePnLCategory)}
                                            >
                                                <option value="administrative" className={t.bgCard}>Административные</option>
                                                <option value="operational" className={t.bgCard}>Операционные</option>
                                                <option value="commercial" className={t.bgCard}>Коммерческие</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={() => removeExpenseCategory(cat.id)}
                                                className={`text-slate-500 hover:text-red-400 transition-colors p-1`}
                                                title="Удалить"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!formData.expenseCategories || formData.expenseCategories.length === 0) && (
                                    <tr>
                                        <td colSpan={3} className={`px-4 py-8 text-center ${t.textMuted}`}>
                                            Нет категорий. Добавьте первую категорию расходов.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer with stats and save button */}
                    <div className={`p-4 border-t ${t.border} ${t.bgCard} bg-opacity-50 flex items-center justify-between`}>
                        <div className={`text-xs ${t.textMuted}`}>
                            Всего: <span className={`${t.text} font-medium`}>{(formData.expenseCategories || []).length}</span>
                            <span className="mx-2">•</span>
                            <span className="text-blue-400">Адм.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'administrative').length}</span>
                            <span className="mx-2">•</span>
                            <span className="text-amber-400">Опер.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'operational').length}</span>
                            <span className="mx-2">•</span>
                            <span className="text-emerald-400">Комм.: {(formData.expenseCategories || []).filter(c => c.pnlCategory === 'commercial').length}</span>
                        </div>
                        <button
                            onClick={handleSave}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all active:scale-95"
                        >
                            <Save size={18} />
                            Сохранить категории
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
