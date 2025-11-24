import React, { useState, useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import { Plus, Search, Phone, Mail, MapPin, Edit, Trash2, DollarSign, Wallet, History, ArrowDownLeft } from 'lucide-react';

interface CRMProps {
    clients: Client[];
    onSave: (clients: Client[]) => void;
    orders: Order[];
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
}

export const CRM: React.FC<CRMProps> = ({ clients, onSave, orders, transactions, setTransactions }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [selectedClientForRepayment, setSelectedClientForRepayment] = useState<Client | null>(null);

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
            alert('Имя и Телефон обязательны!');
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

        setTransactions([...transactions, newTransaction]);

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
        alert('Долг успешно погашен!');
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        );
    }, [clients, searchTerm]);

    // Calculate stats per client
    const getClientStats = (clientId: string) => {
        const clientOrders = orders.filter(o => o.customerName === clients.find(c => c.id === clientId)?.name);
        return {
            ordersCount: clientOrders.length,
            lastOrderDate: clientOrders.length > 0 ? clientOrders[clientOrders.length - 1].date : '-'
        };
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">База Клиентов</h2>
                    <p className="text-slate-400 mt-1">Управление контактами и историей продаж</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-primary-600/20"
                >
                    <Plus size={20} /> Новый клиент
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Поиск по имени или телефону..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-20 custom-scrollbar">
                {filteredClients.map(client => {
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
        </div>
    );
};
