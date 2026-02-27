import React, { useState } from 'react';
import { JournalEvent } from '../types';
import {
    History, User, ShoppingCart, Package, FileText,
    Settings, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp,
    Search, Filter, Calendar
} from 'lucide-react';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';

interface JournalEventsViewProps {
    events: JournalEvent[];
}

export const JournalEventsView: React.FC<JournalEventsViewProps> = React.memo(({ events }) => {
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Helper to get icon based on module/type
    const getEventIcon = (event: JournalEvent) => {
        switch (event.module) {
            case 'sales': return <ShoppingCart className="w-5 h-5 text-blue-400" />;
            case 'inventory': return <Package className="w-5 h-5 text-emerald-400" />;
            case 'crm': return <User className="w-5 h-5 text-purple-400" />;
            case 'finance': return <FileText className="w-5 h-5 text-amber-400" />;
            case 'system': return <Settings className="w-5 h-5 text-slate-400" />;
            default: return <History className="w-5 h-5 text-slate-400" />;
        }
    };

    // Helper to format date
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    const filteredEvents = events.filter(event => {
        const matchesSearch =
            event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.action.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterType === 'all' || event.module === filterType;

        return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="h-full overflow-auto p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className={`text-2xl font-bold ${t.text} flex items-center gap-2`}>
                        <History className="text-blue-500" />
                        Журнал событий
                    </h2>
                    <p className={`${t.textMuted} text-sm`}>История действий и изменений в системе</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Поиск событий..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2 ${t.bgCard} border ${t.border} rounded-lg ${t.text} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className={`${t.bgCard} border ${t.border} rounded-lg ${t.text} text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                        <option value="all">Все модули</option>
                        <option value="sales">Продажи</option>
                        <option value="inventory">Склад</option>
                        <option value="crm">CRM</option>
                        <option value="finance">Финансы</option>
                        <option value="system">Система</option>
                    </select>
                </div>
            </div>

            {/* Timeline */}
            <div className="relative space-y-4">
                {/* Removed the absolute vertical line that caused glitches */}

                {filteredEvents.length === 0 ? (
                    <div className={`text-center py-12 ${t.textMuted}`}>
                        <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Событий не найдено</p>
                    </div>
                ) : (
                    filteredEvents.map((event, index) => (
                        <div
                            key={event.id || index}
                            className="relative pl-6 md:pl-0"
                        >
                            {/* Timeline connector for desktop */}
                            <div className={`hidden md:block absolute left-[149px] top-8 w-4 h-[2px] ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-300'}`}></div>

                            <div className="flex flex-col md:flex-row gap-4 group">
                                {/* Date/Time Column */}
                                <div className="md:w-36 flex-shrink-0 pt-1">
                                    <div className={`flex items-center gap-2 ${t.textMuted} text-sm font-mono`}>
                                        <Clock className="w-3 h-3" />
                                        {formatDate(event.date)}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={`flex-1 ${t.bgCard} border ${t.border} rounded-xl p-4 ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} transition-colors`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'} rounded-lg`}>
                                                {getEventIcon(event)}
                                            </div>
                                            <div>
                                                <h3 className={`${t.text} font-medium`}>{event.action}</h3>
                                                <p className={`${t.textMuted} text-sm mt-1`}>{event.description}</p>

                                                <div className={`flex items-center gap-2 mt-2 text-xs ${t.textMuted}`}>
                                                    <User className="w-3 h-3" />
                                                    <span>{event.employeeName || 'Система'}</span>
                                                    {event.module && (
                                                        <>
                                                            <span className={`w-1 h-1 ${theme === 'dark' ? 'bg-slate-600' : 'bg-slate-400'} rounded-full`}></span>
                                                            <span className="uppercase tracking-wider">{event.module}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expand Button if details exist */}
                                        {(event.receiptDetails || event.metadata) && (
                                            <button
                                                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                                                className={`p-1 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} rounded ${t.textMuted} hover:${t.text} transition-colors`}
                                            >
                                                {expandedId === event.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedId === event.id && (
                                        <div className={`mt-4 pt-4 border-t ${t.border} space-y-3 animate-fade-in`}>
                                            {event.receiptDetails && (
                                                <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg p-3 text-sm`}>
                                                    <p className={`${t.textMuted} mb-2 font-medium`}>Детали чека:</p>
                                                    <div className={`grid grid-cols-2 gap-2 ${t.text}`}>
                                                        <div>Клиент: {event.receiptDetails.customerName}</div>
                                                        <div>Сумма: {event.receiptDetails.totalAmount}</div>
                                                        <div>Товаров: {event.receiptDetails.itemsCount}</div>
                                                        <div>Оплата: {event.receiptDetails.paymentMethod}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {event.metadata && (
                                                <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg p-3 text-sm font-mono overflow-x-auto`}>
                                                    <pre className={t.textMuted}>
                                                        {JSON.stringify(event.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});
