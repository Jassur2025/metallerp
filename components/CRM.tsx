import React, { useState, useMemo } from 'react';
import { Client, Order, Transaction } from '../types';
import { User } from 'firebase/auth';
import { useToast } from '../contexts/ToastContext';
import { useTheme, getThemeClasses } from '../contexts/ThemeContext';
import { Plus, Search, Phone, Mail, MapPin, Edit, Trash2, DollarSign, Wallet, History, ArrowDownLeft, CheckCircle, XCircle, AlertCircle, Smartphone, MessageSquare } from 'lucide-react';
import { checkAllPhones } from '../utils/phoneFormatter';
import { SUPER_ADMIN_EMAILS } from '../constants';
import { IdGenerator } from '../utils/idGenerator';
import { useClients } from '../hooks/useClients';
import { useOrders } from '../hooks/useOrders';
import { transactionService } from '../services/transactionService';
import { ClientNotesModal } from './Sales/ClientNotesModal';
import { ClientCard } from './CRM/ClientCard';
import { RepaymentStatsView } from './CRM/RepaymentStatsView';
import { DebtHistoryModal } from './CRM/DebtHistoryModal';
import type { HistoryItem } from './CRM/DebtHistoryModal';

interface CRMProps {
    clients: Client[]; // Legacy prop (ignored - using Firebase)
    onSave: (clients: Client[]) => void; // Legacy
    orders: Order[]; // Legacy prop (ignored - using Firebase)
    onSaveOrders?: (orders: Order[]) => void;
    transactions: Transaction[];
    setTransactions: (t: Transaction[]) => void;
    onSaveTransactions?: (transactions: Transaction[]) => Promise<boolean | void>;
    currentUser?: User | null;
}

type CRMView = 'clients' | 'repaymentStats';

// HistoryItem type imported from ./CRM/DebtHistoryModal

