
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { Save, Settings as SettingsIcon, AlertCircle, Database, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getSpreadsheetId, saveSpreadsheetId, sheetsService } from '../services/sheetsService';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
    settings: AppSettings;
    onSave: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
    const { accessToken } = useAuth();
    const [formData, setFormData] = useState<AppSettings>(settings);
    const [message, setMessage] = useState<string | null>(null);

    // Google Sheets State
    const [spreadsheetId, setSpreadsheetId] = useState(getSpreadsheetId());
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');

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
        } catch (e: any) {
            setConnectionStatus('error');
            setConnectionMessage(e.message);
        }
    };

    const handleSave = () => {
        onSave(formData);
        setMessage('Настройки успешно сохранены');
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div className="border-b border-slate-700 pb-6">
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <SettingsIcon size={32} className="text-primary-500" />
                    Настройки Системы
                </h2>
                <p className="text-slate-400 mt-2">Конфигурация налогов и валютных курсов</p>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-lg space-y-8">

                {/* Google Sheets Connection */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white border-l-4 border-blue-500 pl-4 flex items-center gap-2">
                        <Database size={24} className="text-blue-500" />
                        Подключение к Google Sheets
                    </h3>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">
                            ID Таблицы (Spreadsheet ID)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                value={spreadsheetId}
                                onChange={(e) => setSpreadsheetId(e.target.value)}
                                placeholder="1Sz3dpCAJqgY5oF-d0K50TlItj7gySubJ-iNhPFS5RzE"
                            />
                            <button
                                onClick={handleSaveId}
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
                                    connectionStatus === 'error' ? 'text-red-400' : 'text-slate-400'
                                    }`}>
                                    {connectionStatus === 'loading' && <Loader2 size={16} className="animate-spin" />}
                                    {connectionStatus === 'success' && <CheckCircle size={16} />}
                                    {connectionStatus === 'error' && <XCircle size={16} />}
                                    {connectionMessage}
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-slate-500">
                            Вставьте ID вашей Google Таблицы. Приложение будет автоматически сохранять туда товары и заказы.
                        </p>
                    </div>
                </div>

                <div className="border-t border-slate-700 my-6"></div>

                {/* Financial Settings */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white border-l-4 border-primary-500 pl-4">
                        Финансы и Налоги
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">
                                Ставка НДС (%)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Налог на добавленную стоимость, применяемый к продажам.
                            </p>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={formData.vatRate}
                                    onChange={(e) => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                                />
                                <span className="absolute right-4 top-3 text-slate-500">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">
                                Курс валют по умолчанию (USD → UZS)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Базовый курс, используемый при инициализации продажи.
                            </p>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={formData.defaultExchangeRate}
                                    onChange={(e) => setFormData({ ...formData, defaultExchangeRate: Number(e.target.value) })}
                                />
                                <span className="absolute right-4 top-3 text-slate-500">UZS</span>
                            </div>
                        </div>
                    </div>
                </div>



                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                    <div className="text-sm text-amber-200/80">
                        <span className="font-bold text-amber-400">Внимание:</span> Изменение ставки НДС повлияет только на будущие заказы. История существующих заказов останется неизменной для сохранения точности финансового учета.
                    </div>
                </div>

                <div className="pt-6 flex items-center justify-between border-t border-slate-700">
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
        </div>
    );
};
