
import { Product, Order, AppSettings, Expense, Purchase } from '../types';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, DEFAULT_EXCHANGE_RATE, INITIAL_EXPENSES, INITIAL_PURCHASES } from '../constants';

const PRODUCTS_KEY = 'metal_erp_products';
const ORDERS_KEY = 'metal_erp_orders';
const SETTINGS_KEY = 'metal_erp_settings';
const EXPENSES_KEY = 'metal_erp_expenses';
const PURCHASES_KEY = 'metal_erp_purchases';

const DEFAULT_SETTINGS: AppSettings = {
  vatRate: 12, // 12% VAT
  defaultExchangeRate: DEFAULT_EXCHANGE_RATE
};

export const storageService = {
  getProducts: (): Product[] => {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (!stored) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(stored);
  },

  saveProducts: (products: Product[]) => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  getOrders: (): Order[] => {
    const stored = localStorage.getItem(ORDERS_KEY);
    if (!stored) {
      return INITIAL_ORDERS;
    }
    return JSON.parse(stored);
  },

  saveOrders: (orders: Order[]) => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  },

  getExpenses: (): Expense[] => {
      const stored = localStorage.getItem(EXPENSES_KEY);
      if (!stored) {
          return INITIAL_EXPENSES;
      }
      return JSON.parse(stored);
  },

  saveExpenses: (expenses: Expense[]) => {
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  },

  getPurchases: (): Purchase[] => {
      const stored = localStorage.getItem(PURCHASES_KEY);
      if (!stored) {
          return INITIAL_PURCHASES;
      }
      return JSON.parse(stored);
  },

  savePurchases: (purchases: Purchase[]) => {
      localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
  },

  getSettings: (): AppSettings => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
    }
    return JSON.parse(stored);
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
  
  reset: () => {
      localStorage.removeItem(PRODUCTS_KEY);
      localStorage.removeItem(ORDERS_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(EXPENSES_KEY);
      localStorage.removeItem(PURCHASES_KEY);
  }
};
