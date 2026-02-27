
import React, { useState } from 'react';
import { AppSettings, CompanyDetails, ExpenseCategory, ExchangeRateEntry } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { Save, Settings as SettingsIcon, AlertCircle, Loader2, ShieldAlert, RotateCcw, History, TrendingUp, Receipt, Factory, RefreshCw } from 'lucide-react';
import { resetAllData, COLLECTION_LABELS } from '../services/resetService';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { useConfirm } from './ConfirmDialog';
import { ExpenseCategoriesTab } from './Settings/ExpenseCategoriesTab';
import { ManufacturersTab } from './Settings/ManufacturersTab';

const EMPTY_COMPANY: CompanyDetails = {
  name: '', address: '', phone: '', inn: '', mfo: '', bankName: '', accountNumber: ''
};

const DEFAULT_MANUFACTURERS = [
  'INSIGHT UNION',
  'SOFMET',
  'TMZ (ТМЗ)',
  'BEKABAD (Бекабад)',
  'CHINA (Китай)',
  'RUSSIA (Россия)',
];



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
    currentUserEmail?: string;
}

export const Settings: React.FC<SettingsProps> = React.memo(({ settings, onSave, currentUserEmail }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const [formData, setFormData] = useState<AppSettings>({
        ...settings,
        expenseCategories: settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
        manufacturers: settings.manufacturers || DEFAULT_MANUFACTURERS,
    });
    const [message, setMessage] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'general' | 'expenses' | 'manufacturers'>('general');

    // Reset state
    const [isResetting, setIsResetting] = useState(false);
    const [resetProgress, setResetProgress] = useState<string[]>([]);
    const [resetIncludeSettings, setResetIncludeSettings] = useState(false);
    const { confirm: showConfirm } = useConfirm();

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
                <button
                    onClick={() => setActiveTab('manufacturers')}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'manufacturers'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                        : `${t.bgCard} ${t.textMuted} hover:${t.text} border ${t.border}`
                        }`}
                >
                    <Factory size={18} className="inline mr-2" />
                    Производители
                </button>
            </div>

            {/* Tab: General Settings */}
            {activeTab === 'general' && (
                <div className={`${t.bgCard} rounded-2xl border ${t.border} p-8 shadow-lg space-y-8`}>

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
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.theme === 'light' || !formData.theme
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
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.theme === 'dark'
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

                    {/* ═══ DANGER ZONE: Reset All Data ═══ */}
                    <div className={`border-t ${t.border} my-6`}></div>
                    <div className="space-y-6">
                        <h3 className={`text-xl font-bold text-red-500 border-l-4 border-red-500 pl-4 flex items-center gap-2`}>
                            <ShieldAlert size={22} className="text-red-500" />
                            Опасная зона
                        </h3>
                        <p className={`text-sm ${t.textMuted}`}>
                            Полный сброс всех бизнес-данных. Используйте при передаче системы новому клиенту или для чистого запуска.
                        </p>

                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-red-400 shrink-0 mt-1" size={20} />
                                <div className={`text-sm ${t.textMuted}`}>
                                    <span className="font-bold text-red-400">Будут удалены:</span> клиенты, сотрудники, заказы (продажи), закупки, транзакции, расходы, workflow заявки и журнал событий.<br/><span className="font-bold text-emerald-400">Останутся:</span> номенклатура (товары), основные средства, поставщики и настройки.
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={resetIncludeSettings}
                                    onChange={(e) => setResetIncludeSettings(e.target.checked)}
                                    className="w-4 h-4 rounded border-red-500/50 text-red-500 focus:ring-red-500"
                                />
                                <span className={`text-sm ${t.textMuted}`}>Также сбросить настройки (НДС, курс, реквизиты, Telegram)</span>
                            </label>

                            {/* Progress indicator */}
                            {resetProgress.length > 0 && (
                                <div className={`${t.bgPanelAlt} rounded-lg p-4 space-y-1 max-h-40 overflow-y-auto custom-scrollbar`}>
                                    {resetProgress.map((msg, idx) => (
                                        <div key={idx} className={`text-xs font-mono ${t.textMuted}`}>{msg}</div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={async () => {
                                    const confirmed = await showConfirm({
                                        title: 'Сброс всех данных',
                                        message: `Вы уверены? Все бизнес-данные будут БЕЗВОЗВРАТНО удалены из Firebase.${resetIncludeSettings ? ' Включая настройки системы.' : ''} Это действие нельзя отменить.`,
                                        variant: 'danger',
                                        confirmText: 'Да, удалить все данные',
                                        cancelText: 'Отмена',
                                    });
                                    if (!confirmed) return;

                                    // Double confirm
                                    const doubleConfirmed = await showConfirm({
                                        title: '⚠️ Последнее предупреждение',
                                        message: 'ЭТО ДЕЙСТВИЕ НЕОБРАТИМО. Вы точно хотите удалить ВСЕ данные?',
                                        variant: 'danger',
                                        confirmText: 'УДАЛИТЬ ВСЁ',
                                        cancelText: 'Нет, отменить',
                                    });
                                    if (!doubleConfirmed) return;

                                    setIsResetting(true);
                                    setResetProgress(['🔄 Начинаем сброс данных...']);

                                    try {
                                        const result = await resetAllData(resetIncludeSettings, (progress) => {
                                            const label = COLLECTION_LABELS[progress.collection] || progress.collection;
                                            setResetProgress(prev => [...prev, `✅ ${label}: удалено ${progress.deletedCount} записей`]);
                                        });

                                        if (result.success) {
                                            setResetProgress(prev => [...prev, `\n🎉 Готово! Удалено ${result.totalDeleted} записей. Перезагрузите страницу.`]);
                                            setMessage('Все данные успешно удалены');
                                        } else {
                                            setResetProgress(prev => [...prev, `\n❌ Ошибка: ${result.error}`]);
                                            setMessage('Ошибка при сбросе данных');
                                        }
                                    } catch (err: unknown) {
                                        setResetProgress(prev => [...prev, `\n❌ Критическая ошибка: ${(err instanceof Error ? err.message : String(err))}`]);
                                    } finally {
                                        setIsResetting(false);
                                        setTimeout(() => setMessage(null), 5000);
                                    }
                                }}
                                disabled={isResetting}
                                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all ${
                                    isResetting
                                        ? 'bg-red-500/20 text-red-300 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 active:scale-[0.98]'
                                }`}
                            >
                                {isResetting ? (
                                    <><Loader2 size={20} className="animate-spin" /> Удаление данных...</>
                                ) : (
                                    <><RotateCcw size={20} /> Сбросить все данные</>
                                )}
                            </button>
                        </div>
                    </div>
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
        </div>
    );
});
