import React from 'react';
import { Client } from '../../types';
import { useTheme, getThemeClasses } from '../../contexts/ThemeContext';
import { Phone, Mail, MapPin, Edit, Trash2, Wallet, History, MessageSquare } from 'lucide-react';

interface ClientCardProps {
    client: Client;
    debt: number;
    purchases: number;
    onEdit: (client: Client) => void;
    onDelete: (clientId: string) => void;
    onRepay: (client: Client) => void;
    onHistory: (client: Client) => void;
    onNotes: (client: Client) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
    client, debt, purchases, onEdit, onDelete, onRepay, onHistory, onNotes
}) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const isLegal = client.type === 'legal';

    return (
        <div className={`${t.bgCard} rounded-xl border p-5 hover:${theme === 'dark' ? 'border-slate-500' : 'border-slate-400'} transition-all group relative overflow-hidden ${isLegal ? 'border-blue-500/30' : t.border}`}>
            {/* Type Badge */}
            <div className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold ${isLegal ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {isLegal ? '🏢 Юр. лицо' : '👤 Физ. лицо'}
            </div>
            
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onClick={() => onEdit(client)} className={`p-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} rounded-lg ${t.textMuted} hover:${t.text}`}>
                    <Edit size={16} />
                </button>
                <button onClick={() => onDelete(client.id)} className={`p-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-red-900/40' : 'bg-slate-200 hover:bg-red-100'} rounded-lg ${t.textMuted} hover:text-red-500`}>
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex items-start gap-4 mb-4 mt-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${isLegal ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                    {isLegal ? '🏢' : client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    {isLegal && client.companyName ? (
                        <>
                            <h3 className={`font-bold ${t.text} text-lg truncate`}>{client.companyName}</h3>
                            <div className={`text-xs ${t.textMuted}`}>Контакт: {client.name}</div>
                        </>
                    ) : (
                        <h3 className={`font-bold ${t.text} text-lg`}>{client.name}</h3>
                    )}
                    <div className={`flex items-center gap-2 ${t.textMuted} text-sm mt-1`}>
                        <Phone size={14} /> {client.phone}
                    </div>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {isLegal && (
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-1">
                        {client.inn && (
                            <div className={`text-xs ${t.textMuted}`}><span className="text-blue-500">ИНН:</span> {client.inn}</div>
                        )}
                        {client.mfo && (
                            <div className={`text-xs ${t.textMuted}`}><span className="text-blue-500">МФО:</span> {client.mfo}</div>
                        )}
                        {client.bankAccount && (
                            <div className={`text-xs ${t.textMuted} truncate`}><span className="text-blue-500">Р/С:</span> {client.bankAccount}</div>
                        )}
                        {client.bankName && (
                            <div className={`text-xs ${t.textMuted} truncate`}><span className="text-blue-500">Банк:</span> {client.bankName}</div>
                        )}
                    </div>
                )}
                {client.email && (
                    <div className={`flex items-center gap-2 ${t.textMuted} text-sm`}>
                        <Mail size={14} /> {client.email}
                    </div>
                )}
                {client.address && (
                    <div className={`flex items-center gap-2 ${t.textMuted} text-sm`}>
                        <MapPin size={14} /> {client.address}
                    </div>
                )}
                {client.type === 'legal' && client.addressLegal && (
                    <div className={`flex items-center gap-2 ${t.textMuted} text-sm`}>
                        <MapPin size={14} /> Юр. адрес: {client.addressLegal}
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-2 gap-3 py-3 border-t ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <div>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Покупок</p>
                    <p className="font-mono text-emerald-500 font-medium">
                        ${purchases.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div>
                    <p className={`text-xs ${t.textMuted} uppercase`}>Долг</p>
                    <p className={`font-mono font-bold ${debt > 0 ? 'text-red-500' : t.textMuted}`}>
                        ${debt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => onNotes(client)}
                    className={`px-3 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1`}
                    title="Заметки"
                >
                    <MessageSquare size={16} />
                </button>
                <button
                    onClick={() => onHistory(client)}
                    className={`px-3 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1`}
                    title="История долгов"
                >
                    <History size={16} />
                </button>
                <button
                    onClick={() => onRepay(client)}
                    disabled={debt <= 0}
                    className={`flex-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200 text-slate-700'} hover:bg-emerald-600 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2`}
                >
                    <Wallet size={16} /> Погасить долг
                </button>
            </div>
        </div>
    );
};
