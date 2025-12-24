import React, { useState, useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import { User } from 'firebase/auth';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Phone, Mail, MapPin, Edit, Trash2, DollarSign, Wallet, History, ArrowDownLeft, BarChart3, TrendingUp, Calendar, CheckCircle, XCircle, AlertCircle, Smartphone } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { checkAllPhones, formatPhoneForTablet, validateUzbekistanPhone } from '../utils/phoneFormatter';
import { SUPER_ADMIN_EMAILS } from '../constants';

interface CRMProps {
    clients: Client[];
    onSave: (clients: Client[]) => void;
    orders: Order[];
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
    onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
    currentUser?: User | null;
}

type CRMView = 'clients' | 'repaymentStats';

export const CRM: React.FC<CRMProps> = ({ clients, onSave, orders, transactions, setTransactions, onSaveTransactions, currentUser }) => {
    const toast = useToast();
    const [activeView, setActiveView] = useState<CRMView>('clients');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
    const [isPhoneCheckModalOpen, setIsPhoneCheckModalOpen] = useState(false);
    const [phoneCheckResults, setPhoneCheckResults] = useState<ReturnType<typeof checkAllPhones> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 12;
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [selectedClientForRepayment, setSelectedClientForRepayment] = useState<Client | null>(null);
    const [statsTimeRange, setStatsTimeRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
    
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
    const [repaymentMethod, setRepaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');
    const [repaymentCurrency, setRepaymentCurrency] = useState<'USD' | 'UZS'>('UZS');
    const [exchangeRate, setExchangeRate] = useState<number>(12800); // Default, should come from settings

    // Form State
    const [formData, setFormData] = useState<Partial<Client>>({
        name: '',
        phone: '',
        email: '',
        address: '',
        creditLimit: 0,
        notes: ''
    });

    const handleOpenModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setFormData(client);
        } else {
            setEditingClient(null);
            setFormData({
                name: '',
                phone: '',
                email: '',
                address: '',
                creditLimit: 0,
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleOpenRepayModal = (client: Client) => {
        setSelectedClientForRepayment(client);
        setRepaymentAmount(0);
        setRepaymentMethod('cash');
        setRepaymentCurrency('UZS'); // Default to UZS
        setIsRepayModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.name || !formData.phone) {
            toast.warning('Имя и Телефон обязательны!');
            return;
        }

        if (editingClient) {
            // Update
            const updatedClients = clients.map(c =>
                c.id === editingClient.id ? { ...c, ...formData } as Client : c
            );
            onSave(updatedClients);
        } else {
            // Create
            const newClient: Client = {
                id: Date.now().toString(),
                ...formData as Client,
                totalPurchases: 0,
                totalDebt: 0
            };
            onSave([...clients, newClient]);
        }
        setIsModalOpen(false);
    };

    const handleRepayDebt = () => {
        if (!selectedClientForRepayment || repaymentAmount <= 0) return;

        // Calculate amount in USD to subtract from debt
        let amountInUSD = repaymentAmount;
        if (repaymentCurrency === 'UZS' && exchangeRate > 0) {
            amountInUSD = repaymentAmount / exchangeRate;
        }

        // 1. Create Transaction
        const newTransaction: Transaction = {
            id: `TRX-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'client_payment',
            amount: repaymentAmount,
            currency: repaymentCurrency,
            exchangeRate: repaymentCurrency === 'UZS' ? exchangeRate : undefined,
            method: repaymentMethod,
            description: `Погашение долга: ${selectedClientForRepayment.name}`,
            relatedId: selectedClientForRepayment.id
        };

        const updatedTransactions = [...transactions, newTransaction];
        setTransactions(updatedTransactions);
        if (onSaveTransactions) {
            onSaveTransactions(updatedTransactions);
        }

        // 2. Update Client Debt
        const updatedClients = clients.map(c => {
            if (c.id === selectedClientForRepayment.id) {
                return {
                    ...c,
                    totalDebt: Math.max(0, (c.totalDebt || 0) - amountInUSD)
                };
            }
            return c;
        });

        onSave(updatedClients);
        setIsRepayModalOpen(false);
        toast.success('Долг успешно погашен!');
    };

    const filteredClients = useMemo(() => {
        const list = clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        );
        return list;
    }, [clients, searchTerm]);

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
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">База Клиентов</h2>
                    <p className="text-slate-400 mt-1 text-sm sm:text-base">Управление контактами и историей продаж</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* View Tabs */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 flex-1 sm:flex-initial">
                        <button
                            onClick={() => setActiveView('clients')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === 'clients'
                                    ? 'bg-primary-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            <span className="hidden sm:inline">Клиенты</span>
                            <span className="sm:hidden">👥</span>
                        </button>
                        <button
                            onClick={() => setActiveView('repaymentStats')}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeView === 'repaymentStats'
                                    ? 'bg-primary-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            <span className="hidden sm:inline">Статистика погашений</span>
                            <span className="sm:hidden">📊</span>
                        </button>
                    </div>
                    {activeView === 'clients' && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-primary-600/20 text-sm sm:text-base"
                        >
                            <Plus size={18} /> <span className="hidden sm:inline">Новый клиент</span><span className="sm:hidden">+</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Repayment Statistics View */}
            {activeView === 'repaymentStats' && (
                <div className="flex-1 overflow-y-auto space-y-6 pb-20 custom-scrollbar">
                    {/* Time Range Selector */}
                    <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1 border border-slate-700 w-full sm:w-auto">
                        {(['week', 'month', 'year', 'all'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setStatsTimeRange(range)}
                                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                    statsTimeRange === range
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                {range === 'week' ? 'Неделя' : 
                                 range === 'month' ? 'Месяц' : 
                                 range === 'year' ? 'Год' : 'Все'}
                            </button>
                        ))}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-emerald-900/20 to-slate-800 p-4 sm:p-6 rounded-xl border border-emerald-500/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <TrendingUp size={20} className="text-emerald-400" />
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400">Всего погашено</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
                                ${repaymentStats.totalRepaidUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-900/20 to-slate-800 p-4 sm:p-6 rounded-xl border border-blue-500/20">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <History size={20} className="text-blue-400" />
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400">Количество операций</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-mono font-bold text-blue-400">
                                {repaymentStats.totalCount}
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-900/20 to-slate-800 p-4 sm:p-6 rounded-xl border border-purple-500/20 sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <DollarSign size={20} className="text-purple-400" />
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400">Среднее погашение</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-mono font-bold text-purple-400">
                                ${repaymentStats.totalCount > 0 
                                    ? (repaymentStats.totalRepaidUSD / repaymentStats.totalCount).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                    : '0.00'}
                            </p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Repayments by Day Chart */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Calendar className="text-blue-400" size={20} /> Погашения по дням
                            </h3>
                            {repaymentStats.chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={repaymentStats.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                        <YAxis stroke="#94a3b8" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                            formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                        />
                                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-slate-500">
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </div>

                        {/* Repayments by Method Chart */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Wallet className="text-emerald-400" size={20} /> По методам оплаты
                            </h3>
                            {repaymentStats.methodData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={repaymentStats.methodData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {repaymentStats.methodData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                            formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-slate-500">
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Clients Table */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-slate-700">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <BarChart3 className="text-indigo-400" size={20} /> Топ клиентов по погашениям
                            </h3>
                        </div>
                        {repaymentStats.topClients.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-medium">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-3">Клиент</th>
                                            <th className="px-4 sm:px-6 py-3 text-right">Сумма (USD)</th>
                                            <th className="px-4 sm:px-6 py-3 text-center">Операций</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {repaymentStats.topClients.map((client, index) => (
                                            <tr key={client.name} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 sm:px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <span className="font-medium text-white">{client.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                                                    ${client.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-center text-slate-400">
                                                    {client.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-slate-500">
                                Нет данных за выбранный период
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Clients View */}
            {activeView === 'clients' && (
                <>
                    {/* Search and Admin Tools */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Поиск по имени или телефону..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {isAdmin && (
                            <button
                                onClick={handleCheckPhones}
                                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
                            >
                                <Smartphone size={18} />
                                <span className="hidden sm:inline">Проверить формат телефонов</span>
                                <span className="sm:hidden">Телефоны</span>
                            </button>
                        )}
                    </div>

                    {/* Clients Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-12 custom-scrollbar">
                        {displayedClients.map(client => {
                            return (
                                <div key={client.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleOpenModal(client)} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-slate-300 hover:text-white">
                                            <Edit size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                            {client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{client.name}</h3>
                                            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                                <Phone size={14} /> {client.phone}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {client.type === 'legal' && client.companyName && (
                                            <div className="mb-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                                <div className="text-xs text-blue-400 font-medium mb-1">Юридическое лицо</div>
                                                <div className="text-sm text-white font-medium">{client.companyName}</div>
                                                {client.inn && (
                                                    <div className="text-xs text-slate-400 mt-1">ИНН: {client.inn}</div>
                                                )}
                                                {client.mfo && client.bankAccount && (
                                                    <div className="text-xs text-slate-400">МФО: {client.mfo}, р/с: {client.bankAccount}</div>
                                                )}
                                                {client.bankName && (
                                                    <div className="text-xs text-slate-400">Банк: {client.bankName}</div>
                                                )}
                                            </div>
                                        )}
                                        {client.email && (
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <Mail size={14} /> {client.email}
                                            </div>
                                        )}
                                        {client.address && (
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <MapPin size={14} /> {client.address}
                                            </div>
                                        )}
                                        {client.type === 'legal' && client.addressLegal && (
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <MapPin size={14} /> Юр. адрес: {client.addressLegal}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-700/50">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Покупок</p>
                                            <p className="font-mono text-emerald-400 font-medium">
                                                ${(client.totalPurchases || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Долг</p>
                                            <p className={`font-mono font-bold ${(client.totalDebt || 0) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                ${(client.totalDebt || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => handleOpenRepayModal(client)}
                                            disabled={(client.totalDebt || 0) <= 0}
                                            className="flex-1 bg-slate-700 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Wallet size={16} /> Погасить долг
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {filteredClients.length > pageSize && (
                        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mt-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                            >
                                Назад
                            </button>
                            <div className="text-sm text-slate-300">
                                Стр. {page} из {totalPages} • {filteredClients.length} клиентов
                            </div>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                            >
                                Вперёд
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Modals - Available in all views */}
            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">
                                {editingClient ? 'Редактировать клиента' : 'Новый клиент'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Имя клиента *</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Телефон *</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Кредитный лимит ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={formData.creditLimit}
                                        onChange={e => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Адрес</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Заметки</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none h-24 resize-none"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-primary-600/20 mt-4"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Repayment Modal */}
            {isRepayModalOpen && selectedClientForRepayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="text-emerald-500" /> Погашение долга
                            </h3>
                            <button onClick={() => setIsRepayModalOpen(false)} className="text-slate-400 hover:text-white">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <p className="text-sm text-slate-400 mb-1">Клиент</p>
                                <p className="text-lg font-bold text-white">{selectedClientForRepayment.name}</p>
                                <div className="mt-3 flex justify-between items-end">
                                    <span className="text-sm text-slate-500">Текущий долг:</span>
                                    <span className="text-xl font-mono font-bold text-red-400">
                                        ${selectedClientForRepayment.totalDebt?.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Способ оплаты</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('cash');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        Наличные
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('bank');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        Перечисление
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('card');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        Карта
                                    </button>
                                </div>
                            </div>

                            {/* Currency Selector (Only for Cash) */}
                            {repaymentMethod === 'cash' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Валюта</label>
                                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">
                                        <button
                                            onClick={() => setRepaymentCurrency('UZS')}
                                            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'UZS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            UZS (Сумы)
                                        </button>
                                        <button
                                            onClick={() => setRepaymentCurrency('USD')}
                                            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'USD' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            USD (Доллары)
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">
                                    Сумма погашения ({repaymentCurrency})
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={repaymentAmount || ''}
                                        onChange={e => setRepaymentAmount(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Exchange Rate Input (If UZS) */}
                            {repaymentCurrency === 'UZS' && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className="text-sm font-medium text-slate-400">Курс обмена (1 USD = ? UZS)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={exchangeRate}
                                        onChange={e => setExchangeRate(Number(e.target.value))}
                                    />
                                </div>
                            )}

                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Сумма в USD:</span>
                                    <span className="text-white font-mono">
                                        ${(repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Остаток долга:</span>
                                    <span className="text-slate-300 font-mono">
                                        ${Math.max(0, (selectedClientForRepayment.totalDebt || 0) - (repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleRepayDebt}
                                disabled={repaymentAmount <= 0}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                            >
                                Подтвердить оплату
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Phone Check Modal - Only for Admin */}
            {isPhoneCheckModalOpen && phoneCheckResults && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Smartphone size={24} className="text-indigo-400" />
                                Проверка формата телефонов
                            </h2>
                            <button
                                onClick={() => setIsPhoneCheckModalOpen(false)}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
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
                                        <span className="text-emerald-400 font-bold text-lg">{phoneCheckResults.valid.length}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm">Валидные телефоны</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="text-red-400" size={20} />
                                        <span className="text-red-400 font-bold text-lg">{phoneCheckResults.invalid.length}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm">Невалидные телефоны</p>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="text-yellow-400" size={20} />
                                        <span className="text-yellow-400 font-bold text-lg">{phoneCheckResults.missing.length}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm">Без телефона</p>
                                </div>
                            </div>
                            
                            {/* Valid Phones */}
                            {phoneCheckResults.valid.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <CheckCircle className="text-emerald-400" size={18} />
                                        Валидные телефоны ({phoneCheckResults.valid.length})
                                    </h3>
                                    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-800/50 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Клиент</th>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Исходный</th>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Формат для планшета</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700">
                                                    {phoneCheckResults.valid.map(client => (
                                                        <tr key={client.id} className="hover:bg-slate-700/30">
                                                            <td className="px-4 py-2 text-white">{client.name}</td>
                                                            <td className="px-4 py-2 text-slate-400 font-mono">{client.phone}</td>
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
                            {phoneCheckResults.invalid.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <XCircle className="text-red-400" size={18} />
                                        Невалидные телефоны ({phoneCheckResults.invalid.length})
                                    </h3>
                                    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-800/50 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Клиент</th>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Телефон</th>
                                                        <th className="px-4 py-2 text-left text-slate-400 font-medium">Ошибка</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700">
                                                    {phoneCheckResults.invalid.map(client => (
                                                        <tr key={client.id} className="hover:bg-slate-700/30">
                                                            <td className="px-4 py-2 text-white">{client.name}</td>
                                                            <td className="px-4 py-2 text-slate-400 font-mono">{client.phone}</td>
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
                            {phoneCheckResults.missing.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <AlertCircle className="text-yellow-400" size={18} />
                                        Без телефона ({phoneCheckResults.missing.length})
                                    </h3>
                                    <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-4">
                                        <div className="flex flex-wrap gap-2">
                                            {phoneCheckResults.missing.map(client => (
                                                <span key={client.id} className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm border border-yellow-500/20">
                                                    {client.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsPhoneCheckModalOpen(false)}
                                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
