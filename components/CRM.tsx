import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Client, Order, Transaction, AppSettings } from '../types';
import { User } from 'firebase/auth';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Search, Smartphone, LayoutGrid, List } from 'lucide-react';
import { checkAllPhones } from '../utils/phoneFormatter';
import { SUPER_ADMIN_EMAILS, DEFAULT_EXCHANGE_RATE } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { useClients } from '../hooks/useClients';
import { useOrders } from '../hooks/useOrders';
import { transactionService } from '../services/transactionService';
import { ClientNotesModal } from './Sales/ClientNotesModal';
import { ClientCard, ClientFormModal, ClientListView, RepaymentModal, PhoneCheckModal, RepaymentStatsView, DebtHistoryModal } from './CRM/index';
import type { HistoryItem } from './CRM/index';
import type { UnpaidOrder, PaymentRecord } from './CRM/index';
import { useCRMDebt, orderMatchesClient } from '../hooks/useCRMDebt';
import { logger } from '../utils/logger';

interface CRMProps {
    clients: Client[]; // Legacy prop (ignored - using Firebase)
    onSave: (clients: Client[]) => void; // Legacy
    orders: Order[]; // Legacy prop (ignored - using Firebase)
    onSaveOrders?: (orders: Order[]) => void;
    transactions: Transaction[];
    onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
    currentUser?: User | null;
    settings?: AppSettings;
}

type CRMView = 'clients' | 'repaymentStats';

// HistoryItem type imported from ./CRM/DebtHistoryModal

