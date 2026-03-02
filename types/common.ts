
/**
 * Base interface for optimistic concurrency control
 * All entities should extend this to support version tracking
 */
export interface Versionable {
  /** Version number for optimistic concurrency control. Increments on each update. */
  _version?: number;
  /** ISO timestamp of last update */
  updatedAt?: string;
}

export enum ProductType {
  PIPE = 'Труба',
  PROFILE = 'Профиль',
  SHEET = 'Лист',
  BEAM = 'Балка',
  OTHER = 'Прочее'
}

// Типы складов
export enum WarehouseType {
  MAIN = 'main',      // Основной склад
  CLOUD = 'cloud'     // Облачный склад
}

export const WarehouseLabels: Record<WarehouseType, string> = {
  [WarehouseType.MAIN]: 'Основной склад',
  [WarehouseType.CLOUD]: 'Облачный склад'
};

export enum Unit {
  METER = 'м',
  TON = 'т',
  PIECE = 'шт'
}

export type ExpensePnLCategory = 'administrative' | 'operational' | 'commercial';

export interface ExpenseCategory {
  id: string;
  name: string;
  pnlCategory: ExpensePnLCategory;
}

export interface CompanyDetails {
  name: string;
  address: string;
  phone: string;
  inn: string;
  mfo: string;
  bankName: string;
  accountNumber: string;
  director?: string;
  accountant?: string;
  website?: string;
}

export interface ExchangeRateEntry {
  rate: number;
  date: string; // ISO string
  changedBy?: string; // email of user who changed it
}

export interface AppSettings {
  vatRate: number; // Percentage (e.g. 12)
  defaultExchangeRate: number;
  exchangeRateHistory?: ExchangeRateEntry[]; // History of rate changes
  theme?: 'light' | 'dark'; // UI theme
  companyDetails?: CompanyDetails; // Added company details for documents
  expenseCategories?: ExpenseCategory[];
  manufacturers?: string[]; // Список производителей
  nextReportNo?: number; // Counter for report numbers
  modules?: {
    dashboard: boolean;
    inventory: boolean;
    import: boolean;
    sales: boolean;
    workflow: boolean;
    reports: boolean;
    balance: boolean;
    fixedAssets: boolean;
    crm: boolean;
    staff: boolean;
    journal: boolean;
    priceList: boolean;
  };
}
