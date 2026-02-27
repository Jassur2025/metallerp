
import { Product, ProductType, Unit, Order, Expense, Purchase, AppSettings } from './types';

export const DEFAULT_EXCHANGE_RATE = 12800; // 1 USD = 12800 UZS (fallback rate)

export const SUPER_ADMIN_EMAILS = [
  'jasurmc@gmail.com',
  'jassurgme@gmail.com',
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

export const IS_DEV_MODE = import.meta.env.DEV;

export const INITIAL_PURCHASES: Purchase[] = [];
// Default Expense Categories for PnL
export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'rent', name: 'Аренда земельных участков, зданий и сооружений', pnlCategory: 'administrative' as const },
  { id: 'special_equipment', name: 'Аренда специальной техники', pnlCategory: 'operational' as const },
  { id: 'bank_fees', name: 'Банковские комиссии', pnlCategory: 'administrative' as const },
  { id: 'sales_bonus', name: 'Бонусы от продаж', pnlCategory: 'commercial' as const },
  { id: 'customs', name: 'Государственные пошлины', pnlCategory: 'administrative' as const },
  { id: 'salary', name: 'Зарплата', pnlCategory: 'administrative' as const },
  { id: 'advance', name: 'Аванс сотрудникам', pnlCategory: 'administrative' as const },
  { id: 'crane_costs', name: 'Затраты крана', pnlCategory: 'operational' as const },
  { id: 'food', name: 'Затраты питания', pnlCategory: 'operational' as const },
  { id: 'corporate_events', name: 'Затраты по корпоративно-культурным мероприятиям', pnlCategory: 'operational' as const },
  { id: 'office_supplies', name: 'Канцелярские затраты', pnlCategory: 'administrative' as const },
  { id: 'business_trips', name: 'Командировки и встречи', pnlCategory: 'administrative' as const },
  { id: 'utilities', name: 'Коммунальные затраты', pnlCategory: 'administrative' as const },
  { id: 'training', name: 'Корпоративное обучение', pnlCategory: 'administrative' as const },
  { id: 'corporate_gifts', name: 'Корпоративные подарки', pnlCategory: 'administrative' as const },
  { id: 'courier_fuel', name: 'Курьерские\\ГСМ затраты', pnlCategory: 'administrative' as const },
  { id: 'marketing', name: 'Маркетинг и реклама', pnlCategory: 'commercial' as const },
  { id: 'loading', name: 'Погрузочные затраты', pnlCategory: 'commercial' as const },
  { id: 'postal', name: 'Почтовые затраты', pnlCategory: 'administrative' as const },
  { id: 'bonus', name: 'Премии', pnlCategory: 'commercial' as const },
  { id: 'professional_services', name: 'Профессиональные услуги', pnlCategory: 'administrative' as const },
  { id: 'other_services', name: 'Прочие услуги', pnlCategory: 'administrative' as const },
  { id: 'metal_services', name: 'Прочие услуги по металл сервису', pnlCategory: 'operational' as const },
  { id: 'materials', name: 'Расходные материалы для обработки металла', pnlCategory: 'operational' as const },
  { id: 'overtime', name: 'Сверхурочная работа', pnlCategory: 'operational' as const },
  { id: 'internet', name: 'Связь и интернет', pnlCategory: 'administrative' as const },
  { id: 'social', name: 'Социальная политика', pnlCategory: 'administrative' as const },
  { id: 'construction', name: 'Строительные затраты', pnlCategory: 'operational' as const },
  { id: 'telecom_it', name: 'Телекоммуникации и ИТ', pnlCategory: 'administrative' as const },
  { id: 'os_maintenance', name: 'Техническое обслуживание ОС', pnlCategory: 'administrative' as const },
  { id: 'transport_purchases', name: 'Транспортные услуги при закупках', pnlCategory: 'operational' as const },
  { id: 'crane_services', name: 'Услуги крана при закупках', pnlCategory: 'operational' as const },
  { id: 'insurance', name: 'Услуги страхования', pnlCategory: 'commercial' as const },
  { id: 'household', name: 'Хозяйственные затраты', pnlCategory: 'administrative' as const },
];

// Default Settings
export const defaultSettings: AppSettings = {
  vatRate: 12,
  defaultExchangeRate: DEFAULT_EXCHANGE_RATE,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  nextReportNo: 1,
  modules: {
    dashboard: true,
    inventory: true,
    import: true,
    sales: true,
    workflow: true,
    reports: true,
    balance: true,
    fixedAssets: true,
    crm: true,
    staff: true,
    journal: true,
    priceList: true
  }
};