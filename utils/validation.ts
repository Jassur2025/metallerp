/**
 * Validation utilities for form inputs
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates email format
 */
export const validateEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number (basic validation)
 */
export const validatePhone = (phone: string | undefined): boolean => {
  // Remove spaces, dashes, parentheses, and leading +
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)+]/g, '');
  // Check if it contains only digits and is at least 9 characters
  return /^\d{9,15}$/.test(cleaned);
};

/**
 * Validates required field
 */
export const validateRequired = (value: string | number | undefined | null): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value) && isFinite(value);
  return false;
};

/**
 * Validates positive number
 */
export const validatePositiveNumber = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && isFinite(num) && num > 0;
};

/**
 * Validates non-negative number
 */
export const validateNonNegativeNumber = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && isFinite(num) && num >= 0;
};

/**
 * Validates client data
 */
export const validateClient = (client: {
  name?: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(client.name)) {
    errors.push('Имя обязательно для заполнения');
  }

  if (client.phone && !validatePhone(client.phone)) {
    errors.push('Некорректный формат телефона');
  }

  if (client.email && !validateEmail(client.email)) {
    errors.push('Некорректный формат email');
  }

  if (client.creditLimit !== undefined && !validateNonNegativeNumber(client.creditLimit)) {
    errors.push('Кредитный лимит должен быть неотрицательным числом');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates employee data
 */
export const validateEmployee = (employee: {
  name?: string;
  email?: string;
  position?: string;
  salary?: number;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(employee.name)) {
    errors.push('Имя обязательно для заполнения');
  }

  if (!validateRequired(employee.email)) {
    errors.push('Email обязателен для заполнения');
  } else if (!validateEmail(employee.email)) {
    errors.push('Некорректный формат email');
  }

  if (!validateRequired(employee.position)) {
    errors.push('Должность обязательна для заполнения');
  }

  if (employee.salary !== undefined && !validateNonNegativeNumber(employee.salary)) {
    errors.push('Зарплата должна быть неотрицательным числом');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates product data
 */
export const validateProduct = (product: {
  name?: string;
  quantity?: number;
  pricePerUnit?: number;
  costPrice?: number;
  minStockLevel?: number;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(product.name)) {
    errors.push('Название товара обязательно для заполнения');
  }

  if (product.quantity !== undefined && !validateNonNegativeNumber(product.quantity)) {
    errors.push('Количество должно быть неотрицательным числом');
  }

  if (product.pricePerUnit !== undefined && !validateNonNegativeNumber(product.pricePerUnit)) {
    errors.push('Цена продажи должна быть неотрицательным числом');
  }

  if (product.costPrice !== undefined && !validateNonNegativeNumber(product.costPrice)) {
    errors.push('Себестоимость должна быть неотрицательным числом');
  }

  if (product.minStockLevel !== undefined && !validateNonNegativeNumber(product.minStockLevel)) {
    errors.push('Минимальный остаток должен быть неотрицательным числом');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ---------------------------------------------------------
// Financial Entity Validators
// ---------------------------------------------------------

const VALID_ORDER_STATUSES = ['pending', 'completed', 'cancelled'] as const;
const VALID_PAYMENT_METHODS = ['cash', 'bank', 'card', 'debt', 'mixed'] as const;
const VALID_PAYMENT_STATUSES = ['paid', 'unpaid', 'partial'] as const;
const VALID_CURRENCIES = ['USD', 'UZS'] as const;
const VALID_TRANSACTION_TYPES = ['client_payment', 'supplier_payment', 'client_return', 'debt_obligation', 'client_refund', 'expense'] as const;
const VALID_TRANSACTION_METHODS = ['cash', 'bank', 'card', 'debt'] as const;
const VALID_EXPENSE_CATEGORIES = ['administrative', 'operational', 'commercial'] as const;
const VALID_WORKFLOW_STATUSES = ['draft', 'confirmed', 'sent_to_cash', 'sent_to_procurement', 'completed', 'cancelled'] as const;

/**
 * Validates order data before submission
 */
export const validateOrder = (order: {
  customerName?: string;
  items?: Array<{ productId?: string; quantity?: number; priceAtSale?: number }>;
  totalAmount?: number;
  exchangeRate?: number;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(order.customerName)) {
    errors.push('Имя клиента обязательно');
  }

  if (!order.items || order.items.length === 0) {
    errors.push('Заказ должен содержать хотя бы один товар');
  } else {
    order.items.forEach((item, i) => {
      if (!item.productId) errors.push(`Товар ${i + 1}: не указан ID продукта`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Товар ${i + 1}: количество должно быть > 0`);
      if (item.priceAtSale !== undefined && item.priceAtSale < 0) errors.push(`Товар ${i + 1}: цена не может быть отрицательной`);
    });
  }

  if (!order.totalAmount || !validatePositiveNumber(order.totalAmount)) {
    errors.push('Общая сумма заказа должна быть > 0');
  }

  if (!order.exchangeRate || !validatePositiveNumber(order.exchangeRate)) {
    errors.push('Курс обмена должен быть > 0');
  }

  if (order.status && !VALID_ORDER_STATUSES.includes(order.status as typeof VALID_ORDER_STATUSES[number])) {
    errors.push(`Недопустимый статус заказа: ${order.status}`);
  }

  if (order.paymentMethod && !VALID_PAYMENT_METHODS.includes(order.paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
    errors.push(`Недопустимый метод оплаты: ${order.paymentMethod}`);
  }

  if (order.paymentStatus && !VALID_PAYMENT_STATUSES.includes(order.paymentStatus as typeof VALID_PAYMENT_STATUSES[number])) {
    errors.push(`Недопустимый статус оплаты: ${order.paymentStatus}`);
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validates transaction data before submission
 */
export const validateTransaction = (tx: {
  amount?: number;
  type?: string;
  currency?: string;
  method?: string;
  date?: string;
  description?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!tx.amount || !validatePositiveNumber(tx.amount)) {
    errors.push('Сумма транзакции должна быть > 0');
  }

  if (!tx.type || !VALID_TRANSACTION_TYPES.includes(tx.type as typeof VALID_TRANSACTION_TYPES[number])) {
    errors.push(`Недопустимый тип транзакции: ${tx.type || 'не указан'}`);
  }

  if (!tx.currency || !VALID_CURRENCIES.includes(tx.currency as typeof VALID_CURRENCIES[number])) {
    errors.push(`Недопустимая валюта: ${tx.currency || 'не указана'}`);
  }

  if (!tx.method || !VALID_TRANSACTION_METHODS.includes(tx.method as typeof VALID_TRANSACTION_METHODS[number])) {
    errors.push(`Недопустимый метод: ${tx.method || 'не указан'}`);
  }

  if (!validateRequired(tx.date)) {
    errors.push('Дата обязательна');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validates expense data before submission
 */
export const validateExpense = (expense: {
  amount?: number;
  description?: string;
  category?: string;
  paymentMethod?: string;
  currency?: string;
  date?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!expense.amount || !validatePositiveNumber(expense.amount)) {
    errors.push('Сумма расхода должна быть > 0');
  }

  if (!validateRequired(expense.description)) {
    errors.push('Описание расхода обязательно');
  }

  if (!validateRequired(expense.category)) {
    errors.push('Категория расхода обязательна');
  }

  if (expense.paymentMethod && !VALID_TRANSACTION_METHODS.includes(expense.paymentMethod as typeof VALID_TRANSACTION_METHODS[number])) {
    errors.push(`Недопустимый метод оплаты: ${expense.paymentMethod}`);
  }

  if (expense.currency && !VALID_CURRENCIES.includes(expense.currency as typeof VALID_CURRENCIES[number])) {
    errors.push(`Недопустимая валюта: ${expense.currency}`);
  }

  if (!validateRequired(expense.date)) {
    errors.push('Дата обязательна');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validates purchase data before submission
 */
export const validatePurchase = (purchase: {
  supplierName?: string;
  items?: Array<{ productId?: string; quantity?: number; pricePerUnit?: number }>;
  exchangeRate?: number;
  paymentMethod?: string;
  date?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(purchase.supplierName)) {
    errors.push('Имя поставщика обязательно');
  }

  if (!purchase.items || purchase.items.length === 0) {
    errors.push('Закупка должна содержать хотя бы один товар');
  } else {
    purchase.items.forEach((item, i) => {
      if (!item.productId) errors.push(`Товар ${i + 1}: не указан ID продукта`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Товар ${i + 1}: количество должно быть > 0`);
      if (item.pricePerUnit !== undefined && item.pricePerUnit < 0) errors.push(`Товар ${i + 1}: цена не может быть отрицательной`);
    });
  }

  if (!purchase.exchangeRate || !validatePositiveNumber(purchase.exchangeRate)) {
    errors.push('Курс обмена должен быть > 0');
  }

  if (purchase.paymentMethod && !VALID_PAYMENT_METHODS.includes(purchase.paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
    errors.push(`Недопустимый метод оплаты: ${purchase.paymentMethod}`);
  }

  if (!validateRequired(purchase.date)) {
    errors.push('Дата обязательна');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validates workflow order data
 */
export const validateWorkflowOrder = (order: {
  customerName?: string;
  items?: Array<{ productId?: string; quantity?: number }>;
  totalAmount?: number;
  status?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateRequired(order.customerName)) {
    errors.push('Имя клиента обязательно');
  }

  if (!order.items || order.items.length === 0) {
    errors.push('Заказ должен содержать хотя бы один товар');
  }

  if (!order.totalAmount || !validatePositiveNumber(order.totalAmount)) {
    errors.push('Сумма должна быть > 0');
  }

  if (order.status && !VALID_WORKFLOW_STATUSES.includes(order.status as typeof VALID_WORKFLOW_STATUSES[number])) {
    errors.push(`Недопустимый статус: ${order.status}`);
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Sanitizes a string by trimming whitespace and removing potentially dangerous characters
 */
export const sanitizeString = (value: string): string => {
  return value.trim().replace(/[<>]/g, '');
};

/**
 * Sanitizes a numeric input, returning NaN if invalid
 */
export const sanitizeNumber = (value: string | number): number => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.\-]/g, '')) : value;
  return isFinite(num) ? num : NaN;
};




