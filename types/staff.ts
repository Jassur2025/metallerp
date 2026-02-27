import { Versionable } from './common';

// Staff Management & RBAC
export type UserRole = 'admin' | 'manager' | 'accountant' | 'sales' | 'warehouse';

export interface Employee extends Versionable {
  id: string;
  name: string;
  email: string; // Gmail address
  phone?: string;
  position: string;
  role: UserRole;
  hireDate: string; // ISO date
  terminationDate?: string; // ISO date (if fired)
  salary?: number;
  commissionRate?: number; // % of profit for KPI
  hasKPI?: boolean; // Whether the employee has KPI based salary
  status: 'active' | 'inactive';
  notes?: string;
  permissions?: {
    dashboard?: boolean;
    inventory?: boolean;
    import?: boolean;
    sales?: boolean;
    workflow?: boolean;
    reports?: boolean;
    balance?: boolean;
    fixedAssets?: boolean;
    crm?: boolean;
    staff?: boolean;
    journal?: boolean;
    priceList?: boolean;
    // Granular permissions
    canViewCostPrice?: boolean;
    canProcessReturns?: boolean;
    canEditProducts?: boolean;
    canDeleteOrders?: boolean;
    canManageUsers?: boolean;
  };
}

export interface RolePermissions {
  role: UserRole;
  modules: {
    dashboard?: boolean;
    inventory?: boolean;
    import?: boolean;
    sales?: boolean;
    reports?: boolean;
    balance?: boolean;
    fixedAssets?: boolean;
    crm?: boolean;
    staff?: boolean;
    journal?: boolean;
    priceList?: boolean;
  };
  canEdit: boolean; // Can edit data or view only
}

// Journal Events - для отслеживания операций сотрудников и событий системы
export type JournalEventType =
  | 'employee_action'    // Действия сотрудников (создание заказа, изменение товара и т.д.)
  | 'receipt_operation'  // Операции с чеками (печать, отмена, редактирование)
  | 'system_event'       // Системные события (вход, выход, настройки)
  | 'data_change';       // Изменения данных (обновление товара, клиента и т.d.)

export interface JournalEvent {
  id: string;
  date: string;
  type: JournalEventType;

  // Информация о сотруднике
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;

  // Детали события
  action: string;        // Например: "Создан заказ", "Распечатан чек", "Изменен товар"
  description: string;   // Подробное описание
  module?: string;       // Модуль системы (sales, inventory, crm и т.д.)

  // Связанные данные
  relatedType?: 'order' | 'product' | 'client' | 'expense' | 'purchase' | 'transaction' | 'workflow';
  relatedId?: string;

  // Дополнительные данные (для чеков)
  receiptDetails?: {
    orderId: string;
    customerName: string;
    totalAmount: number;
    itemsCount: number;
    paymentMethod: string;
    operation: 'printed' | 'cancelled' | 'edited' | 'created';
  };

  // Метаданные
  metadata?: Record<string, unknown>;
}
