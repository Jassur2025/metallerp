import React from 'react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { Edit, Trash2, Wallet, History, MessageSquare } from 'lucide-react';

interface ClientListViewProps {
    clients: Client[];
    calculateClientDebt: (client: Client) => number;
    calculateClientPurchases: (client: Client) => number;
    onEdit: (client: Client) => void;
    onDelete: (clientId: string) => void;
    onRepay: (client: Client) => void;
    onHistory: (client: Client) => void;
    onNotes: (client: Client) => void;
}

export const ClientListView: React.FC<ClientListViewProps> = ({
    clients, calculateClientDebt, calculateClientPurchases,
    onEdit, onDelete, onRepay, onHistory, onNotes
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);

    return (
        <div className={`${t.bgCard} border ${t.border} rounded-xl overflow-hidden overflow-y-auto pb-12 custom-scrollbar`}>
            {/* Table Header */}
            <div className={`grid grid-cols-[1fr_140px_80px_120px_100px_140px] gap-3 px-4 py-2.5 ${theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-slate-800/60 border-b border-slate-700'} text-[11px] font-semibold uppercase ${t.textMuted} sticky top-0 z-10`}>
                <span>Клиент</span>
                <span>Телефон</span>
                <span>Тип</span>
                <span className="text-right">Покупки</span>
                <span className="text-right">Долг</span>
                <span className="text-right">Действия</span>
            </div>
            {/* Rows */}
            {clients.map((client, i) => {
                const debt = calculateClientDebt(client);
                const purchases = calculateClientPurchases(client);
                const isLegal = client.type === 'legal';
                return (
                    <div
                        key={client.id}
                        className={`grid grid-cols-[1fr_140px_80px_120px_100px_140px] gap-3 items-center px-4 py-3 transition-colors group
                            ${i % 2 === 0 ? '' : (theme === 'light' ? 'bg-slate-50/50' : 'bg-slate-800/30')}
                            ${theme === 'light' ? 'hover:bg-blue-50/60' : 'hover:bg-slate-700/40'}`}
                    >
                        {/* Client name + avatar */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${isLegal ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                                {isLegal ? '🏢' : client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className={`text-sm font-medium ${t.text} truncate`}>
                                    {isLegal && client.companyName ? client.companyName : client.name}
                                </div>
                                {isLegal && client.companyName && (
                                    <div className={`text-[10px] ${t.textMuted} truncate`}>{client.name}</div>
                                )}
                            </div>
                        </div>
                        {/* Phone */}
                        <span className={`text-xs ${t.textMuted} font-mono`}>{client.phone}</span>
                        {/* Type */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isLegal ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {isLegal ? 'Юр' : 'Физ'}
                        </span>
                        {/* Purchases */}
                        <span className="text-sm font-mono text-emerald-500 font-medium text-right">
                            ${purchases.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        {/* Debt */}
                        <span className={`text-sm font-mono font-bold text-right ${debt > 0 ? 'text-red-500' : t.textMuted}`}>
                            ${debt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                            <button onClick={() => onNotes(client)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-200'} ${t.textMuted} transition-colors`} title="Заметки">
                                <MessageSquare size={14} />
                            </button>
                            <button onClick={() => onHistory(client)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-200'} ${t.textMuted} transition-colors`} title="История">
                                <History size={14} />
                            </button>
                            <button onClick={() => onEdit(client)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-200'} ${t.textMuted} transition-colors`} title="Редактировать">
                                <Edit size={14} />
                            </button>
                            <button
                                onClick={() => onRepay(client)}
                                disabled={debt <= 0}
                                className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${theme === 'dark' ? 'hover:bg-emerald-900/40 text-emerald-400' : 'hover:bg-emerald-100 text-emerald-600'}`}
                                title="Погасить долг"
                            >
                                <Wallet size={14} />
                            </button>
                            <button onClick={() => onDelete(client.id)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-red-900/40' : 'hover:bg-red-100'} ${t.textMuted} hover:text-red-500 transition-colors`} title="Удалить">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
