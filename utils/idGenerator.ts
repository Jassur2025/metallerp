/**
 * Safe ID Generator - Prevents ID collisions
 * 
 * CRITICAL: Replace all Date.now().toString() calls with this generator
 * 
 * Generates unique IDs using:
 * - Timestamp (36-base for compactness)
 * - Random component (high entropy)
 * - Crypto UUID (if available)
 * - Counter for same-millisecond uniqueness
 */

// Counter for same-millisecond uniqueness
let counter = 0;
let lastTimestamp = 0;

/**
 * Generates a unique ID with optional prefix
 * 
 * Format: PREFIX-TIMESTAMP-RANDOM-COUNTER
 * Example: ORD-lq5a8b2-x7k9m3p-001
 * 
 * @param prefix - Optional prefix (e.g., 'ORD', 'CLI', 'TRX', 'PRD')
 * @returns Unique ID string
 */
export function generateId(prefix: string = ''): string {
  const now = Date.now();
  
  // Reset counter if timestamp changed, increment if same millisecond
  if (now === lastTimestamp) {
    counter++;
  } else {
    counter = 0;
    lastTimestamp = now;
  }
  
  // Timestamp in base36 (compact)
  const timestamp = now.toString(36);
  
  // Random component with high entropy
  const random = generateRandomString(7);
  
  // Counter padded to 3 digits (supports 1000 IDs per millisecond)
  const counterStr = counter.toString().padStart(3, '0');
  
  // Combine components
  const id = prefix 
    ? `${prefix}-${timestamp}-${random}-${counterStr}`
    : `${timestamp}-${random}-${counterStr}`;
  
  return id;
}

/**
 * Generates a random alphanumeric string
 * Uses crypto.getRandomValues if available for better randomness
 */
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  // Try to use crypto for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => chars[b % chars.length])
      .join('');
  }
  
  // Fallback to Math.random
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Specific ID generators for each entity type
 * These ensure consistent prefixing across the application
 */
export const IdGenerator = {
  /** Generic ID with custom prefix */
  generate: (prefix: string) => generateId(prefix),
  
  /** Order ID: ORD-xxx */
  order: () => generateId('ORD'),
  
  /** Product ID: PRD-xxx */
  product: () => generateId('PRD'),
  
  /** Client ID: CLI-xxx */
  client: () => generateId('CLI'),
  
  /** Transaction ID: TRX-xxx */
  transaction: () => generateId('TRX'),
  
  /** Expense ID: EXP-xxx */
  expense: () => generateId('EXP'),
  
  /** Purchase ID: PUR-xxx */
  purchase: () => generateId('PUR'),
  
  /** Employee ID: EMP-xxx */
  employee: () => generateId('EMP'),
  
  /** Journal Event ID: JRN-xxx */
  journal: () => generateId('JRN'),
  
  /** Journal Event ID (alias): JE-xxx */
  journalEvent: () => generateId('JE'),
  
  /** Workflow Order ID: WFL-xxx */
  workflow: () => generateId('WFL'),
  
  /** Fixed Asset ID: AST-xxx */
  fixedAsset: () => generateId('AST'),
};

/**
 * Validates that an ID follows the expected format
 * Useful for debugging data integrity issues
 */
export function isValidId(id: string, expectedPrefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  
  // Check minimum length
  if (id.length < 10) return false;
  
  // Check prefix if specified
  if (expectedPrefix && !id.startsWith(expectedPrefix + '-')) return false;
  
  // Check for old-style numeric IDs (Date.now() pattern)
  const isOldStyle = /^\d{13,}$/.test(id);
  if (isOldStyle) {
    console.warn(`[IdGenerator] Old-style ID detected: ${id}. Consider migrating.`);
  }
  
  return true;
}

/**
 * Batch generate multiple unique IDs
 * Guarantees uniqueness even when called rapidly
 */
export function generateBatchIds(prefix: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateId(prefix));
  }
  return ids;
}

export default IdGenerator;
