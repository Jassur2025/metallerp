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
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number (basic validation)
 */
export const validatePhone = (phone: string): boolean => {
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
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

  if (!validateRequired(client.phone)) {
    errors.push('Телефон обязателен для заполнения');
  } else if (!validatePhone(client.phone)) {
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
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};


