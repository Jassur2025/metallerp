/**
 * Phone number formatting and validation utilities
 * For Uzbekistan phone numbers (UZ format)
 */

/**
 * Cleans phone number - removes all non-digit characters
 */
export const cleanPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Formats phone number for tablet/mobile display
 * Uzbekistan format: +998 XX XXX XX XX
 */
export const formatPhoneForTablet = (phone: string): string => {
  const cleaned = cleanPhone(phone);
  
  // If starts with 998, assume it's already with country code
  if (cleaned.startsWith('998') && cleaned.length === 12) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
  }
  
  // If starts with 8 or without country code (9 digits), add 998
  if (cleaned.startsWith('8') && cleaned.length === 9) {
    const without8 = cleaned.slice(1);
    return `+998 ${without8.slice(0, 2)} ${without8.slice(2, 5)} ${without8.slice(5, 7)} ${without8.slice(7, 9)}`;
  }
  
  // If 9 digits without leading 8
  if (cleaned.length === 9 && !cleaned.startsWith('8')) {
    return `+998 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
  }
  
  // If 12 digits (already with +998)
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
  }
  
  // Return original if can't format
  return phone;
};

/**
 * Validates Uzbekistan phone number format
 */
export const validateUzbekistanPhone = (phone: string): { isValid: boolean; formatted: string; error?: string } => {
  const cleaned = cleanPhone(phone);
  
  // Check if it's a valid Uzbekistan number
  // Valid formats:
  // - 9 digits starting with 9 (mobile)
  // - 9 digits starting with 7 (mobile)
  // - 12 digits starting with 998 (with country code)
  // - 10 digits starting with 8 (old format)
  
  if (cleaned.length === 0) {
    return { isValid: false, formatted: phone, error: 'Телефон не может быть пустым' };
  }
  
  // Check for valid Uzbekistan mobile prefixes
  const validPrefixes = ['90', '91', '92', '93', '94', '95', '97', '98', '99', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'];
  
  let phoneToCheck = cleaned;
  
  // Remove country code if present
  if (cleaned.startsWith('998') && cleaned.length === 12) {
    phoneToCheck = cleaned.slice(3);
  } else if (cleaned.startsWith('8') && cleaned.length === 9) {
    phoneToCheck = cleaned.slice(1);
  }
  
  // Check if it's 9 digits and starts with valid prefix
  if (phoneToCheck.length === 9) {
    const prefix = phoneToCheck.slice(0, 2);
    if (validPrefixes.includes(prefix)) {
      const formatted = formatPhoneForTablet(phone);
      return { isValid: true, formatted };
    }
  }
  
  // Check if it's 12 digits with country code
  if (cleaned.length === 12 && cleaned.startsWith('998')) {
    const prefix = cleaned.slice(3, 5);
    if (validPrefixes.includes(prefix)) {
      const formatted = formatPhoneForTablet(phone);
      return { isValid: true, formatted };
    }
  }
  
  return { 
    isValid: false, 
    formatted: phone, 
    error: `Неверный формат телефона. Ожидается: 9 цифр (90-99, 70-79) или +998 XX XXX XX XX` 
  };
};

/**
 * Checks and formats all client phones
 */
export const checkAllPhones = (clients: Array<{ id: string; name: string; phone?: string }>): {
  valid: Array<{ id: string; name: string; phone: string; formatted: string }>;
  invalid: Array<{ id: string; name: string; phone: string; error: string }>;
  missing: Array<{ id: string; name: string }>;
} => {
  const valid: Array<{ id: string; name: string; phone: string; formatted: string }> = [];
  const invalid: Array<{ id: string; name: string; phone: string; error: string }> = [];
  const missing: Array<{ id: string; name: string }> = [];
  
  clients.forEach(client => {
    if (!client.phone || client.phone.trim() === '') {
      missing.push({ id: client.id, name: client.name });
      return;
    }
    
    const validation = validateUzbekistanPhone(client.phone);
    if (validation.isValid) {
      valid.push({
        id: client.id,
        name: client.name,
        phone: client.phone,
        formatted: validation.formatted
      });
    } else {
      invalid.push({
        id: client.id,
        name: client.name,
        phone: client.phone,
        error: validation.error || 'Неверный формат'
      });
    }
  });
  
  return { valid, invalid, missing };
};








