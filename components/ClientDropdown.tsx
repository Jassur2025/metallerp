import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Client } from '../types';
import { IdGenerator } from '../utils/idGenerator';
import { getThemeClasses } from '../contexts/ThemeContext';
import { UserPlus } from 'lucide-react';

interface ClientDropdownProps {
    clients: Client[];
    value: string;
    onChange: (name: string) => void;
    onPhone: (phone: string) => void;
    onAddClient: (clients: Client[]) => void;
    theme: string;
    t: ReturnType<typeof getThemeClasses>;
}

export const ClientDropdown: React.FC<ClientDropdownProps> = ({ clients, value, onChange, onPhone, onAddClient, theme, t }) => {
    const [open, setOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const q = value.toLowerCase().trim();
        if (!q) return clients;
        return clients.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone || '').includes(q) ||
            (c.companyName || '').toLowerCase().includes(q)
        );
    }, [clients, value]);

    const exact = clients.find(c => c.name.toLowerCase() === value.toLowerCase().trim());
    const showAddBtn = value.trim().length >= 2 && !exact;

    // Tashqi click bilan yopish
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setAdding(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (c: Client) => {
        onChange(c.name);
        if (c.phone) onPhone(c.phone);
        setOpen(false);
        setAdding(false);
    };

    const handleAddNew = () => {
        const name = value.trim();
        if (!name) return;
        const newClient: Client = {
            id: IdGenerator.client(),
            name,
            phone: newPhone.trim() || '',
            creditLimit: 0,
            totalPurchases: 0,
            totalDebt: 0,
            notes: 'Yangi mijoz'
        };
        onAddClient([...clients, newClient]);
        if (newPhone.trim()) onPhone(newPhone.trim());
        setAdding(false);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                value={value}
                onChange={(e) => { onChange(e.target.value); setOpen(true); setAdding(false); }}
                onFocus={() => setOpen(true)}
                className={`w-full ${t.bgInput} border ${t.borderInput} rounded-lg px-2 py-1.5 ${t.text} outline-none text-xs ${t.focusRing} ${t.textPlaceholder}`}
                placeholder="Клиент..."
                autoComplete="off"
            />
            {open && (
                <div className={`absolute z-[9999] left-0 right-0 top-[calc(100%+2px)] ${theme === 'light' ? 'bg-white border border-slate-200 shadow-lg' : 'bg-slate-800 border border-slate-600 shadow-xl'} rounded-lg overflow-hidden max-h-52 flex flex-col`}>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filtered.length === 0 && !showAddBtn && (
                            <div className={`px-3 py-2 text-xs ${t.textMuted} text-center`}>Klient topilmadi</div>
                        )}
                        {filtered.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                                className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between gap-1 ${theme === 'light' ? 'hover:bg-blue-50 text-slate-800' : 'hover:bg-slate-700 text-slate-100'}`}
                            >
                                <div className="min-w-0">
                                    <div className={`text-xs font-medium truncate ${t.text}`}>{c.name}</div>
                                    {c.phone && <div className={`text-[10px] ${t.textMuted}`}>{c.phone}</div>}
                                </div>
                                {(c.totalDebt || 0) > 0 && (
                                    <span className="text-[9px] text-red-400 font-mono flex-shrink-0">${(c.totalDebt || 0).toFixed(0)} qarzi</span>
                                )}
                            </button>
                        ))}
                    </div>
                    {showAddBtn && !adding && (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setAdding(true); }}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-t ${theme === 'light' ? 'border-slate-100 text-blue-600 hover:bg-blue-50' : 'border-slate-700 text-emerald-400 hover:bg-slate-700'} transition-colors w-full`}
                        >
                            <UserPlus size={12} />
                            Yangi: "<span className="font-bold truncate max-w-[120px]">{value.trim()}</span>" ni qo'shish
                        </button>
                    )}
                    {adding && (
                        <div className={`px-3 py-2 border-t ${theme === 'light' ? 'border-slate-100 bg-blue-50' : 'border-slate-700 bg-slate-700/50'} flex gap-1`}>
                            <input
                                autoFocus
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') setAdding(false); }}
                                className={`flex-1 ${t.bgInput} border ${t.borderInput} rounded px-2 py-1 text-xs ${t.text} outline-none w-full min-w-0`}
                                placeholder="Telefon (ixtiyoriy)"
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleAddNew(); }}
                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded font-bold whitespace-nowrap"
                            >
                                Qo'sh
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
