import React, { useState, useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import { User } from 'firebase/auth';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Search, Phone, Mail, MapPin, Edit, Trash2, DollarSign, Wallet, History, ArrowDownLeft, BarChart3, TrendingUp, Calendar, CheckCircle, XCircle, AlertCircle, Smartphone } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { checkAllPhones, formatPhoneForTablet, validateUzbekistanPhone } from '../utils/phoneFormatter';
import { SUPER_ADMIN_EMAILS } from '../constants';
import { IdGenerator } from '../utils/idGenerator';

interface CRMProps {
    clients: Client[];
    onSave: (clients: Client[]) => void;
    orders: Order[];
    onSaveOrders?: (orders: Order[]) => void;
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
    onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
    currentUser?: User | null;
}

type CRMView = 'clients' | 'repaymentStats';

export const CRM: React.FC<CRMProps> = ({ clients, onSave, orders, onSaveOrders, transactions, setTransactions, onSaveTransactions, currentUser }) => {
    const toast = useToast();
    const { theme } = useTheme();
    const t = getThemeClasses(theme);
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
    const [exchangeRate, setExchangeRate] = useState<number>(12800); // Default, should come from settings
    const [selectedOrderForRepayment, setSelectedOrderForRepayment] = useState<string | null>(null); // ID выбранного заказа
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

    const handleOpenModal = (client?: Client) => {
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
    };

    const handleOpenRepayModal = (client: Client) => {
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
    };

    // Получить непогашенные заказы клиента для погашения
    // Тип для истории платежей
    type PaymentRecord = {
        date: string;
        amount: number;
        amountUSD: number;
        currency: string;
        method: string;
    };
    
    const getOrderPaidUSD = (order: any) => {
        if (typeof order.amountPaidUSD === 'number') return order.amountPaidUSD;
        if (order.paymentCurrency === 'USD') return order.amountPaid || 0;
        // Fallback: best effort if currency unknown
        return order.amountPaid || 0;
    };

    const hasOpenBalance = (order: any) => {
        const paidUSD = getOrderPaidUSD(order);
        return ((order.totalAmount || 0) - paidUSD) > 0.01;
    };

    const isDebtOrder = (order: any) => {
        const status = order.paymentStatus;
        return order.paymentMethod === 'debt' || status === 'unpaid' || status === 'partial' || hasOpenBalance(order);
    };

    // Функция для расчёта актуального долга клиента из заказов и транзакций
    const calculateClientDebt = (client: Client): number => {
        const clientId = client.id;
        const clientName = (client.name || '').toLowerCase().trim();
        const companyName = (client.companyName || '').toLowerCase().trim();
        
        let totalDebt = 0;
        let totalRepaid = 0;
        
        // Найти ВСЕ заказы клиента которые БЫЛИ в долг
        // Используем ту же логику что и в getClientDebtHistory
        orders.forEach(order => {
            const orderClientName = (order.customerName || '').toLowerCase().trim();
            const matchesClient = 
                order.clientId === clientId || 
                orderClientName === clientName ||
                (clientName && orderClientName.includes(clientName)) ||
                (clientName && clientName.includes(orderClientName)) ||
                (companyName && orderClientName.includes(companyName)) ||
                (companyName && companyName.includes(orderClientName));
            
            // Заказ был в долг: paymentMethod === 'debt' ИЛИ статус unpaid/partial ИЛИ totalAmount > amountPaid
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial' ||
                                 ((order.totalAmount || 0) > (order.amountPaid || 0) + 0.01);
            
            if (matchesClient && wasDebtOrder) {
                const paidUSD = getOrderPaidUSD(order);
                // Реальный долг = totalAmount минус то что оплачено в самом заказе (amountPaid)
                const actualDebt = Math.max(0, (order.totalAmount || 0) - paidUSD);
                totalDebt += actualDebt;
            }
        });

        // Собираем ID заказов для поиска погашений
        const clientOrderIds: string[] = [];
        orders.forEach(order => {
            const orderClientName = (order.customerName || '').toLowerCase().trim();
            const matchesClient = 
                order.clientId === clientId || 
                orderClientName === clientName ||
                (clientName && orderClientName.includes(clientName)) ||
                (companyName && orderClientName.includes(companyName));
            if (matchesClient) {
                clientOrderIds.push(order.id.toLowerCase());
            }
        });
        
        // Найти все транзакции погашений для этого клиента
        transactions.forEach(tx => {
            const txDescription = (tx.description || '').toLowerCase();
            const relatedIdLower = (tx.relatedId || '').toLowerCase();
            
            const matchesClient = 
                tx.relatedId === clientId ||
                clientOrderIds.includes(relatedIdLower) ||
                (clientName && txDescription.includes(clientName)) ||
                (companyName && txDescription.includes(companyName));
            
            // Также проверяем связь с заказами клиента
            const matchesClientOrder = clientOrderIds.some(orderId => 
                relatedIdLower === orderId ||
                txDescription.includes(orderId)
            );
            
            if (matchesClient || matchesClientOrder) {
                // Погашение долга - type income/client_payment/sale с "погашение" в описании
                if ((tx.type === 'income' || tx.type === 'client_payment' || tx.type === 'sale') && 
                    (txDescription.includes('погашение') || txDescription.includes('repayment'))) {
                    let amountInUSD = tx.amount || 0;
                    if (tx.currency === 'UZS' && tx.exchangeRate) {
                        amountInUSD = (tx.amount || 0) / tx.exchangeRate;
                    }
                    totalRepaid += amountInUSD;
                }
            }
        });
        
        return Math.max(0, totalDebt - totalRepaid);
    };
    
    const getUnpaidOrdersForClient = useMemo(() => {
        if (!selectedClientForRepayment) return [];
        
        const clientId = selectedClientForRepayment.id;
        const clientName = (selectedClientForRepayment.name || '').toLowerCase().trim();
        const companyName = (selectedClientForRepayment.companyName || '').toLowerCase().trim();
        
        const unpaidOrders: { 
            id: string; 
            date: string; 
            totalAmount: number; 
            amountPaid: number; 
            debtAmount: number; 
            items: string;
            reportNo?: number;
            paymentDueDate?: string;
            payments: PaymentRecord[];
        }[] = [];
        
        // Найти заказы в долг (с paymentMethod === 'debt' или статусами unpaid/partial)
        orders.forEach(order => {
            const orderClientName = (order.customerName || '').toLowerCase().trim();
            const matchesClient = 
                order.clientId === clientId || 
                orderClientName === clientName ||
                (clientName && orderClientName.includes(clientName)) ||
                (clientName && clientName.includes(orderClientName)) ||
                (companyName && orderClientName.includes(companyName));
            
            // Заказ был в долг если paymentMethod === 'debt' или статус unpaid/partial
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial';
            
            if (matchesClient && wasDebtOrder) {
                // Рассчитать погашения из транзакций для этого заказа
                // Погашения могут быть type: 'income', 'client_payment', 'sale'
                const repayments = transactions.filter(t => {
                    const desc = (t.description || '').toLowerCase();
                    const isRepaymentType = desc.includes('погашение') || t.type === 'client_payment';
                    
                    // ОБЯЗАТЕЛЬНО должна быть привязка к этому заказу
                    const orderId = order.id.toLowerCase();
                    const matchesThisOrder = 
                        t.relatedId === order.id ||
                        t.relatedId?.toLowerCase() === orderId ||
                        desc.includes(orderId);
                    
                    return isRepaymentType && matchesThisOrder;
                });
                
                // Собираем историю платежей (поле может быть method или paymentMethod)
                const payments: PaymentRecord[] = repayments.map(r => ({
                    date: r.date,
                    amount: r.amount || 0,
                    amountUSD: r.currency === 'UZS' && r.exchangeRate ? (r.amount || 0) / r.exchangeRate : (r.amount || 0),
                    currency: r.currency || 'USD',
                    method: (r as any).method || r.paymentMethod || 'cash'
                }));
                
                // Суммируем погашения в USD
                let totalRepaidUSD = getOrderPaidUSD(order);
                repayments.forEach(r => {
                    if (r.currency === 'UZS' && r.exchangeRate) {
                        totalRepaidUSD += (r.amount || 0) / r.exchangeRate;
                    } else {
                        totalRepaidUSD += (r.amount || 0);
                    }
                });
                
                const debtAmount = (order.totalAmount || 0) - totalRepaidUSD;
                if (debtAmount > 0.01) {
                    unpaidOrders.push({
                        id: order.id,
                        date: order.date,
                        totalAmount: order.totalAmount || 0,
                        amountPaid: totalRepaidUSD,
                        debtAmount,
                        items: (order.items || []).map(it => it.productName).slice(0, 2).join(', ') + (order.items && order.items.length > 2 ? '...' : ''),
                        reportNo: order.reportNo,
                        paymentDueDate: order.paymentDueDate,
                        payments
                    });
                }
            }
        });
        
        // Также проверить транзакции "Долг по заказу"
        transactions.forEach(tx => {
            const txDescription = (tx.description || '').toLowerCase();
            const matchesClient = 
                tx.relatedId === clientId ||
                (clientName && txDescription.includes(clientName)) ||
                (companyName && txDescription.includes(companyName));
            
            // Также проверяем долг по обязательствам или "Долг по заказу"
            if (matchesClient && (tx.type === 'debt_obligation' || txDescription.includes('долг по заказу'))) {
                // Извлечь ID заказа из описания (если есть)
                const orderIdMatch = txDescription.match(/ord-[a-z0-9-]+/i);
                // Если нет ORD-..., используем ID транзакции как идентификатор долга
                const orderId = orderIdMatch ? orderIdMatch[0].toUpperCase() : tx.id;
                
                // Проверить не добавлен ли уже этот заказ
                const existingOrder = unpaidOrders.find(o => o.id === orderId || o.id.toLowerCase() === orderId.toLowerCase());
                if (!existingOrder) {
                    // Рассчитать сколько погашено по этому заказу
                    // Ищем по relatedId или по упоминанию ID заказа в описании
                    // Погашения могут быть type: 'income', 'client_payment', 'sale'
                    const repayments = transactions.filter(t => {
                        const desc = (t.description || '').toLowerCase();
                        const isRepayment = desc.includes('погашение') || t.type === 'client_payment';
                        const matchesOrder = 
                            t.relatedId === orderId ||
                            t.relatedId?.toLowerCase() === orderId.toLowerCase() ||
                            desc.includes(orderId.toLowerCase());
                        return isRepayment && matchesOrder;
                    });
                    
                    // Собираем историю платежей из транзакций (поле method или paymentMethod)
                    const payments: PaymentRecord[] = repayments.map(r => ({
                        date: r.date,
                        amount: r.amount || 0,
                        amountUSD: r.currency === 'UZS' && r.exchangeRate ? (r.amount || 0) / r.exchangeRate : (r.amount || 0),
                        currency: r.currency || 'USD',
                        method: (r as any).method || r.paymentMethod || 'cash'
                    }));
                    
                    // Суммируем в USD
                    let totalRepaidUSD = 0;
                    repayments.forEach(r => {
                        if (r.currency === 'UZS' && r.exchangeRate) {
                            totalRepaidUSD += (r.amount || 0) / r.exchangeRate;
                        } else {
                            totalRepaidUSD += (r.amount || 0);
                        }
                    });
                    
                    const debtAmount = (tx.amount || 0) - totalRepaidUSD;
                    
                    if (debtAmount > 0.01) {
                        unpaidOrders.push({
                            id: orderId,
                            date: tx.date,
                            totalAmount: tx.amount || 0,
                            amountPaid: totalRepaidUSD,
                            debtAmount,
                            items: tx.description || '',
                            payments
                        });
                    }
                }
            }
        });
        
        // Сортировать по дате (старые первые - для FIFO распределения)
        unpaidOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Собираем ID всех заказов клиента
        const allOrderIds = unpaidOrders.map(o => o.id.toLowerCase());
        
        // Найти погашения клиента БЕЗ привязки к конкретному заказу
        // (когда relatedId = clientId, а не orderId)
        const clientPaymentsWithoutOrder = transactions.filter(t => {
            const desc = (t.description || '').toLowerCase();
            const isRepayment = desc.includes('погашение') || t.type === 'client_payment';
            const isForClient = t.relatedId === clientId || 
                (clientName && desc.includes(clientName)) ||
                (companyName && desc.includes(companyName));
            
            // Проверяем что это НЕ привязано к конкретному заказу
            // relatedId начинается с ORD- = привязан к заказу
            const relatedIdIsOrder = t.relatedId?.toUpperCase().startsWith('ORD-');
            // Или в описании есть ссылка на конкретный заказ из списка
            const descHasOrderRef = allOrderIds.some(orderId => desc.includes(orderId));
            
            return isRepayment && isForClient && !relatedIdIsOrder && !descHasOrderRef;
        });
        
        // Суммируем неразмеченные погашения в USD
        let unallocatedPaymentsUSD = 0;
        clientPaymentsWithoutOrder.forEach(t => {
            if (t.currency === 'UZS' && t.exchangeRate) {
                unallocatedPaymentsUSD += (t.amount || 0) / t.exchangeRate;
            } else {
                unallocatedPaymentsUSD += (t.amount || 0);
            }
        });
        
        // Распределяем неразмеченные погашения по заказам (FIFO - старые первые)
        if (unallocatedPaymentsUSD > 0) {
            for (const order of unpaidOrders) {
                if (unallocatedPaymentsUSD <= 0) break;
                
                const canPay = Math.min(unallocatedPaymentsUSD, order.debtAmount);
                order.amountPaid += canPay;
                order.debtAmount -= canPay;
                unallocatedPaymentsUSD -= canPay;
            }
        }
        
        // Убираем полностью оплаченные заказы
        const stillUnpaid = unpaidOrders.filter(o => o.debtAmount > 0.01);
        
        // Fallback: если заказы не нашлись, но по расчёту есть долг - создаём виртуальный чек
        const calculatedDebt = selectedClientForRepayment ? calculateClientDebt(selectedClientForRepayment) : 0;
        if (stillUnpaid.length === 0 && calculatedDebt > 0.01) {
            stillUnpaid.push({
                id: `DEBT-${clientId}`,
                date: new Date().toISOString(),
                totalAmount: calculatedDebt,
                amountPaid: 0,
                debtAmount: calculatedDebt,
                items: 'Общий долг клиента',
                payments: []
            });
        }
        
        return stillUnpaid;
    }, [selectedClientForRepayment, orders, transactions]);

    const handleOpenDebtHistoryModal = (client: Client) => {
        setSelectedClientForHistory(client);
        setIsDebtHistoryModalOpen(true);
    };

    // Получить полную историю долгов клиента - заказы в долг + транзакции
    const getClientDebtHistory = useMemo(() => {
        if (!selectedClientForHistory) return { orders: [], transactions: [], allHistory: [] };
        
        const clientId = selectedClientForHistory.id;
        const clientName = (selectedClientForHistory.name || '').toLowerCase().trim();
        const companyName = (selectedClientForHistory.companyName || '').toLowerCase().trim();
        
        type HistoryItem = {
            id: string;
            date: string;
            type: 'order' | 'repayment' | 'transaction';
            description: string;
            items?: { name: string; qty: number; price: number }[];
            totalAmount: number;
            amountPaid: number;
            debtChange: number; // + добавляет долг, - уменьшает
            balance: number;
            reportNo?: number;
            paymentMethod?: string;
            currency?: string;
            exchangeRate?: number;
            amountInUSD?: number;
            paymentDueDate?: string;
        };
        
        const allHistory: HistoryItem[] = [];
        
        // Найти все заказы в долг для этого клиента (включая полностью оплаченные)
        // Показываем заказы которые БЫЛИ в долг (paymentMethod === 'debt' или paymentStatus !== 'paid')
        orders.forEach(order => {
            const orderClientName = (order.customerName || '').toLowerCase().trim();
            const matchesClient = 
                order.clientId === clientId || 
                orderClientName === clientName ||
                (clientName && orderClientName.includes(clientName)) ||
                (clientName && clientName.includes(orderClientName)) ||
                (companyName && orderClientName.includes(companyName)) ||
                (companyName && companyName.includes(orderClientName));
            
            // Заказ был в долг если: paymentMethod === 'debt' ИЛИ был partial/unpaid ИЛИ amountPaid < totalAmount
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial' ||
                                 ((order.totalAmount || 0) > (order.amountPaid || 0) + 0.01);
            
            if (matchesClient && wasDebtOrder) {
                const paidUSD = getOrderPaidUSD(order);
                // Реальный остаток долга по заказу = totalAmount - то что уже оплачено
                const actualDebt = Math.max(0, (order.totalAmount || 0) - paidUSD);
                
                allHistory.push({
                    id: order.id,
                    date: order.date,
                    type: 'order',
                    description: order.reportNo ? `Отчёт №${order.reportNo}` : `Заказ #${order.id.slice(-6)}`,
                    items: (order.items || []).map(it => ({
                        name: it.productName || 'Товар',
                        qty: it.quantity || 0,
                        price: it.priceAtSale || 0
                    })),
                    totalAmount: order.totalAmount || 0,
                    amountPaid: paidUSD,
                    debtChange: actualDebt, // Реальный долг = сумма минус уже оплаченное
                    balance: actualDebt, // Текущий остаток
                    reportNo: order.reportNo,
                    paymentDueDate: order.paymentDueDate
                });
            }
        });
        
        // Собираем ID всех заказов этого клиента для поиска погашений
        const clientOrderIds = allHistory.filter(h => h.type === 'order').map(h => h.id.toLowerCase());
        
        // Найти все транзакции связанные с этим клиентом
        transactions.forEach(tx => {
            const txDescription = (tx.description || '').toLowerCase();
            const matchesClient = 
                tx.relatedId === clientId ||
                (clientName && txDescription.includes(clientName)) ||
                (companyName && txDescription.includes(companyName));
            
            // Также проверяем связь с заказами клиента
            const matchesClientOrder = clientOrderIds.some(orderId => 
                tx.relatedId?.toLowerCase() === orderId ||
                txDescription.includes(orderId)
            );
            
            if (matchesClient || matchesClientOrder) {
                // Долг по заказу или ручное обязательство - это создание долга (добавление)
                if (tx.type === 'debt_obligation' || txDescription.includes('долг по заказу') || txDescription.includes('debt for order')) {
                    // Проверяем, не добавлен ли уже этот заказ (avoid double counting of orders)
                    const alreadyExists = allHistory.some(h => 
                        h.id === tx.id || 
                        (tx.relatedId && h.id === tx.relatedId && h.type === 'order') ||
                        (txDescription.includes(h.id.toLowerCase()) && h.type === 'order')
                    );
                    if (alreadyExists) return; // Пропускаем дубликаты
                    
                    // Найдём reportNo из связанного заказа (если есть)
                    const relatedOrder = orders.find(o => 
                        tx.description?.toLowerCase().includes(o.id.toLowerCase()) ||
                        tx.relatedId === o.id
                    );
                    
                    allHistory.push({
                        id: tx.id,
                        date: tx.date,
                        type: 'order', // Treat as debt increase
                        description: relatedOrder?.reportNo 
                            ? `Отчёт №${relatedOrder.reportNo}` 
                            : (tx.description || 'Начальный долг / Обязательство'),
                        totalAmount: tx.amount || 0,
                        amountPaid: 0,
                        debtChange: tx.amount || 0, // Добавляет долг
                        balance: 0,
                        reportNo: relatedOrder?.reportNo,
                        paymentDueDate: relatedOrder?.paymentDueDate
                    });
                }
                // Погашение долга - уменьшение долга (type может быть 'income', 'client_payment', 'sale')
                else if ((tx.type === 'income' || tx.type === 'client_payment' || tx.type === 'sale') && (txDescription.includes('погашение') || txDescription.includes('repayment'))) {
                    // Определяем сумму в USD
                    let amountInUSD = tx.amount || 0;
                    if (tx.currency === 'UZS' && tx.exchangeRate) {
                        amountInUSD = (tx.amount || 0) / tx.exchangeRate;
                    }
                    
                    // Поле может называться method или paymentMethod
                    const payMethod = (tx as any).method || tx.paymentMethod;
                    
                    allHistory.push({
                        id: tx.id,
                        date: tx.date,
                        type: 'repayment',
                        description: tx.description || 'Погашение долга',
                        totalAmount: tx.amount || 0,
                        amountPaid: tx.amount || 0,
                        debtChange: -amountInUSD, // Уменьшает долг в USD
                        balance: 0,
                        paymentMethod: payMethod,
                        currency: tx.currency || 'USD',
                        exchangeRate: tx.exchangeRate,
                        amountInUSD
                    });
                }
                // Другие транзакции связанные с клиентом
                else if (tx.type === 'sale' || tx.type === 'income') {
                    // Пропускаем обычные продажи, они уже в заказах
                }
            }
        });
        
        // Сортировать по дате
        allHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Рассчитать баланс (накопительный долг)
        let runningBalance = 0;
        allHistory.forEach(item => {
            runningBalance += item.debtChange;
            item.balance = Math.max(0, runningBalance);
        });
        
        // Вернуть в обратном порядке (новые сверху)
        return allHistory.reverse();
    }, [selectedClientForHistory, orders, transactions]);

    // Общая сумма долга из истории
    const totalDebtFromOrders = useMemo(() => {
        if (!Array.isArray(getClientDebtHistory)) return 0;
        return getClientDebtHistory.filter(h => h.type === 'order').reduce((sum, h) => sum + h.debtChange, 0);
    }, [getClientDebtHistory]);

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
                id: IdGenerator.client(),
                ...formData as Client,
                totalPurchases: 0,
                totalDebt: 0
            };
            onSave([...clients, newClient]);
        }
        setIsModalOpen(false);
    };

    const handleRepayDebt = async () => {
        if (!selectedClientForRepayment) return;

        let amountInUSD = 0;
        const newTransactions: Transaction[] = [];
        // Используем полный ID заказа для правильного сопоставления при расчёте погашений
        const orderRef = selectedOrderForRepayment ? ` (Чек ${selectedOrderForRepayment})` : '';

        if (repaymentMethod === 'mixed') {
            // Микс-оплата: создаём транзакции для каждого способа
            if (mixCashUZS > 0) {
                const usd = mixCashUZS / exchangeRate;
                amountInUSD += usd;
                newTransactions.push({
                    id: IdGenerator.transaction(),
                    date: new Date().toISOString(),
                    type: 'client_payment',
                    amount: mixCashUZS,
                    currency: 'UZS',
                    exchangeRate: exchangeRate,
                    method: 'cash',
                    description: `Погашение долга (нал UZS): ${selectedClientForRepayment.name}${orderRef}`,
                    relatedId: selectedOrderForRepayment || selectedClientForRepayment.id
                });
            }
            if (mixCashUSD > 0) {
                amountInUSD += mixCashUSD;
                newTransactions.push({
                    id: IdGenerator.transaction(),
                    date: new Date().toISOString(),
                    type: 'client_payment',
                    amount: mixCashUSD,
                    currency: 'USD',
                    method: 'cash',
                    description: `Погашение долга (нал USD): ${selectedClientForRepayment.name}${orderRef}`,
                    relatedId: selectedOrderForRepayment || selectedClientForRepayment.id
                });
            }
            if (mixCard > 0) {
                const usd = mixCard / exchangeRate;
                amountInUSD += usd;
                newTransactions.push({
                    id: IdGenerator.transaction(),
                    date: new Date().toISOString(),
                    type: 'client_payment',
                    amount: mixCard,
                    currency: 'UZS',
                    exchangeRate: exchangeRate,
                    method: 'card',
                    description: `Погашение долга (карта): ${selectedClientForRepayment.name}${orderRef}`,
                    relatedId: selectedOrderForRepayment || selectedClientForRepayment.id
                });
            }
            if (mixBank > 0) {
                const usd = mixBank / exchangeRate;
                amountInUSD += usd;
                newTransactions.push({
                    id: IdGenerator.transaction(),
                    date: new Date().toISOString(),
                    type: 'client_payment',
                    amount: mixBank,
                    currency: 'UZS',
                    exchangeRate: exchangeRate,
                    method: 'bank',
                    description: `Погашение долга (перечисление): ${selectedClientForRepayment.name}${orderRef}`,
                    relatedId: selectedOrderForRepayment || selectedClientForRepayment.id
                });
            }

            if (newTransactions.length === 0) {
                toast.warning('Введите сумму хотя бы одним способом');
                return;
            }
        } else {
            // Одиночный способ оплаты
            if (repaymentAmount <= 0) {
                toast.warning('Введите сумму погашения');
                return;
            }
            amountInUSD = repaymentAmount;
            if (repaymentCurrency === 'UZS' && exchangeRate > 0) {
                amountInUSD = repaymentAmount / exchangeRate;
            }

            newTransactions.push({
                id: IdGenerator.transaction(),
                date: new Date().toISOString(),
                type: 'client_payment',
                amount: repaymentAmount,
                currency: repaymentCurrency,
                exchangeRate: repaymentCurrency === 'UZS' ? exchangeRate : undefined,
                method: repaymentMethod,
                description: `Погашение долга: ${selectedClientForRepayment.name}${orderRef}`,
                relatedId: selectedOrderForRepayment || selectedClientForRepayment.id
            });
        }

        // Сохраняем все транзакции
        const updatedTransactions = [...transactions, ...newTransactions];
        setTransactions(updatedTransactions);
        if (onSaveTransactions) {
            await onSaveTransactions(updatedTransactions);
        }

        // 2. Update Order amountPaid if specific order was selected
        if (selectedOrderForRepayment && onSaveOrders) {
            const updatedOrders = orders.map(order => {
                if (order.id === selectedOrderForRepayment) {
                    const newAmountPaid = (order.amountPaid || 0) + amountInUSD;
                    const newDebt = Math.max(0, (order.totalAmount || 0) - newAmountPaid);
                    const isPaidOff = newDebt < 0.01;
                    return {
                        ...order,
                        amountPaid: newAmountPaid,
                        // Обновляем статус оплаты
                        paymentStatus: isPaidOff ? 'paid' : 'partial',
                        // Если полностью оплачено - меняем метод (опционально)
                        paymentMethod: isPaidOff ? (order.paymentMethod === 'debt' ? 'cash' : order.paymentMethod) : order.paymentMethod
                    };
                }
                return order;
            });
            await onSaveOrders(updatedOrders);
        }

        // 3. Пересчитываем долг клиента динамически
        // Вместо простого вычитания - считаем заново из всех заказов
        const recalculatedDebt = calculateClientDebt(selectedClientForRepayment) - amountInUSD;
        
        const updatedClients = clients.map(c => {
            if (c.id === selectedClientForRepayment.id) {
                return {
                    ...c,
                    totalDebt: Math.max(0, recalculatedDebt)
                };
            }
            return c;
        });

        onSave(updatedClients);
        setIsRepayModalOpen(false);
        toast.success('Долг успешно погашен!');
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
                <div className="flex-1 overflow-y-auto space-y-6 pb-20 custom-scrollbar">
                    {/* Time Range Selector */}
                    <div className={`flex items-center gap-2 ${t.bgCard} rounded-xl p-1 border ${t.border} w-full sm:w-auto`}>
                        {(['week', 'month', 'year', 'all'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setStatsTimeRange(range)}
                                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                    statsTimeRange === range
                                        ? t.tabActive
                                        : t.tabInactive
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
                        <div className={`${t.bgStatEmerald} p-4 sm:p-6 rounded-xl border`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 ${t.iconBgEmerald} rounded-lg`}>
                                    <TrendingUp size={20} className={t.iconEmerald} />
                                </div>
                                <p className={`text-xs sm:text-sm ${t.textMuted}`}>Всего погашено</p>
                            </div>
                            <p className={`text-2xl sm:text-3xl font-mono font-bold ${t.iconEmerald}`}>
                                ${repaymentStats.totalRepaidUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className={`${t.bgStatBlue} p-4 sm:p-6 rounded-xl border`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 ${t.iconBgBlue} rounded-lg`}>
                                    <History size={20} className={t.iconBlue} />
                                </div>
                                <p className={`text-xs sm:text-sm ${t.textMuted}`}>Количество операций</p>
                            </div>
                            <p className={`text-2xl sm:text-3xl font-mono font-bold ${t.iconBlue}`}>
                                {repaymentStats.totalCount}
                            </p>
                        </div>
                        <div className={`${t.bgStatPurple} p-4 sm:p-6 rounded-xl border sm:col-span-2 lg:col-span-1`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 ${t.iconBgPurple} rounded-lg`}>
                                    <DollarSign size={20} className={t.iconPurple} />
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
                        <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 sm:p-6`}>
                            <h3 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
                                <Calendar className="text-blue-400" size={20} /> Погашения по дням
                            </h3>
                            {repaymentStats.chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={repaymentStats.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#334155" : "#e2e8f0"} />
                                        <XAxis dataKey="date" stroke={theme === 'dark' ? "#94a3b8" : "#64748b"} fontSize={12} />
                                        <YAxis stroke={theme === 'dark' ? "#94a3b8" : "#64748b"} fontSize={12} />
                                        <Tooltip
                                            contentStyle={{ 
                                                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                                borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                            }}
                                            formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                        />
                                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className={`h-[300px] flex items-center justify-center ${t.textMuted}`}>
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </div>

                        {/* Repayments by Method Chart */}
                        <div className={`${t.bgCard} rounded-xl border ${t.border} p-4 sm:p-6`}>
                            <h3 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
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
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke={theme === 'dark' ? undefined : '#fff'} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ 
                                                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                                                borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', 
                                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a' 
                                            }}
                                            formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className={`h-[300px] flex items-center justify-center ${t.textMuted}`}>
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Clients Table */}
                    <div className={`${t.bgCard} rounded-xl border ${t.border} overflow-hidden`}>
                        <div className={`p-4 sm:p-6 border-b ${t.border}`}>
                            <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                                <BarChart3 className="text-indigo-400" size={20} /> Топ клиентов по погашениям
                            </h3>
                        </div>
                        {repaymentStats.topClients.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} text-xs uppercase ${t.textMuted} font-medium`}>
                                        <tr>
                                            <th className="px-4 sm:px-6 py-3">Клиент</th>
                                            <th className="px-4 sm:px-6 py-3 text-right">Сумма (USD)</th>
                                            <th className="px-4 sm:px-6 py-3 text-center">Операций</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${t.divide}`}>
                                        {repaymentStats.topClients.map((client, index) => (
                                            <tr key={client.name} className={`${theme === 'dark' ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                                                <td className="px-4 sm:px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <span className={`font-medium ${t.text}`}>{client.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-right font-mono text-emerald-500 font-bold">
                                                    ${client.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`px-4 sm:px-6 py-4 text-center ${t.textMuted}`}>
                                                    {client.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={`p-12 text-center ${t.textMuted}`}>
                                Нет данных за выбранный период
                            </div>
                        )}
                    </div>
                </div>
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
                    </div>

                    {/* Clients Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-12 custom-scrollbar">
                        {displayedClients.map(client => {
                            const isLegal = client.type === 'legal';
                            return (
                                <div key={client.id} className={`${t.bgCard} rounded-xl border p-5 hover:${theme === 'dark' ? 'border-slate-500' : 'border-slate-400'} transition-all group relative overflow-hidden ${isLegal ? 'border-blue-500/30' : t.border}`}>
                                    {/* Type Badge */}
                                    <div className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold ${isLegal ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                        {isLegal ? '🏢 Юр. лицо' : '👤 Физ. лицо'}
                                    </div>
                                    
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleOpenModal(client)} className={`p-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} rounded-lg ${t.textMuted} hover:${t.text}`}>
                                            <Edit size={16} />
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
                                                ${(client.totalPurchases || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className={`text-xs ${t.textMuted} uppercase`}>Долг</p>
                                            <p className={`font-mono font-bold ${calculateClientDebt(client) > 0 ? 'text-red-500' : t.textMuted}`}>
                                                ${calculateClientDebt(client).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => handleOpenDebtHistoryModal(client)}
                                            className={`px-3 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1`}
                                            title="История долгов"
                                        >
                                            <History size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleOpenRepayModal(client)}
                                            disabled={calculateClientDebt(client) <= 0}
                                            className={`flex-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200 text-slate-700'} hover:bg-emerald-600 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2`}
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
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-lg border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col`}>
                        <div className={`p-6 border-b ${t.border} flex justify-between items-center flex-shrink-0`}>
                            <h3 className={`text-xl font-bold ${t.text}`}>
                                {editingClient ? 'Редактировать клиента' : 'Новый клиент'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${t.textMuted} hover:${t.text}`}>
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            {/* Client Type Selector */}
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Тип клиента</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'individual' })}
                                        className={`py-3 rounded-xl text-sm font-bold transition-all border ${formData.type !== 'legal' 
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                                            : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
                                    >
                                        👤 Физ. лицо
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'legal' })}
                                        className={`py-3 rounded-xl text-sm font-bold transition-all border ${formData.type === 'legal' 
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-500' 
                                            : `${t.bg} ${t.border} ${t.textMuted} hover:${t.bgHover}`}`}
                                    >
                                        🏢 Юр. лицо
                                    </button>
                                </div>
                            </div>

                            {/* Common Fields */}
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>
                                    {formData.type === 'legal' ? 'Контактное лицо *' : 'Имя клиента *'}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={formData.type === 'legal' ? 'ФИО контактного лица' : 'ФИО клиента'}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Телефон *</label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+998 XX XXX XX XX"
                                />
                            </div>

                            {/* Legal Entity Fields */}
                            {formData.type === 'legal' && (
                                <div className="space-y-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                                    <h4 className="text-sm font-bold text-blue-500 flex items-center gap-2">
                                        🏢 Реквизиты организации
                                    </h4>
                                    <div className="space-y-2">
                                        <label className={`text-sm font-medium ${t.textMuted}`}>Название организации *</label>
                                        <input
                                            type="text"
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                            value={formData.companyName || ''}
                                            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                            placeholder="ООО, АО, ИП..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className={`text-sm font-medium ${t.textMuted}`}>ИНН</label>
                                            <input
                                                type="text"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                                value={formData.inn || ''}
                                                onChange={e => setFormData({ ...formData, inn: e.target.value })}
                                                placeholder="123456789"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`text-sm font-medium ${t.textMuted}`}>МФО</label>
                                            <input
                                                type="text"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                                value={formData.mfo || ''}
                                                onChange={e => setFormData({ ...formData, mfo: e.target.value })}
                                                placeholder="00000"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`text-sm font-medium ${t.textMuted}`}>Расчётный счёт</label>
                                        <input
                                            type="text"
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                            value={formData.bankAccount || ''}
                                            onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                                            placeholder="20208000..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`text-sm font-medium ${t.textMuted}`}>Название банка</label>
                                        <input
                                            type="text"
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                            value={formData.bankName || ''}
                                            onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                                            placeholder="АКБ Капиталбанк"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={`text-sm font-medium ${t.textMuted}`}>Юридический адрес</label>
                                        <input
                                            type="text"
                                            className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-blue-500 outline-none`}
                                            value={formData.addressLegal || ''}
                                            onChange={e => setFormData({ ...formData, addressLegal: e.target.value })}
                                            placeholder="г. Ташкент, ул..."
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>Email</label>
                                    <input
                                        type="email"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>Кредитный лимит ($)</label>
                                    <input
                                        type="number"
                                        className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                        value={formData.creditLimit}
                                        onChange={e => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>
                                    {formData.type === 'legal' ? 'Фактический адрес' : 'Адрес'}
                                </label>
                                <input
                                    type="text"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none`}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Заметки</label>
                                <textarea
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} focus:ring-2 focus:ring-primary-500 outline-none h-20 resize-none`}
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
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-md border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto`}>
                        <div className={`p-6 border-b ${t.border} flex justify-between items-center sticky top-0 ${t.bgCard} z-10`}>
                            <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                <Wallet className="text-emerald-500" /> Погашение долга
                            </h3>
                            <button onClick={() => setIsRepayModalOpen(false)} className={`${t.textMuted} hover:${t.text}`}>
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-4 rounded-xl border ${t.border}`}>
                                <p className={`text-sm ${t.textMuted} mb-1`}>Клиент</p>
                                <p className={`text-lg font-bold ${t.text}`}>{selectedClientForRepayment.name}</p>
                                <div className="mt-3 flex justify-between items-end">
                                    <span className={`text-sm ${t.textMuted}`}>Общий долг:</span>
                                    <span className="text-xl font-mono font-bold text-red-500">
                                        ${calculateClientDebt(selectedClientForRepayment).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Выбор заказа для погашения */}
                            {getUnpaidOrdersForClient.length > 0 && (
                                <div className="space-y-2">
                                    <label className={`text-sm font-medium ${t.textMuted}`}>Выберите чек для погашения</label>
                                    <div className={`max-h-64 overflow-y-auto space-y-2 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'} p-2 rounded-lg border ${t.border}`}>
                                        {getUnpaidOrdersForClient.map(order => (
                                            <div
                                                key={order.id}
                                                onClick={() => {
                                                    setSelectedOrderForRepayment(selectedOrderForRepayment === order.id ? null : order.id);
                                                    if (selectedOrderForRepayment !== order.id) {
                                                        setRepaymentAmount(order.debtAmount);
                                                    }
                                                }}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                    selectedOrderForRepayment === order.id
                                                        ? 'border-emerald-500 bg-emerald-500/10'
                                                        : `${t.border} hover:border-slate-400`
                                                }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className={`text-xs ${t.textMuted}`}>
                                                            {new Date(order.date).toLocaleDateString('ru-RU')}
                                                            {order.paymentDueDate && (
                                                                <span className="ml-2 text-amber-500">
                                                                    • До: {new Date(order.paymentDueDate).toLocaleDateString('ru-RU')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className={`font-mono text-sm font-bold ${t.text}`}>
                                                            Отчёт №{order.reportNo || order.id.slice(-4)}
                                                        </div>
                                                        <div className={`text-xs ${t.textMuted} truncate max-w-[180px]`}>{order.items}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-xs ${t.textMuted}`}>Сумма: ${order.totalAmount.toLocaleString()}</div>
                                                        <div className="text-sm font-mono font-bold text-red-500">
                                                            Долг: ${order.debtAmount.toLocaleString()}
                                                        </div>
                                                        {order.amountPaid > 0 && (
                                                            <div className={`text-xs ${t.success}`}>
                                                                Оплачено: ${order.amountPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* История платежей */}
                                                {order.payments && order.payments.length > 0 && (
                                                    <div className={`mt-2 pt-2 border-t ${t.border}`}>
                                                        <div className={`text-xs ${t.textMuted} mb-1`}>История оплат:</div>
                                                        <div className="space-y-1">
                                                            {order.payments.map((payment, idx) => (
                                                                <div key={idx} className={`flex justify-between text-xs ${t.text}`}>
                                                                    <span>
                                                                        {new Date(payment.date).toLocaleDateString('ru-RU')} • 
                                                                        {payment.method === 'cash' ? ' 💵 Нал' : 
                                                                         payment.method === 'card' ? ' 💳 Карта' : 
                                                                         payment.method === 'bank' ? ' 🏦 Банк' : ' Микс'}
                                                                    </span>
                                                                    <span className={t.success}>
                                                                        {payment.currency === 'UZS' 
                                                                            ? `${payment.amount.toLocaleString()} сум ($${payment.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                                                                            : `$${payment.amount.toLocaleString()}`
                                                                        }
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {selectedOrderForRepayment && (
                                        <div className="text-xs text-emerald-500">
                                            ✓ Выбран: Отчёт №{getUnpaidOrdersForClient.find(o => o.id === selectedOrderForRepayment)?.reportNo || selectedOrderForRepayment.slice(-4)} — долг ${getUnpaidOrdersForClient.find(o => o.id === selectedOrderForRepayment)?.debtAmount.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Способ оплаты</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('cash');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'cash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                                    >
                                        Нал
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('bank');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'bank' ? 'bg-purple-500/20 border-purple-500 text-purple-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                                    >
                                        Банк
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRepaymentMethod('card');
                                            setRepaymentCurrency('UZS');
                                        }}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'card' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                                    >
                                        Карта
                                    </button>
                                    <button
                                        onClick={() => setRepaymentMethod('mixed')}
                                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${repaymentMethod === 'mixed' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : `${t.bgCard} ${t.border} ${t.textMuted} hover:${t.text}`}`}
                                    >
                                        Микс
                                    </button>
                                </div>
                            </div>

                            {/* Курс обмена - всегда показываем */}
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ${t.textMuted}`}>Курс обмена (1 USD = ? UZS)</label>
                                <input
                                    type="number"
                                    className={`w-full ${t.input} border ${t.border} rounded-lg px-4 py-2 ${t.text} font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
                                    value={exchangeRate}
                                    onChange={e => setExchangeRate(Number(e.target.value))}
                                />
                            </div>

                            {/* Микс-оплата */}
                            {repaymentMethod === 'mixed' ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className={`text-xs font-medium ${t.textMuted}`}>💵 Нал (сум)</label>
                                            <input
                                                type="number"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none`}
                                                value={mixCashUZS || ''}
                                                onChange={e => setMixCashUZS(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={`text-xs font-medium ${t.textMuted}`}>💵 Нал ($)</label>
                                            <input
                                                type="number"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none`}
                                                value={mixCashUSD || ''}
                                                onChange={e => setMixCashUSD(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={`text-xs font-medium ${t.textMuted}`}>💳 Карта (сум)</label>
                                            <input
                                                type="number"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none`}
                                                value={mixCard || ''}
                                                onChange={e => setMixCard(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={`text-xs font-medium ${t.textMuted}`}>🏦 Перечисл. (сум)</label>
                                            <input
                                                type="number"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 ${t.text} font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none`}
                                                value={mixBank || ''}
                                                onChange={e => setMixBank(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Итоги микс-оплаты */}
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} p-3 rounded-lg border ${t.border}`}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className={`${t.textMuted}`}>Итого в USD:</span>
                                            <span className={`${t.success} font-mono font-bold`}>
                                                ${((mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={`${t.textMuted}`}>Остаток долга:</span>
                                            <span className={`${t.text} font-mono opacity-80`}>
                                                ${Math.max(0, (selectedClientForRepayment.totalDebt || 0) - ((mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Currency Selector (Only for Cash) */}
                                    {repaymentMethod === 'cash' && (
                                        <div className="space-y-2">
                                            <label className={`text-sm font-medium ${t.textMuted}`}>Валюта</label>
                                            <div className={`flex ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} rounded-lg p-1 border ${t.border}`}>
                                                <button
                                                    onClick={() => setRepaymentCurrency('UZS')}
                                                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'UZS' ? 'bg-slate-700 text-white' : `${t.textMuted} hover:${t.text}`}`}
                                                >
                                                    UZS (Сумы)
                                                </button>
                                                <button
                                                    onClick={() => setRepaymentCurrency('USD')}
                                                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${repaymentCurrency === 'USD' ? 'bg-slate-700 text-white' : `${t.textMuted} hover:${t.text}`}`}
                                                >
                                                    USD (Доллары)
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className={`text-sm font-medium ${t.textMuted}`}>
                                            Сумма погашения ({repaymentCurrency})
                                        </label>
                                        <div className="relative">
                                            <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
                                            <input
                                                type="number"
                                                className={`w-full ${t.input} border ${t.border} rounded-lg pl-10 pr-4 py-3 ${t.text} text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none`}
                                                value={repaymentAmount || ''}
                                                onChange={e => setRepaymentAmount(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>

                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} p-3 rounded-lg border ${t.border}`}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className={`${t.textMuted}`}>Сумма в USD:</span>
                                            <span className={`${t.text} font-mono`}>
                                                ${(repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={`${t.textMuted}`}>Остаток долга:</span>
                                            <span className={`${t.text} font-mono opacity-80`}>
                                                ${Math.max(0, (selectedClientForRepayment.totalDebt || 0) - (repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                onClick={handleRepayDebt}
                                disabled={repaymentMethod === 'mixed' 
                                    ? (mixCashUZS + mixCashUSD + mixCard + mixBank) <= 0 
                                    : repaymentAmount <= 0}
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
                    <div className={`${t.bgCard} rounded-xl border ${t.border} max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
                        <div className={`p-6 border-b ${t.border} flex items-center justify-between`}>
                            <h2 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                <Smartphone size={24} className="text-indigo-400" />
                                Проверка формата телефонов
                            </h2>
                            <button
                                onClick={() => setIsPhoneCheckModalOpen(false)}
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
                                        <span className="text-emerald-400 font-bold text-lg">{phoneCheckResults.valid.length}</span>
                                    </div>
                                    <p className={`${t.textMuted} text-sm`}>Валидные телефоны</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="text-red-400" size={20} />
                                        <span className="text-red-400 font-bold text-lg">{phoneCheckResults.invalid.length}</span>
                                    </div>
                                    <p className={`${t.textMuted} text-sm`}>Невалидные телефоны</p>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="text-yellow-400" size={20} />
                                        <span className="text-yellow-400 font-bold text-lg">{phoneCheckResults.missing.length}</span>
                                    </div>
                                    <p className={`${t.textMuted} text-sm`}>Без телефона</p>
                                </div>
                            </div>
                            
                            {/* Valid Phones */}
                            {phoneCheckResults.valid.length > 0 && (
                                <div>
                                    <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                        <CheckCircle className="text-emerald-400" size={18} />
                                        Валидные телефоны ({phoneCheckResults.valid.length})
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
                                                    {phoneCheckResults.valid.map(client => (
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
                            {phoneCheckResults.invalid.length > 0 && (
                                <div>
                                    <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                        <XCircle className="text-red-400" size={18} />
                                        Невалидные телефоны ({phoneCheckResults.invalid.length})
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
                                                    {phoneCheckResults.invalid.map(client => (
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
                            {phoneCheckResults.missing.length > 0 && (
                                <div>
                                    <h3 className={`text-lg font-bold ${t.text} mb-3 flex items-center gap-2`}>
                                        <AlertCircle className="text-yellow-400" size={18} />
                                        Без телефона ({phoneCheckResults.missing.length})
                                    </h3>
                                    <div className={`${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-lg border ${t.border} p-4`}>
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
                        
                        <div className={`p-6 border-t ${t.border} flex justify-end gap-3`}>
                            <button
                                onClick={() => setIsPhoneCheckModalOpen(false)}
                                className={`px-6 py-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} rounded-lg font-medium transition-colors`}
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debt History Modal */}
            {isDebtHistoryModalOpen && selectedClientForHistory && (() => {
                // Вычисляем текущий долг из истории
                const totalDebtFromHistory = getClientDebtHistory.filter(h => h.debtChange > 0).reduce((s, h) => s + h.debtChange, 0);
                const totalRepaidFromHistory = Math.abs(getClientDebtHistory.filter(h => h.debtChange < 0).reduce((s, h) => s + h.debtChange, 0));
                const currentDebtFromHistory = Math.max(0, totalDebtFromHistory - totalRepaidFromHistory);
                
                return (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`${t.bgCard} rounded-2xl w-full max-w-4xl border ${t.border} shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col`}>
                        <div className={`p-6 border-b ${t.border} flex justify-between items-center flex-shrink-0`}>
                            <div>
                                <h3 className={`text-xl font-bold ${t.text} flex items-center gap-2`}>
                                    <History size={22} className="text-indigo-500" />
                                    История долга: {selectedClientForHistory.companyName || selectedClientForHistory.name}
                                </h3>
                                <p className={`text-sm ${t.textMuted} mt-1`}>
                                    Полная история операций по долгу клиента
                                </p>
                            </div>
                            <div className="text-right mr-4">
                                <p className={`text-xs ${t.textMuted}`}>Текущий долг</p>
                                <p className={`text-2xl font-mono font-bold ${currentDebtFromHistory > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    ${currentDebtFromHistory.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button onClick={() => setIsDebtHistoryModalOpen(false)} className={`${t.textMuted} hover:${t.text}`}>
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {getClientDebtHistory.length === 0 ? (
                                <div className={`text-center py-12 ${t.textMuted}`}>
                                    <History size={48} className="mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">Нет записей по долгу</p>
                                    <p className="text-sm mt-2">
                                        Долг в карточке: <span className="text-red-500 font-bold">${(selectedClientForHistory.totalDebt || 0).toLocaleString()}</span>
                                    </p>
                                    <p className="text-xs mt-4 max-w-md mx-auto">
                                        Возможно долг был введён вручную или заказы оформлены на другое имя клиента.
                                        Проверьте имя клиента в заказах.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className={`${t.bg} sticky top-0`}>
                                        <tr className={`border-b ${t.border}`}>
                                            <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Дата</th>
                                            <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Операция</th>
                                            <th className={`px-3 py-3 text-left ${t.textMuted} font-medium`}>Описание</th>
                                            <th className={`px-3 py-3 text-center ${t.textMuted} font-medium`}>Способ оплаты</th>
                                            <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Сумма</th>
                                            <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Долг ±</th>
                                            <th className={`px-3 py-3 text-right ${t.textMuted} font-medium`}>Остаток</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${t.divide}`}>
                                        {getClientDebtHistory.map((item) => (
                                            <tr key={item.id} className={`hover:${t.bgHover} ${item.type === 'repayment' ? 'bg-emerald-500/5' : item.type === 'order' ? 'bg-red-500/5' : ''}`}>
                                                <td className={`px-3 py-3 ${t.textMuted} whitespace-nowrap`}>
                                                    <div>{new Date(item.date).toLocaleDateString('ru-RU')}</div>
                                                    {item.paymentDueDate && (
                                                        <div className="text-xs text-amber-500">
                                                            До: {new Date(item.paymentDueDate).toLocaleDateString('ru-RU')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        item.type === 'order' ? 'bg-red-500/20 text-red-500' :
                                                        item.type === 'repayment' ? 'bg-emerald-500/20 text-emerald-500' :
                                                        'bg-blue-500/20 text-blue-500'
                                                    }`}>
                                                        {item.type === 'order' ? '📦 Долг' : 
                                                         item.type === 'repayment' ? '✅ Оплачено' : 
                                                         '📋 Транзакция'}
                                                    </span>
                                                </td>
                                                <td className={`px-3 py-3 ${t.text}`}>
                                                    <div className="max-w-xs">
                                                        <div className="font-medium">
                                                            {item.reportNo 
                                                                ? `Отчёт №${item.reportNo}` 
                                                                : item.type === 'order' && item.description.includes('ORD-')
                                                                    ? `Заказ #${item.description.match(/ORD-[a-z0-9]+/i)?.[0]?.slice(-6) || item.id.slice(-6)}`
                                                                    : item.type === 'repayment'
                                                                        ? 'Погашение долга'
                                                                        : item.description
                                                            }
                                                        </div>
                                                        {item.items && item.items.length > 0 && (
                                                            <div className={`text-xs ${t.textMuted} mt-1`}>
                                                                {item.items.slice(0, 2).map((it, idx) => (
                                                                    <span key={idx}>{it.name} × {it.qty}{idx < Math.min(item.items!.length, 2) - 1 ? ', ' : ''}</span>
                                                                ))}
                                                                {item.items.length > 2 && <span> +{item.items.length - 2}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-3 py-3 text-center`}>
                                                    {item.type === 'repayment' ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                item.paymentMethod === 'cash' ? 'bg-green-500/20 text-green-500' :
                                                                item.paymentMethod === 'card' ? 'bg-blue-500/20 text-blue-500' :
                                                                item.paymentMethod === 'bank' ? 'bg-purple-500/20 text-purple-500' :
                                                                item.paymentMethod === 'mixed' ? 'bg-amber-500/20 text-amber-500' :
                                                                `${t.bgCard} ${t.textMuted}`
                                                            }`}>
                                                                {item.paymentMethod === 'cash' ? '💵 Наличные' :
                                                                 item.paymentMethod === 'card' ? '💳 Карта' :
                                                                 item.paymentMethod === 'bank' ? '🏦 Р/С (Банк)' :
                                                                 item.paymentMethod === 'mixed' ? '🔀 Микс' :
                                                                 '—'}
                                                            </span>
                                                            <span className={`text-xs ${t.textMuted}`}>
                                                                {item.currency === 'UZS' ? '🇺🇿 Сум' : '🇺🇸 USD'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className={`text-xs ${t.textMuted}`}>—</span>
                                                    )}
                                                </td>
                                                <td className={`px-3 py-3 text-right font-mono ${t.text}`}>
                                                    <div>
                                                        {item.currency === 'UZS' ? (
                                                            <>
                                                                <div>{item.totalAmount.toLocaleString()} сум</div>
                                                                {item.amountInUSD && (
                                                                    <div className={`text-xs ${t.textMuted}`}>
                                                                        ≈ ${item.amountInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div>${item.totalAmount.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-3 py-3 text-right font-mono font-bold ${item.debtChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {item.debtChange > 0 ? '+' : ''}${item.debtChange.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`px-3 py-3 text-right font-mono font-bold ${item.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    ${item.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div className={`p-4 border-t ${t.border} flex justify-between items-center ${t.bg}`}>
                            <div className={`text-sm ${t.textMuted}`}>
                                Записей: {getClientDebtHistory.length}
                                {getClientDebtHistory.length > 0 && (() => {
                                    // Сумма всех долгов (положительные debtChange) - это реальный остаток долга от заказов
                                    const totalDebtAdded = getClientDebtHistory.filter(h => h.debtChange > 0).reduce((s, h) => s + h.debtChange, 0);
                                    // Сумма всех погашений (отрицательные debtChange)
                                    const totalRepaid = Math.abs(getClientDebtHistory.filter(h => h.debtChange < 0).reduce((s, h) => s + h.debtChange, 0));
                                    // Текущий долг = сумма долгов минус погашения
                                    const calculatedDebt = Math.max(0, totalDebtAdded - totalRepaid);
                                    return (
                                        <>
                                            <span className="mx-2">|</span>
                                            Сумма долга: <span className={`font-mono ${t.text}`}>${totalDebtAdded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            <span className="mx-2">|</span>
                                            Погашено: <span className="text-emerald-500 font-mono">${totalRepaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            <span className="mx-2">|</span>
                                            Остаток долга: <span className={`font-mono font-bold ${calculatedDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>${calculatedDebt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                        </>
                                    );
                                })()}
                            </div>
                            <button
                                onClick={() => setIsDebtHistoryModalOpen(false)}
                                className={`px-6 py-2 ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${t.text} rounded-lg font-medium transition-colors`}
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};
