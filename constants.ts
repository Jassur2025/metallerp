
import { Product, ProductType, Unit, Order, Expense, Purchase } from './types';

export const DEFAULT_EXCHANGE_RATE = 12650; // 1 USD = 12650 UZS

export const SUPER_ADMIN_EMAILS = [
  'jasurmc@gmail.com', // Replace with your actual email
  'jassurgme@gmail.com', // Admin for phone format check
  'admin@example.com'
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Труба профильная 40x20',
    type: ProductType.PROFILE,
    dimensions: '40x20x2',
    steelGrade: 'Ст3сп',
    quantity: 1500,
    unit: Unit.METER,
    pricePerUnit: 1.50, // Selling Price USD
    costPrice: 1.10,    // Cost Price USD
    minStockLevel: 200
  },
  {
    id: '2',
    name: 'Труба круглая ВГП',
    type: ProductType.PIPE,
    dimensions: 'D50x3.5',
    steelGrade: 'Ст20',
    quantity: 300,
    unit: Unit.METER,
    pricePerUnit: 4.20, // Selling Price USD
    costPrice: 3.15,    // Cost Price USD
    minStockLevel: 100
  },
  {
    id: '3',
    name: 'Швеллер 10П',
    type: ProductType.BEAM,
    dimensions: '100',
    steelGrade: '09Г2С',
    quantity: 50,
    unit: Unit.METER,
    pricePerUnit: 14.50, // Selling Price USD
    costPrice: 10.80,    // Cost Price USD
    minStockLevel: 20
  },
  {
    id: '4',
    name: 'Арматура А500С',
    type: ProductType.OTHER,
    dimensions: 'D12',
    steelGrade: 'А500С',
    quantity: 5.5,
    unit: Unit.TON,
    pricePerUnit: 620.00, // Selling Price USD
    costPrice: 480.00,    // Cost Price USD
    minStockLevel: 1
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    customerName: 'ООО СтройМонтаж',
    sellerName: 'Менеджер А.',
    status: 'completed',
    subtotalAmount: 150.00,
    vatRateSnapshot: 12,
    vatAmount: 18.00,
    totalAmount: 168.00, // USD (150 + 18)
    exchangeRate: 12600,
    totalAmountUZS: 2116800, // 168 * 12600
    items: [
      {
        productId: '1',
        productName: 'Труба профильная 40x20',
        quantity: 100,
        priceAtSale: 1.50,
        costAtSale: 1.10,
        unit: Unit.METER,
        total: 150.00
      }
    ],
    paymentMethod: 'bank',
    paymentStatus: 'paid',
    amountPaid: 168.00
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'EXP-001',
    date: new Date(Date.now() - 86400000 * 5).toISOString(),
    category: 'Аренда',
    amount: 500.00,
    description: 'Аренда склада за Июнь',
    paymentMethod: 'cash',
    currency: 'USD'
  },
  {
    id: 'EXP-002',
    date: new Date(Date.now() - 86400000 * 1).toISOString(),
    category: 'Логистика',
    amount: 120.00,
    description: 'Доставка арматуры',
    paymentMethod: 'bank',
    currency: 'UZS'
  }
];

export const IS_DEV_MODE = true;

export const INITIAL_PURCHASES: Purchase[] = [];