export const CRM: React.FC<CRMProps> = ({ clients: legacyClients, onSave, orders: legacyOrders, onSaveOrders, transactions, setTransactions, onSaveTransactions, currentUser }) => {
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
        deleteClient,
        migrateClients: migrateFromSheets 
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

    // Initial Migration Check (One-time, simplistic)
    React.useEffect(() => {
        if (!clientsLoading && clients.length === 0 && legacyClients && legacyClients.length > 0) {
           // Optional: Silent auto-migration or just ignore. 
           // User asked to remove migration button, so we won't nag.
           // However, if the user explicitly wants to restore data, we can invoke migrateFromSheets(legacyClients)
           // For now, we assume we start fresh or manual entry, unless requested.
        }
    }, [clientsLoading, clients.length, legacyClients]);

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

    // Строгое сопоставление заказа с клиентом: по clientId, затем точное совпадение имени
    const orderMatchesClient = (order: Order, client: Client): boolean => {
        // 1. По clientId — самый надёжный способ
        if (order.clientId && order.clientId === client.id) return true;
        // 2. Точное совпадение имени (не includes!) — для legacy заказов без clientId
        const orderName = (order.customerName || '').toLowerCase().trim();
        const clientName = (client.name || '').toLowerCase().trim();
        if (clientName && orderName === clientName) return true;
        // 3. Точное совпадение с названием компании
        const companyName = (client.companyName || '').toLowerCase().trim();
        if (companyName && orderName === companyName) return true;
        return false;
    };

    // Строгое сопоставление транзакции с клиентом: по relatedId = clientId или relatedId = orderId клиента
    const txMatchesClient = (tx: Transaction, clientId: string, clientOrderIds: string[]): boolean => {
        // 1. relatedId === clientId
        if (tx.relatedId === clientId) return true;
        // 2. relatedId === один из заказов клиента
        if (tx.relatedId && clientOrderIds.includes(tx.relatedId)) return true;
        return false;
    };

    // Функция для расчёта общей суммы покупок клиента
    const calculateClientPurchases = (client: Client): number => {
        let totalPurchases = 0;
        orders.forEach(order => {
            if (orderMatchesClient(order, client)) {
                totalPurchases += order.totalAmount || 0;
            }
        });
        return totalPurchases;
    };

    // Функция для расчёта актуального долга клиента из заказов и транзакций
    // Единый источник правды: долг = сумма заказов в долг − сумма client_payment транзакций (только по долговым заказам)
    const calculateClientDebt = (client: Client): number => {
        const clientId = client.id;
        
        let totalDebt = 0;
        let totalRepaid = 0;
        
        // 1. Найти ВСЕ заказы клиента которые БЫЛИ в долг — берём ПОЛНУЮ сумму заказа
        const debtOrderIds = new Set<string>();
        orders.forEach(order => {
            if (!orderMatchesClient(order, client)) return;
            
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial';
            
            if (wasDebtOrder) {
                totalDebt += (order.totalAmount || 0);
                debtOrderIds.add(order.id);
            }
        });
        
        // 2. Найти транзакции погашений — только РЕАЛЬНЫЕ погашения долга
        // Проблема: ВСЕ client_payment транзакции из Sales имеют relatedId = clientId,
        // включая оплаты обычных cash/card/bank заказов. Нужно отфильтровать их.
        transactions.forEach(tx => {
            if (tx.type !== 'client_payment') return;
            
            // a) relatedId = ID долгового заказа — точное совпадение
            const isDebtOrderPayment = tx.relatedId ? debtOrderIds.has(tx.relatedId) : false;
            
            // b) relatedId = clientId — может быть как погашение долга, так и оплата обычного заказа
            //    Проверяем описание: если есть ID заказа — проверяем, долговой ли он
            let isDirectDebtRepayment = false;
            if (tx.relatedId === clientId) {
                const orderIdInDesc = tx.description?.match(/заказа\s+(\S+)/i);
                if (orderIdInDesc) {
                    // Транзакция привязана к конкретному заказу — считаем только если заказ долговой
                    const orderId = orderIdInDesc[1].replace(/\s*\(.*$/, ''); // убрать "(Workflow)" и т.п.
                    isDirectDebtRepayment = debtOrderIds.has(orderId);
                } else {
                    // Нет ID заказа в описании — это прямое погашение долга (из CRM)
                    isDirectDebtRepayment = true;
                }
            }
            
            if (!isDirectDebtRepayment && !isDebtOrderPayment) return;
            
            let amountInUSD = tx.amount || 0;
            if (tx.currency === 'UZS' && tx.exchangeRate) {
                amountInUSD = (tx.amount || 0) / tx.exchangeRate;
            }
            totalRepaid += amountInUSD;
        });
        
        return Math.max(0, totalDebt - totalRepaid);
    };
    
    const getUnpaidOrdersForClient = useMemo(() => {
        if (!selectedClientForRepayment) return [];
        
        const clientId = selectedClientForRepayment.id;
        
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

        // Хелпер: конвертация суммы транзакции в USD
        const txToUSD = (tx: Transaction): number => {
            if (tx.currency === 'UZS' && tx.exchangeRate) {
                return (tx.amount || 0) / tx.exchangeRate;
            }
            return tx.amount || 0;
        };

        // Хелпер: собрать PaymentRecord из транзакции
        const toPaymentRecord = (r: Transaction): PaymentRecord => ({
            date: r.date,
            amount: r.amount || 0,
            amountUSD: txToUSD(r),
            currency: r.currency || 'USD',
            method: r.method || 'cash'
        });
        
        // 1. Найти заказы в долг (строгое сопоставление)
        orders.forEach(order => {
            if (!orderMatchesClient(order, selectedClientForRepayment)) return;
            
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial';
            
            if (!wasDebtOrder) return;

            // Погашения привязанные к этому заказу (по relatedId)
            const repayments = transactions.filter(t =>
                t.type === 'client_payment' && t.relatedId === order.id
            );
            
            const payments: PaymentRecord[] = repayments.map(toPaymentRecord);
            
            let totalRepaidUSD = 0;
            repayments.forEach(r => { totalRepaidUSD += txToUSD(r); });
            
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
        });
        
        // 2. Проверить транзакции debt_obligation для этого клиента
        transactions.forEach(tx => {
            if (tx.type !== 'debt_obligation') return;
            if (tx.relatedId !== clientId) return;
            
            // Проверить не добавлен ли уже этот заказ
            const existingOrder = unpaidOrders.find(o => o.id === tx.id);
            if (existingOrder) return;

            // Погашения по этому обязательству
            const repayments = transactions.filter(t =>
                t.type === 'client_payment' && t.relatedId === tx.id
            );
            
            const payments: PaymentRecord[] = repayments.map(toPaymentRecord);
            let totalRepaidUSD = 0;
            repayments.forEach(r => { totalRepaidUSD += txToUSD(r); });
            
            const debtAmount = (tx.amount || 0) - totalRepaidUSD;
            if (debtAmount > 0.01) {
                unpaidOrders.push({
                    id: tx.id,
                    date: tx.date,
                    totalAmount: tx.amount || 0,
                    amountPaid: totalRepaidUSD,
                    debtAmount,
                    items: tx.description || '',
                    payments
                });
            }
        });
        
        // 3. Сортировать по дате (FIFO)
        unpaidOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // 4. Найти погашения клиента БЕЗ привязки к конкретному заказу (relatedId = clientId)
        const orderIdsSet = new Set(unpaidOrders.map(o => o.id));
        const clientPaymentsWithoutOrder = transactions.filter(t =>
            t.type === 'client_payment' &&
            t.relatedId === clientId &&
            !orderIdsSet.has(t.relatedId)
        );
        
        // 5. Распределяем неразмеченные погашения по заказам (FIFO)
        let unallocatedPaymentsUSD = 0;
        clientPaymentsWithoutOrder.forEach(t => { unallocatedPaymentsUSD += txToUSD(t); });
        
        if (unallocatedPaymentsUSD > 0) {
            for (const order of unpaidOrders) {
                if (unallocatedPaymentsUSD <= 0) break;
                const canPay = Math.min(unallocatedPaymentsUSD, order.debtAmount);
                order.amountPaid += canPay;
                order.debtAmount -= canPay;
                unallocatedPaymentsUSD -= canPay;
            }
        }
        
        // 6. Убираем полностью оплаченные
        const stillUnpaid = unpaidOrders.filter(o => o.debtAmount > 0.01);
        
        // 7. Fallback: если заказы не нашлись, но по расчёту есть долг
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

    const handleOpenNotesModal = (client: Client) => {
        setSelectedClientForNotes(client);
        setIsNotesModalOpen(true);
    };

    // Получить полную историю долгов клиента - заказы в долг + транзакции
    const getClientDebtHistory = useMemo(() => {
        if (!selectedClientForHistory) return [] as HistoryItem[];
        
        const clientId = selectedClientForHistory.id;
        const allHistory: HistoryItem[] = [];
        
        // 1. Найти все заказы в долг (строгое сопоставление)
        orders.forEach(order => {
            if (!orderMatchesClient(order, selectedClientForHistory)) return;
            
            const wasDebtOrder = order.paymentMethod === 'debt' || 
                                 order.paymentStatus === 'unpaid' || 
                                 order.paymentStatus === 'partial';
            
            if (!wasDebtOrder) return;

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
                amountPaid: 0,
                debtChange: order.totalAmount || 0,
                balance: 0,
                reportNo: order.reportNo,
                paymentDueDate: order.paymentDueDate
            });
        });
        
        // 2. Собираем ID долговых заказов клиента (только debt/partial/unpaid)
        const debtOrderIds = new Set<string>();
        orders.forEach(order => {
            if (!orderMatchesClient(order, selectedClientForHistory)) return;
            const wasDebt = order.paymentMethod === 'debt' || order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial';
            if (wasDebt) debtOrderIds.add(order.id);
        });
        
        // 3. Найти транзакции связанные с долгом клиента
        transactions.forEach(tx => {
            if (tx.type !== 'client_payment' && tx.type !== 'debt_obligation') return;
            
            // Для debt_obligation: стандартная проверка по relatedId
            const isDebtRelatedBasic = tx.relatedId === clientId || (tx.relatedId ? debtOrderIds.has(tx.relatedId) : false);
            if (tx.type === 'debt_obligation' && !isDebtRelatedBasic) return;
            
            // Для client_payment: строгая фильтрация — только РЕАЛЬНЫЕ погашения долга
            if (tx.type === 'client_payment') {
                const isDebtOrderPayment = tx.relatedId ? debtOrderIds.has(tx.relatedId) : false;
                let isDirectDebtRepayment = false;
                if (tx.relatedId === clientId) {
                    const orderIdInDesc = tx.description?.match(/заказа\s+(\S+)/i);
                    if (orderIdInDesc) {
                        // Привязана к заказу — считаем только если заказ долговой
                        const orderId = orderIdInDesc[1].replace(/\s*\(.*$/, '');
                        isDirectDebtRepayment = debtOrderIds.has(orderId);
                    } else {
                        // Нет ID заказа — прямое погашение долга (из CRM)
                        isDirectDebtRepayment = true;
                    }
                }
                if (!isDirectDebtRepayment && !isDebtOrderPayment) return;
            }
            
            // Долг по обязательству
            if (tx.type === 'debt_obligation') {
                // Проверяем дубликаты: debt_obligation дублирует заказ
                // 1. Извлекаем ID заказа из описания "Долг по заказу ORDER_ID"
                const descOrderMatch = tx.description?.match(/заказу?\s+(\S+)/i);
                const mentionedOrderId = descOrderMatch ? descOrderMatch[1] : null;
                
                // 2. Проверяем: если упомянутый заказ существует в массиве orders — это дубликат
                const orderExistsInDB = mentionedOrderId 
                    ? orders.some(o => o.id === mentionedOrderId)
                    : false;
                
                // 3. Также проверяем по relatedId и по уже добавленным записям
                const alreadyInHistory = allHistory.some(h => 
                    h.id === tx.id || 
                    (tx.relatedId && h.id === tx.relatedId && h.type === 'order') ||
                    (mentionedOrderId && h.id === mentionedOrderId && h.type === 'order')
                );
                
                if (orderExistsInDB || alreadyInHistory) return;
                
                // Только для обязательств БЕЗ соответствующего заказа (начальный долг и т.п.)
                allHistory.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'order',
                    description: tx.description || 'Начальный долг / Обязательство',
                    totalAmount: tx.amount || 0,
                    amountPaid: 0,
                    debtChange: tx.amount || 0,
                    balance: 0,
                });
            }
            // FIX #7: Все client_payment считаются погашениями (убран фильтр по слову "погашение")
            else if (tx.type === 'client_payment') {
                let amountInUSD = tx.amount || 0;
                if (tx.currency === 'UZS' && tx.exchangeRate) {
                    amountInUSD = (tx.amount || 0) / tx.exchangeRate;
                }
                
                allHistory.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'repayment',
                    description: tx.description || 'Погашение долга',
                    totalAmount: tx.amount || 0,
                    amountPaid: tx.amount || 0,
                    debtChange: -amountInUSD,
                    balance: 0,
                    paymentMethod: tx.method,
                    currency: tx.currency || 'USD',
                    exchangeRate: tx.exchangeRate,
                    amountInUSD
                });
            }
        });
        
        // 4. Сортировать по дате
        allHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // 5. Рассчитать баланс (накопительный долг)
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

        } catch (error: any) {
            console.error('Payment error:', error);
            toast.error('Ошибка при проведении платежа: ' + error.message);
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
                    </div>

                    {/* Clients Grid */}
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
                                                ${Math.max(0, calculateClientDebt(selectedClientForRepayment) - ((mixCashUZS / exchangeRate) + mixCashUSD + (mixCard / exchangeRate) + (mixBank / exchangeRate))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                                                ${Math.max(0, calculateClientDebt(selectedClientForRepayment) - (repaymentCurrency === 'UZS' && exchangeRate > 0 ? (repaymentAmount / exchangeRate) : repaymentAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
