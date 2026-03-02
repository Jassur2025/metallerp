import { Versionable } from './common';

export enum FixedAssetCategory {
  BUILDING = 'Здания', // 5%
  STRUCTURE = 'Сооружения', // 5%
  MACHINERY = 'Машины и оборудование', // 15-20% (avg 15%)
  VEHICLE = 'Транспорт', // 15%
  COMPUTER = 'Компьютеры', // 20%
  OFFICE_EQUIPMENT = 'Принтеры / оргтехника', // 20%
  FURNITURE = 'Мебель', // 10%
  INVENTORY = 'Хозяйственный инвентарь', // 10%
  APPLIANCES = 'Бытовая техника', // 15%
  SPECIAL_EQUIPMENT = 'Спецоборудование', // 20%
  LAND = 'Земля' // 0%
}

export interface FixedAsset extends Versionable {
  id: string;
  name: string;
  category: FixedAssetCategory;
  purchaseDate: string;
  purchaseCost: number; // USD
  currentValue: number; // USD (Book Value)
  accumulatedDepreciation: number; // USD
  depreciationRate: number; // Annual %
  lastDepreciationDate?: string;
  paymentMethod?: 'cash' | 'bank' | 'card'; // Способ оплаты
  paymentCurrency?: 'USD' | 'UZS'; // Валюта оплаты (для наличных)
  amountPaid?: number; // USD - сумма оплачено (для частичной оплаты)
  // _version and updatedAt inherited from Versionable
}

// ═══ Balance Data (computed and cached in Firestore) ═══

export interface BalanceData {
  // Assets (Активы)
  inventoryValue: number;
  inventoryByWarehouse: { main: number; cloud: number };
  cashUSD: number;         // Net cash in USD
  cashUZS: number;         // Net cash in UZS
  bankUZS: number;         // Net bank balance in UZS
  cardUZS: number;         // Net card balance in UZS
  totalCashUSD: number;    // Cash converted to USD
  netBankUSD: number;      // Bank converted to USD
  netCardUSD: number;      // Card converted to USD
  totalLiquidAssets: number;
  fixedAssetsValue: number;
  accountsReceivable: number;
  totalAssets: number;

  // Passives (Пассивы)
  vatOutput: number;
  vatInput: number;
  vatLiability: number;
  accountsPayable: number;
  fixedAssetsPayable: number;
  equity: number;
  fixedAssetsFund: number;
  retainedEarnings: number;
  totalPassives: number;

  // P&L summary
  revenue: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  totalDepreciation: number;
  netProfit: number;

  // Corrections from validateUSD
  corrections: Array<{
    id: string;
    type: 'order' | 'transaction' | 'expense';
    originalAmount: number;
    correctedAmount: number;
    reason: string;
  }>;

  // Meta
  exchangeRate: number;
  computedAt: string; // ISO date
}