export const CRM: React.FC<CRMProps> = ({ clients: legacyClients, onSave, orders: legacyOrders, onSaveOrders, transactions, onSaveTransactions, currentUser, settings: settingsProp }) => {
    const toast = useToast();
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
    
    // Firebase Hook for Clients
    const { 
        clients, 
        loading: clientsLoading, 
        error: clientsError, 
        addClient, 
        updateClient, 
        deleteClient
    } = useClients();

    // Firebase Hook for Orders - use Firebase orders instead of legacy prop!
    const { 
        orders, 
        loading: ordersLoading 
    } = useOrders();

    const [activeView, setActiveView] = useState<CRMView>('clients');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
    const [isPhoneCheckModalOpen, setIsPhoneCheckModalOpen] = useState(false);
    const [isDebtHistoryModalOpen, setIsDebtHistoryModalOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
    const [phoneCheckResults, setPhoneCheckResults] = useState<ReturnType<typeof checkAllPhones> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'legal'>('all');
    const [page, setPage] = useState(1);
    const pageSize = 12;
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [selectedClientForRepayment, setSelectedClientForRepayment] = useState<Client | null>(null);
    const [statsTimeRange, setStatsTimeRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
    
    // Notes Modal State
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedClientForNotes, setSelectedClientForNotes] = useState<Client | null>(null);

    // View mode toggle
    const [crmViewMode, setCrmViewMode] = useState<'grid' | 'list'>(() => {
        try { return (localStorage.getItem('erp_crm_view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
    });
    const toggleCrmView = (mode: 'grid' | 'list') => {
        setCrmViewMode(mode);
        try { localStorage.setItem('erp_crm_view', mode); } catch {}
    };

    // Initial data check
    React.useEffect(() => {
        if (!clientsLoading && clients.length === 0) {
           // Data loaded but empty - user can add clients manually
        }
    }, [clientsLoading, clients.length]);

    // Check if current user is admin
    const isAdmin = currentUser?.email && (
        SUPER_ADMIN_EMAILS.includes(currentUser.email.toLowerCase()) ||
        currentUser.email.toLowerCase() === 'jassurgme@gmail.com'
    );
    
    const handleCheckPhones = () => {
        const results = checkAllPhones(clients);
        setPhoneCheckResults(results);
        setIsPhoneCheckModalOpen(true);
        toast.info(`Проверено: ${results.valid.length} валидных, ${results.invalid.length} невалидных, ${results.missing.length} без телефона`);
    };

    // Repayment State
    const [repaymentAmount, setRepaymentAmount] = useState<number>(0);
    const [repaymentMethod, setRepaymentMethod] = useState<'cash' | 'bank' | 'card' | 'mixed'>('cash');
    const [repaymentCurrency, setRepaymentCurrency] = useState<'USD' | 'UZS'>('UZS');
    const [exchangeRate, setExchangeRate] = useState<number>(settingsProp?.defaultExchangeRate || DEFAULT_EXCHANGE_RATE);
    const [selectedOrderForRepayment, setSelectedOrderForRepayment] = useState<string | null>(null); // ID выбранного заказа

    // Keep exchange rate in sync with settings
    useEffect(() => {
        if (settingsProp?.defaultExchangeRate && settingsProp.defaultExchangeRate > 100) {
            setExchangeRate(settingsProp.defaultExchangeRate);
        }
    }, [settingsProp?.defaultExchangeRate]);

    // Микс-оплата
    const [mixCashUZS, setMixCashUZS] = useState<number>(0);
    const [mixCashUSD, setMixCashUSD] = useState<number>(0);
    const [mixCard, setMixCard] = useState<number>(0);
    const [mixBank, setMixBank] = useState<number>(0);

    // Form State
    const [formData, setFormData] = useState<Partial<Client>>({
        name: '',
        type: 'individual',
        phone: '',
        email: '',
        address: '',
        creditLimit: 0,
        notes: '',
        // Legal entity fields
        companyName: '',
        inn: '',
        mfo: '',
        bankAccount: '',
        bankName: '',
        addressLegal: ''
    });

    const handleOpenModal = useCallback((client?: Client) => {
        if (client) {
            setEditingClient(client);
            setFormData(client);
        } else {
            setEditingClient(null);
            setFormData({
                name: '',
                type: 'individual',
                phone: '',
                email: '',
                address: '',
                creditLimit: 0,
                notes: '',
                companyName: '',
                inn: '',
                mfo: '',
                bankAccount: '',
                bankName: '',
                addressLegal: ''
            });
        }
        setIsModalOpen(true);
    }, []);

    const handleOpenRepayModal = useCallback((client: Client) => {
        setSelectedClientForRepayment(client);
        setRepaymentAmount(0);
        setRepaymentMethod('cash');
        setRepaymentCurrency('UZS'); // Default to UZS
        setSelectedOrderForRepayment(null); // Сброс выбранного заказа
        // Сброс микс-полей
        setMixCashUZS(0);
        setMixCashUSD(0);
        setMixCard(0);
        setMixBank(0);
        setIsRepayModalOpen(true);
    }, []);

    // Получить непогашенные заказы клиента для погашения
    // Тип для истории платежей
    // --- Debt computation (extracted to hook) ---
    const {
        calculateClientPurchases, calculateClientDebt,
        unpaidOrders: getUnpaidOrdersForClient,
        debtHistory: getClientDebtHistory,
        totalDebtFromOrders
    } = useCRMDebt({
        orders, transactions,
        selectedClientForRepayment,
        selectedClientForHistory
    });

    const handleOpenDebtHistoryModal = useCallback((client: Client) => {
        setSelectedClientForHistory(client);
        setIsDebtHistoryModalOpen(true);
    }, []);

    const handleOpenNotesModal = useCallback((client: Client) => {
        setSelectedClientForNotes(client);
        setIsNotesModalOpen(true);
    }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.phone) {
            toast.warning('Имя и Телефон обязательны!');
            return;
        }

        if (editingClient) {
            await updateClient(editingClient.id, formData);
        } else {
            await addClient(formData as Omit<Client, 'id'>);
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (clientId: string) => {
        if (!isAdmin) {
             toast.error('Только администраторы могут удалять клиентов');
             return;
        }
        if (!window.confirm('Вы уверены, что хотите удалить этого клиента?')) return;

        await deleteClient(clientId);
    };

    const handleRepayDebt = async () => {
        if (!selectedClientForRepayment) return;

        try {
            const orderRef = selectedOrderForRepayment ? ` (Чек ${selectedOrderForRepayment})` : '';
            const clientId = selectedClientForRepayment.id;

            if (repaymentMethod === 'mixed') {
                // Handle Mix Payment
                if (mixCashUZS > 0) {
                    await transactionService.createPayment({
                        type: 'client_payment',
                        amount: mixCashUZS,
                        currency: 'UZS',
                        exchangeRate: exchangeRate,
                        method: 'cash',
                        description: `Погашение долга (нал UZS): ${selectedClientForRepayment.name}${orderRef}`,
                        relatedId: selectedOrderForRepayment || clientId,
                        date: new Date().toISOString()
                    }, clientId);
                }
                if (mixCashUSD > 0) {
                    await transactionService.createPayment({
                        type: 'client_payment',
                        amount: mixCashUSD,
                        currency: 'USD',
                        method: 'cash',
                        description: `Погашение долга (нал USD): ${selectedClientForRepayment.name}${orderRef}`,
                        relatedId: selectedOrderForRepayment || clientId,
                        date: new Date().toISOString()
                    }, clientId);
                }
                if (mixCard > 0) {
                     await transactionService.createPayment({
                        type: 'client_payment',
                        amount: mixCard,
                        currency: 'UZS',
                        exchangeRate: exchangeRate,
                        method: 'card',
                        description: `Погашение долга (карта): ${selectedClientForRepayment.name}${orderRef}`,
                        relatedId: selectedOrderForRepayment || clientId,
                        date: new Date().toISOString()
                    }, clientId);
                }
                if (mixBank > 0) {
                     await transactionService.createPayment({
                        type: 'client_payment',
                        amount: mixBank,
                        currency: 'UZS',
                        exchangeRate: exchangeRate,
                        method: 'bank',
                        description: `Погашение долга (перечисл.): ${selectedClientForRepayment.name}${orderRef}`,
                        relatedId: selectedOrderForRepayment || clientId,
                        date: new Date().toISOString()
                    }, clientId);
                }
            } else {
                // Single Payment
                await transactionService.createPayment({
                    type: 'client_payment',
                    amount: repaymentAmount,
                    currency: repaymentCurrency,
                    exchangeRate: exchangeRate,
                    method: repaymentMethod as 'cash' | 'bank' | 'card' | 'debt',
                    description: `Погашение долга: ${selectedClientForRepayment.name}${orderRef}`,
                    relatedId: selectedOrderForRepayment || clientId,
                    date: new Date().toISOString()
                }, clientId);
            }

            toast.success('Долг успешно погашен и баланс обновлен');
            setIsRepayModalOpen(false);
            
            // Если выбран конкретный заказ - обновляем его статус
            if (selectedOrderForRepayment && onSaveOrders) {
                // Note: This only updates local/legacy orders. 
                // We should eventually move orders to Firebase too.
                // For now, let's keep it as is for visual consistency in the UI if orders are still local
                const updatedOrders = orders.map(o => {
                    if (o.id === selectedOrderForRepayment) {
                        // Calculate how much paid in USD
                        let paidAmount = 0;
                        if (repaymentMethod === 'mixed') {
                            paidAmount = (mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate);
                        } else {
                            paidAmount = repaymentCurrency === 'UZS' ? repaymentAmount / exchangeRate : repaymentAmount;
                        }
                        
                        // Add to existing paid amount
                        const newAmountPaid = (o.amountPaid || 0) + paidAmount;
                        const fullyPaid = newAmountPaid >= (o.totalAmount || 0) - 0.01;
                        
                        return {
                            ...o,
                            amountPaid: newAmountPaid,
                            paymentStatus: fullyPaid ? 'paid' : 'partial'
                        };
                    }
                    return o;
                });
                onSaveOrders(updatedOrders as Order[]); // Type cast if necessary
            }

        } catch (error: unknown) {
            logger.error('CRM', 'Payment error:', error);
            toast.error('Ошибка при проведении платежа: ' + (error instanceof Error ? error.message : String(error)));
        }
    };



    const filteredClients = useMemo(() => {
        const list = clients.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone.includes(searchTerm) ||
                (c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.inn?.includes(searchTerm));
            const matchesType = typeFilter === 'all' || 
                (typeFilter === 'legal' ? c.type === 'legal' : c.type !== 'legal');
            return matchesSearch && matchesType;
        });
        return list;
    }, [clients, searchTerm, typeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
    const displayedClients = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredClients.slice(start, start + pageSize);
    }, [filteredClients, page]);

    // Сброс страницы при поиске
    React.useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    // Calculate stats per client
    const getClientStats = (clientId: string) => {
        const clientOrders = orders.filter(o => o.customerName === clients.find(c => c.id === clientId)?.name);
        return {
            ordersCount: clientOrders.length,
            lastOrderDate: clientOrders.length > 0 ? clientOrders[clientOrders.length - 1].date : '-'
        };
    };

    // Repayment Statistics
    const repaymentStats = useMemo(() => {
        const now = new Date();
        const filterDate = (dateStr: string) => {
            const txDate = new Date(dateStr);
            switch (statsTimeRange) {
                case 'week':
                    const weekAgo = new Date(now);
                    weekAgo.setDate(now.getDate() - 7);
                    return txDate >= weekAgo;
                case 'month':
                    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
                case 'year':
                    return txDate.getFullYear() === now.getFullYear();
                case 'all':
                default:
                    return true;
            }
        };

        const repayments = transactions.filter(t => 
            t.type === 'client_payment' && filterDate(t.date)
        );

        // Total repayments in USD
        const totalRepaidUSD = repayments.reduce((sum, t) => {
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? t.amount / t.exchangeRate
                : t.amount;
            return sum + amountUSD;
        }, 0);

        // Repayments by day
        const repaymentsByDay: Record<string, { date: string; amount: number; count: number }> = {};
        repayments.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            if (!repaymentsByDay[date]) {
                repaymentsByDay[date] = { date, amount: 0, count: 0 };
            }
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? t.amount / t.exchangeRate
                : t.amount;
            repaymentsByDay[date].amount += amountUSD;
            repaymentsByDay[date].count += 1;
        });

        const chartData = Object.values(repaymentsByDay).sort((a, b) => 
            new Date(a.date.split('.').reverse().join('-')).getTime() - 
            new Date(b.date.split('.').reverse().join('-')).getTime()
        );

        // Repayments by method
        const byMethod = repayments.reduce((acc, t) => {
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? t.amount / t.exchangeRate
                : t.amount;
            acc[t.method] = (acc[t.method] || 0) + amountUSD;
            return acc;
        }, {} as Record<string, number>);

        const methodData = [
            { name: 'Наличные', value: byMethod.cash || 0, color: '#10b981' },
            { name: 'Перечисление', value: byMethod.bank || 0, color: '#8b5cf6' },
            { name: 'Карта', value: byMethod.card || 0, color: '#3b82f6' }
        ].filter(item => item.value > 0);

        // Top clients by repayments
        const byClient: Record<string, { name: string; amount: number; count: number }> = {};
        repayments.forEach(t => {
            const client = clients.find(c => c.id === t.relatedId);
            const clientName = client?.name || 'Неизвестный';
            if (!byClient[clientName]) {
                byClient[clientName] = { name: clientName, amount: 0, count: 0 };
            }
            const amountUSD = t.currency === 'UZS' && t.exchangeRate && t.exchangeRate > 0
                ? t.amount / t.exchangeRate
                : t.amount;
            byClient[clientName].amount += amountUSD;
            byClient[clientName].count += 1;
        });

        const topClients = Object.values(byClient)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

        return {
            totalRepaidUSD,
            totalCount: repayments.length,
            chartData,
            methodData,
            topClients
        };
    }, [transactions, clients, statsTimeRange]);

    return (
        <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            {/* Header with Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className={`text-2xl sm:text-3xl font-bold ${t.text} tracking-tight`}>База Клиентов</h2>
                    <p className={`${t.textMuted} mt-1 text-sm sm:text-base`}>Управление контактами и историей продаж</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* View Tabs */}
                    <div className={`flex ${t.bgCard} rounded-lg p-1 border ${t.border} flex-1 sm:flex-initial`}>
                        <button
                            onClick={() => setActiveView('clients')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === 'clients'
                                    ? t.tabActive
                                    : t.tabInactive
                            }`}
                        >
                            <span className="hidden sm:inline">Клиенты</span>
                            <span className="sm:hidden">👥</span>
                        </button>
                        <button
                            onClick={() => setActiveView('repaymentStats')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === 'repaymentStats'
                                    ? t.tabActive
                                    : t.tabInactive
                            }`}
                        >
                            <span className="hidden sm:inline">Статистика погашений</span>
                            <span className="sm:hidden">📊</span>
                        </button>
                    </div>
                    {activeView === 'clients' && (
                        <button
                            onClick={() => handleOpenModal()}
                            className={`${t.buttonPrimary} px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${t.shadowButton} text-sm sm:text-base`}
                        >
                            <Plus size={18} /> <span className="hidden sm:inline">Новый клиент</span><span className="sm:hidden">+</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Repayment Statistics View */}
            {activeView === 'repaymentStats' && (
                <RepaymentStatsView
                    stats={repaymentStats}
                    timeRange={statsTimeRange}
                    onTimeRangeChange={setStatsTimeRange}
                />
            )}


            {/* Clients View */}
            {activeView === 'clients' && (
                <>
                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={20} />
                            <input
                                type="text"
                                placeholder="Поиск по имени, телефону, ИНН..."
                                className={`w-full ${t.bgCard} border ${t.border} rounded-xl pl-10 pr-4 py-3 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Type Filter */}
                        <div className={`flex ${t.bgCard} rounded-xl p-1 border ${t.border}`}>
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === 'all' ? `${t.bgButton} ${t.text}` : `${t.textMuted} hover:${t.text}`}`}
                            >
                                Все
                            </button>
                            <button
                                onClick={() => setTypeFilter('individual')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === 'individual' ? 'bg-emerald-600 text-white' : `${t.textMuted} hover:${t.text}`}`}
                            >
                                👤 Физ
                            </button>
                            <button
                                onClick={() => setTypeFilter('legal')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${typeFilter === 'legal' ? 'bg-blue-600 text-white' : `${t.textMuted} hover:${t.text}`}`}
                            >
                                🏢 Юр
                            </button>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={handleCheckPhones}
                                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
                            >
                                <Smartphone size={18} />
                                <span className="hidden sm:inline">Проверить телефоны</span>
                                <span className="sm:hidden">📱</span>
                            </button>
                        )}
                        {/* View Toggle */}
                        <div className={`flex ${t.bgCard} border ${t.border} rounded-xl overflow-hidden`}>
                            <button
                                onClick={() => toggleCrmView('grid')}
                                className={`px-3 py-2 transition-colors ${crmViewMode === 'grid'
                                    ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
                                    : `${t.textMuted}`}`}
                                title="Сетка"
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => toggleCrmView('list')}
                                className={`px-3 py-2 transition-colors ${crmViewMode === 'list'
                                    ? (theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-primary-500/20 text-primary-400')
                                    : `${t.textMuted}`}`}
                                title="Список"
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>

                    {/* === GRID VIEW === */}
                    {crmViewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-12 custom-scrollbar">
                            {displayedClients.map(client => (
                                <ClientCard
                                    key={client.id}
                                    client={client}
                                    debt={calculateClientDebt(client)}
                                    purchases={calculateClientPurchases(client)}
                                    onEdit={handleOpenModal}
                                    onDelete={handleDelete}
                                    onRepay={handleOpenRepayModal}
                                    onHistory={handleOpenDebtHistoryModal}
                                    onNotes={handleOpenNotesModal}
                                />
                            ))}
                        </div>
                    )}

                    {/* === LIST VIEW === */}
                    {crmViewMode === 'list' && (
                        <ClientListView
                            clients={displayedClients}
                            calculateClientDebt={calculateClientDebt}
                            calculateClientPurchases={calculateClientPurchases}
                            onEdit={handleOpenModal}
                            onDelete={handleDelete}
                            onRepay={handleOpenRepayModal}
                            onHistory={handleOpenDebtHistoryModal}
                            onNotes={handleOpenNotesModal}
                        />
                    )}

                    {/* Pagination */}
                    {filteredClients.length > pageSize && (
                        <div className={`flex items-center justify-between ${t.bgCard} border ${t.border} rounded-xl px-4 py-3 mt-2`}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border ${t.border} ${t.text} disabled:opacity-50 disabled:cursor-not-allowed hover:${t.bgHover} transition-colors`}
                            >
                                Назад
                            </button>
                            <div className={`text-sm ${t.textMuted}`}>
                                Стр. {page} из {totalPages} • {filteredClients.length} клиентов
                            </div>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border ${t.border} ${t.text} disabled:opacity-50 disabled:cursor-not-allowed hover:${t.bgHover} transition-colors`}
                            >
                                Вперёд
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Modals - Available in all views */}
            {/* Edit/Create Modal */}
            <ClientFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                formData={formData}
                setFormData={setFormData}
                editingClient={editingClient}
                onSave={handleSave}
            />

            {/* Repayment Modal */}
            {selectedClientForRepayment && (
                <RepaymentModal
                    isOpen={isRepayModalOpen}
                    onClose={() => setIsRepayModalOpen(false)}
                    client={selectedClientForRepayment}
                    debt={calculateClientDebt(selectedClientForRepayment)}
                    unpaidOrders={getUnpaidOrdersForClient}
                    repaymentAmount={repaymentAmount}
                    setRepaymentAmount={setRepaymentAmount}
                    repaymentMethod={repaymentMethod}
                    setRepaymentMethod={setRepaymentMethod}
                    repaymentCurrency={repaymentCurrency}
                    setRepaymentCurrency={setRepaymentCurrency}
                    exchangeRate={exchangeRate}
                    setExchangeRate={setExchangeRate}
                    selectedOrderForRepayment={selectedOrderForRepayment}
                    setSelectedOrderForRepayment={setSelectedOrderForRepayment}
                    mixCashUZS={mixCashUZS}
                    setMixCashUZS={setMixCashUZS}
                    mixCashUSD={mixCashUSD}
                    setMixCashUSD={setMixCashUSD}
                    mixCard={mixCard}
                    setMixCard={setMixCard}
                    mixBank={mixBank}
                    setMixBank={setMixBank}
                    onSubmit={handleRepayDebt}
                />
            )}
            
            {/* Phone Check Modal - Only for Admin */}
            {phoneCheckResults && (
                <PhoneCheckModal
                    isOpen={isPhoneCheckModalOpen}
                    onClose={() => setIsPhoneCheckModalOpen(false)}
                    results={phoneCheckResults}
                />
            )}

            {/* Debt History Modal */}
            {isDebtHistoryModalOpen && selectedClientForHistory && (
                <DebtHistoryModal
                    client={selectedClientForHistory}
                    history={getClientDebtHistory}
                    onClose={() => setIsDebtHistoryModalOpen(false)}
                />
            )}
            {/* Client Notes Modal - Rendered conditionally */}
            <ClientNotesModal
                client={selectedClientForNotes}
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                currentUserName={currentUser?.email || 'Менеджер'}
            />
        </div>
    );
};
