
import React, { useState } from 'react';
import { AppSettings, CompanyDetails, ExpenseCategory, ExchangeRateEntry, Employee } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { Save, Settings as SettingsIcon, AlertCircle, History, TrendingUp, Receipt, Factory, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { ExpenseCategoriesTab } from './Settings/ExpenseCategoriesTab';
import { ManufacturersTab } from './Settings/ManufacturersTab';
import { AccountingPeriodsTab } from './Settings/AccountingPeriodsTab';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_MANUFACTURERS } from '../constants';
import { useConfirm } from './ConfirmDialog';
import { resetAllData, ResetProgress, COLLECTION_LABELS } from '../services/resetService';

const EMPTY_COMPANY: CompanyDetails = {
  name: '', address: '', phone: '', inn: '', mfo: '', bankName: '', accountNumber: ''
};

interface SettingsProps {
    settings: AppSettings;
    onSave: (settings: AppSettings) => void;
    currentUserEmail?: string;
    employees?: Employee[];
}

export const Settings: React.FC<SettingsProps> = React.memo(({ settings, onSave, currentUserEmail, employees }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const { confirm: confirmDialog } = useConfirm();
    const [formData, setFormData] = useState<AppSettings>({
        ...settings,
        expenseCategories: settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
        manufacturers: settings.manufacturers || DEFAULT_MANUFACTURERS,
    });
    const [message, setMessage] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'general' | 'expenses' | 'manufacturers' | 'periods' | 'danger'>('general');

    // Danger zone state
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resetProgress, setResetProgress] = useState<ResetProgress[] | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [resetResult, setResetResult] = useState<{ success: boolean; totalDeleted: number; errors: string[] } | null>(null);

    const currentEmployee = employees?.find(e => e.email?.toLowerCase() === (currentUserEmail || '').toLowerCase());
    const isAdmin = currentEmployee?.role === 'admin';


    // Sync state with props when they change (e.g. loaded from localStorage)
    React.useEffect(() => {
        setFormData((prev) => ({
            ...settings,
            expenseCategories: settings.expenseCategories || prev.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
            manufacturers: settings.manufacturers || prev.manufacturers || DEFAULT_MANUFACTURERS,
        }));
    }, [settings]);



    const handleSave = () => {
        let dataToSave = { ...formData };

        // Track exchange rate changes in history
        if (formData.defaultExchangeRate !== settings.defaultExchangeRate && formData.defaultExchangeRate > 0) {
            const newEntry: ExchangeRateEntry = {
                rate: formData.defaultExchangeRate,
                date: new Date().toISOString(),
                changedBy: currentUserEmail || 'unknown',
            };
            const history = [...(formData.exchangeRateHistory || [])];
            history.push(newEntry);
            // Keep last 50 entries
            if (history.length > 50) history.splice(0, history.length - 50);
            dataToSave = { ...dataToSave, exchangeRateHistory: history };
            setFormData(dataToSave);
        }

        onSave(dataToSave);
        setMessage('Настройки успешно сохранены');
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
            <div className={`border-b ${t.border} pb-6`}>
                <h2 className={`text-3xl font-bold ${t.text} tracking-tight flex items-center gap-3`}>
                    <SettingsIcon size={32} className="text-primary-500" />
                    Настройки Системы
                </h2>
                <p className={`${t.textMuted} mt-2`}>Конфигурация налогов и валютных курсов</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all text-sm md:text-base ${activeTab === 'general'
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <SettingsIcon size={18} className="inline mr-1.5" />
                    Основные
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all text-sm md:text-base ${activeTab === 'expenses'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <Receipt size={18} className="inline mr-1.5" />
                    Категории расходов
                </button>
                <button
                    onClick={() => setActiveTab('manufacturers')}
                    className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all text-sm md:text-base ${activeTab === 'manufacturers'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <Factory size={18} className="inline mr-1.5" />
                    Производители
                </button>
                <button
                    onClick={() => setActiveTab('periods')}
                    className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all text-sm md:text-base ${activeTab === 'periods'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <History size={18} className="inline mr-1.5" />
                    Учётные периоды
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('danger')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold transition-all text-sm md:text-base ${activeTab === 'danger'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-2 border-red-500/40 hover:border-red-500/60'
                            }`}
                    >
                        <ShieldAlert size={18} className="inline mr-1.5" />
                        🗑️ Сброс данных
                    </button>
                )}
            </div>

            {/* Tab: General Settings */}
            {activeTab === 'general' && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} p-5 md:p-8 shadow-lg space-y-8`}>

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
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, theme: 'light' })}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.theme === 'light' || !formData.theme
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
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.theme === 'dark'
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
                                    Текущий курс доллара. Используется во всех модулях системы.
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
                                {formData.defaultExchangeRate !== settings.defaultExchangeRate && (
                                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                                        <TrendingUp size={12} />
                                        Курс изменится с {settings.defaultExchangeRate.toLocaleString()} → {formData.defaultExchangeRate.toLocaleString()} UZS (сохранится в историю)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Exchange Rate History */}
                        {(formData.exchangeRateHistory?.length ?? 0) > 0 && (
                            <div className="mt-6">
                                <h4 className={`text-sm font-semibold ${t.text} flex items-center gap-2 mb-3`}>
                                    <History size={16} className="text-primary-500" />
                                    История изменений курса
                                </h4>
                                <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden`}>
                                    <div className={`grid grid-cols-[1fr_120px_1fr] gap-3 px-4 py-2 text-[11px] font-semibold uppercase ${t.textMuted} ${theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-800/60 border-b border-slate-700'}`}>
                                        <span>Дата</span>
                                        <span className="text-right">Курс</span>
                                        <span className="text-right">Кто изменил</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {[...(formData.exchangeRateHistory || [])].reverse().map((entry, i) => (
                                            <div key={i} className={`grid grid-cols-[1fr_120px_1fr] gap-3 px-4 py-2 text-sm ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}`}>
                                                <span className={t.textMuted}>
                                                    {new Date(entry.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={`text-right font-mono font-medium ${t.text}`}>
                                                    {entry.rate.toLocaleString()} UZS
                                                </span>
                                                <span className={`text-right text-xs ${t.textMuted} truncate`}>
                                                    {entry.changedBy || '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
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
                                    onClick={async () => {
                                        if (await confirmDialog({ title: 'Сбросить нумерацию?', message: 'Вы уверены, что хотите сбросить нумерацию отчётов до 1?', variant: 'warning', confirmText: 'Сбросить' })) {
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
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), name: e.target.value } })}
                                    placeholder="ООО 'METAL MASTER'"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Телефон</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.phone || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), phone: e.target.value } })}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                            <div className="col-span-full space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Юридический адрес</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.address || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), address: e.target.value } })}
                                    placeholder="г. Ташкент, ул. Примерная, 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>ИНН (STIR)</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.inn || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), inn: e.target.value } })}
                                    placeholder="123456789"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>МФО (MFO)</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.mfo || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), mfo: e.target.value } })}
                                    placeholder="00123"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Название Банка</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.bankName || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), bankName: e.target.value } })}
                                    placeholder="АКБ 'Kapitalbank'"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Расчетный счет</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none font-mono`}
                                    value={formData.companyDetails?.accountNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), accountNumber: e.target.value } })}
                                    placeholder="2020 8000 ..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Директор</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.director || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), director: e.target.value } })}
                                    placeholder="Иванов И.И."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`block text-sm font-medium ${t.textMuted}`}>Главный бухгалтер</label>
                                <input type="text" className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-3 ${t.text} focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    value={formData.companyDetails?.accountant || ''}
                                    onChange={(e) => setFormData({ ...formData, companyDetails: { ...(formData.companyDetails || EMPTY_COMPANY), accountant: e.target.value } })}
                                    placeholder="Петрова А.А."
                                />
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

                    {/* ═══ DANGER ZONE: Removed (P0 security fix) ═══ */}
                </div>
            )}

            {/* Tab: Expense Categories */}
            {activeTab === 'expenses' && (
                <ExpenseCategoriesTab
                    formData={formData}
                    setFormData={setFormData}
                    handleSave={handleSave}
                    t={t}
                />
            )}

            {/* Tab: Manufacturers */}
            {activeTab === 'manufacturers' && (
                <ManufacturersTab
                    formData={formData}
                    setFormData={setFormData}
                    handleSave={handleSave}
                    t={t}
                />
            )}

            {/* Tab: Accounting Periods */}
            {activeTab === 'periods' && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} p-8 shadow-lg`}>
                    <AccountingPeriodsTab />
                </div>
            )}

            {/* Tab: Danger Zone - Data Reset */}
            {activeTab === 'danger' && isAdmin && (
                <div className={`${t.bgCard} rounded-2xl border-2 border-red-500/50 p-5 md:p-8 shadow-lg`}>
                    <div className="space-y-6">
                        {/* Warning banner */}
                        <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6 text-center">
                            <ShieldAlert className="text-red-500 mx-auto mb-3" size={48} />
                            <h3 className="text-2xl font-extrabold text-red-500">Сброс всех данных</h3>
                            <p className={`text-sm ${t.textMuted} mt-2 max-w-lg mx-auto`}>
                                Удаляет все бизнес-данные (товары, заказы, клиенты и т.д.).
                                <strong className={`block mt-1 ${t.text}`}>Сотрудники и настройки системы сохранятся.</strong>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`bg-red-500/10 border border-red-500/30 rounded-xl p-5`}>
                                <h4 className="text-red-400 font-bold text-sm mb-3">⚠️ Будут удалены:</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(COLLECTION_LABELS).map(([key, label]) => (
                                        <div key={key} className="flex items-center gap-1.5 text-xs">
                                            <Trash2 size={10} className="text-red-400 flex-shrink-0" />
                                            <span className={t.textMuted}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5`}>
                                <h4 className="text-emerald-400 font-bold text-sm mb-3">✓ Сохранятся:</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400">✓</span>
                                        <span className={t.textMuted}>Сотрудники (аккаунты)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400">✓</span>
                                        <span className={t.textMuted}>Настройки системы</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Confirmation input */}
                        {!resetResult && (
                            <div className={`${theme === 'light' ? 'bg-slate-50 border border-slate-200' : 'bg-slate-800/50 border border-slate-700'} rounded-xl p-5 space-y-4`}>
                                <label className={`block text-sm font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                                    Для подтверждения напишите: <span className={`font-mono ${theme === 'light' ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded' : 'text-white bg-slate-700 px-2 py-0.5 rounded'}`}>УДАЛИТЬ ВСЕ</span>
                                </label>
                                <input
                                    type="text"
                                    value={resetConfirmText}
                                    onChange={(e) => setResetConfirmText(e.target.value)}
                                    className={`w-full ${theme === 'light' ? 'bg-white border-red-300 focus:border-red-500' : 'bg-red-500/10 border-red-500/30'} border-2 rounded-xl px-4 py-3.5 ${t.text} outline-none focus:ring-2 focus:ring-red-500/50 font-mono text-lg text-center`}
                                    placeholder="УДАЛИТЬ ВСЕ"
                                    disabled={isResetting}
                                />
                                <button
                                    onClick={async () => {
                                        if (resetConfirmText !== 'УДАЛИТЬ ВСЕ') return;
                                        if (!await confirmDialog({
                                            title: 'ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ',
                                            message: 'Все данные (товары, заказы, клиенты, транзакции и т.д.) будут безвозвратно удалены. Продолжить?',
                                            variant: 'danger',
                                            confirmText: 'Да, удалить все данные'
                                        })) return;

                                        setIsResetting(true);
                                        setResetResult(null);
                                        try {
                                            const result = await resetAllData(
                                                currentEmployee?.role || '',
                                                (progress) => setResetProgress([...progress])
                                            );
                                            setResetResult(result);
                                        } catch (err) {
                                            setResetResult({
                                                success: false,
                                                totalDeleted: 0,
                                                errors: [err instanceof Error ? err.message : String(err)]
                                            });
                                        } finally {
                                            setIsResetting(false);
                                            setResetConfirmText('');
                                        }
                                    }}
                                    disabled={resetConfirmText !== 'УДАЛИТЬ ВСЕ' || isResetting}
                                    className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                                        resetConfirmText === 'УДАЛИТЬ ВСЕ' && !isResetting
                                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 cursor-pointer active:scale-[0.98]'
                                            : `${theme === 'light' ? 'bg-slate-200 text-slate-400' : 'bg-slate-700 text-slate-500'} cursor-not-allowed`
                                    }`}
                                >
                                    {isResetting ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            Удаление...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={18} />
                                            Удалить все данные
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Progress */}
                        {resetProgress && (
                            <div className="space-y-1">
                                <h4 className={`text-sm font-bold ${t.text} mb-2`}>Прогресс удаления:</h4>
                                {resetProgress.map((p) => (
                                    <div key={p.collection} className={`flex items-center justify-between text-xs py-1.5 px-3 rounded-lg ${
                                        p.status === 'done' ? 'bg-emerald-500/10' :
                                        p.status === 'deleting' ? 'bg-amber-500/10' :
                                        p.status === 'error' ? 'bg-red-500/10' : ''
                                    }`}>
                                        <span className={t.textMuted}>
                                            {COLLECTION_LABELS[p.collection] || p.collection}
                                        </span>
                                        <span className={`font-mono ${
                                            p.status === 'done' ? 'text-emerald-400' :
                                            p.status === 'deleting' ? 'text-amber-400' :
                                            p.status === 'error' ? 'text-red-400' :
                                            t.textMuted
                                        }`}>
                                            {p.status === 'pending' ? '⏳' :
                                             p.status === 'deleting' ? '🔄' :
                                             p.status === 'done' ? `✓ ${p.deleted}` :
                                             `✕ ${p.error?.slice(0, 30)}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Result */}
                        {resetResult && (
                            <div className={`p-4 rounded-xl border ${
                                resetResult.success
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                            }`}>
                                {resetResult.success ? (
                                    <div className="text-center">
                                        <div className="text-emerald-400 font-bold text-lg mb-1">✓ Данные удалены</div>
                                        <div className={`text-sm ${t.textMuted}`}>
                                            Удалено {resetResult.totalDeleted} записей. Перезагрузите страницу.
                                        </div>
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="mt-3 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm"
                                        >
                                            Перезагрузить
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-red-400 font-bold text-sm mb-1">Ошибки при удалении:</div>
                                        {resetResult.errors.map((e, i) => (
                                            <div key={i} className="text-xs text-red-300">{e}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
