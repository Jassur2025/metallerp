import React from 'react';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { CheckCircle, XCircle, AlertCircle, Smartphone } from 'lucide-react';
import { checkAllPhones } from '../../utils/phoneFormatter';

interface PhoneCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: ReturnType<typeof checkAllPhones>;
}

export const PhoneCheckModal: React.FC<PhoneCheckModalProps> = ({
    isOpen, onClose, results
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${t.bgCard} rounded-xl border ${t.border} max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
                <div className={`p-6 border-b ${t.border} flex items-center justify-between`}>
                    <h2 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                        <Smartphone size={24} className="text-indigo-400" />
                        Проверка формата телефонов
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 hover:${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} rounded-lg ${t.textMuted} hover:${t.text} transition-colors`}
                    >
                        <XCircle size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="text-emerald-400" size={20} />
                                <span className="text-emerald-400 font-bold text-lg">{results.valid.length}</span>
                            </div>
                            <p className={`${t.textMuted} text-sm`}>Валидные телефоны</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="text-red-400" size={20} />
                                <span className="text-red-400 font-bold text-lg">{results.invalid.length}</span>
                            </div>
                            <p className={`${t.textMuted} text-sm`}>Невалидные телефоны</p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="text-yellow-400" size={20} />
                                <span className="text-yellow-400 font-bold text-lg">{results.missing.length}</span>
                            </div>
                            <p className={`${t.textMuted} text-sm`}>Без телефона</p>
                        </div>
                    </div>
                    
                    {/* Valid Phones */}
                    {results.valid.length > 0 && (
                        <div>
                            <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                <CheckCircle className="text-emerald-400" size={18} />
                                Валидные телефоны ({results.valid.length})
                            </h3>
                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-lg border ${t.border} overflow-hidden`}>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-200'} sticky top-0`}>
                                            <tr>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Клиент</th>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Исходный</th>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Формат для планшета</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${t.divide}`}>
                                            {results.valid.map(client => (
                                                <tr key={client.id} className={`hover:${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-200/50'}`}>
                                                    <td className={`px-4 py-2 ${t.text}`}>{client.name}</td>
                                                    <td className={`px-4 py-2 ${t.textMuted} font-mono`}>{client.phone}</td>
                                                    <td className="px-4 py-2 text-emerald-400 font-mono">{client.formatted}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Invalid Phones */}
                    {results.invalid.length > 0 && (
                        <div>
                            <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                <XCircle className="text-red-400" size={18} />
                                Невалидные телефоны ({results.invalid.length})
                            </h3>
                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-lg border ${t.border} overflow-hidden`}>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-200'} sticky top-0`}>
                                            <tr>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Клиент</th>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Телефон</th>
                                                <th className={`px-4 py-2 text-left ${t.textMuted} font-medium`}>Ошибка</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${t.divide}`}>
                                            {results.invalid.map(client => (
                                                <tr key={client.id} className={`hover:${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-200/50'}`}>
                                                    <td className={`px-4 py-2 ${t.text}`}>{client.name}</td>
                                                    <td className={`px-4 py-2 ${t.textMuted} font-mono`}>{client.phone}</td>
                                                    <td className="px-4 py-2 text-red-400 text-xs">{client.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Missing Phones */}
                    {results.missing.length > 0 && (
                        <div>
                            <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                <AlertCircle className="text-yellow-400" size={18} />
                                Без телефона ({results.missing.length})
                            </h3>
                            <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-lg border ${t.border} p-4`}>
                                <div className="flex flex-wrap gap-2">
                                    {results.missing.map(client => (
                                        <span key={client.id} className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm border border-yellow-500/20">
                                            {client.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className={`p-6 border-t ${t.border} flex justify-end gap-3`}>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} rounded-lg font-medium transition-colors`}
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};
