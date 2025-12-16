import { Product, Order, Expense, Purchase, FixedAsset, Client, Employee, UserRole, Transaction, JournalEvent, WorkflowOrder } from '../types';
import { cacheService } from './cacheService';

const SPREADSHEET_ID_KEY = 'metal_erp_spreadsheet_id';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache TTL

// Helper to get/set Spreadsheet ID
export const getSpreadsheetId = (): string => {
    return localStorage.getItem(SPREADSHEET_ID_KEY) || '';
};

export const saveSpreadsheetId = (id: string) => {
    localStorage.setItem(SPREADSHEET_ID_KEY, id);
};

// Helper to handle API response errors and clear token on 401
const handleApiResponse = async (response: Response, context: string): Promise<void> => {
    if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            console.error(`❌ Google Sheets API Error (${response.status}) in ${context}:`, errorData);
        } catch (parseError) {
            const text = await response.text();
            console.error(`❌ Google Sheets API Error (${response.status}) in ${context}:`, text);
            errorMessage = `HTTP ${response.status}: ${text.substring(0, 100)}`;
        }
        
        // Clear token on 401 error
        if (response.status === 401) {
            console.error('❌ Access token expired or invalid. Clearing token from storage.');
            localStorage.removeItem('google_access_token');
            throw new Error('UNAUTHENTICATED: Токен доступа истек или недействителен. Пожалуйста, войдите заново.');
        }
        
        throw new Error(errorMessage);
    }
};

// Helper to make authenticated requests to Sheets API
const fetchSheets = async (accessToken: string, range: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown) => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
        console.error('❌ Spreadsheet ID не установлен');
        throw new Error("SPREADSHEET_ID_NOT_SET: Пожалуйста, настройте ID таблицы в настройках.");
    }

    if (!accessToken) {
        console.error('❌ OAuth access token отсутствует');
        console.error('⚠️ Возможно, вы используете Firebase ID token вместо OAuth access token');
        console.error('📝 Решение: выйдите и войдите заново через Google');
        throw new Error("ACCESS_TOKEN_MISSING: Отсутствует OAuth access token. Пожалуйста, войдите заново.");
    }
    
    // Проверяем, что это не Firebase ID token (они начинаются с "eyJ" и очень длинные)
    // OAuth access token обычно начинается с "ya29."
    if (!accessToken.startsWith('ya29.')) {
        console.warn('⚠️ Токен не похож на OAuth 2.0 access token (должен начинаться с "ya29.")');
        console.warn('⚠️ Возможно, используется Firebase ID token, который не работает с Google Sheets API');
    }

    let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    if (method === 'POST') {
        url += ':append?valueInputOption=USER_ENTERED';
    } else if (method === 'PUT') {
        url += '?valueInputOption=USER_ENTERED';
    }

    const options: RequestInit = {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            let errorMessage = 'Sheets API Error';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.error?.status || `HTTP ${response.status}`;
                console.error(`❌ Google Sheets API Error (${response.status}):`, errorData);
            } catch (parseError) {
                const text = await response.text();
                console.error(`❌ Google Sheets API Error (${response.status}):`, text);
                errorMessage = `HTTP ${response.status}: ${text.substring(0, 100)}`;
            }
            
            // Детальная информация об ошибке
            if (response.status === 401) {
                // Очищаем токен из localStorage при ошибке 401
                console.error('❌ 401 UNAUTHENTICATED: Неверные учетные данные');
                console.error('⚠️ Возможные причины:');
                console.error('   1. Используется Firebase ID token вместо OAuth access token');
                console.error('   2. OAuth access token истек (живет ~1 час)');
                console.error('   3. Отсутствует scope для Google Sheets API');
                console.error('📝 Решение: Выйдите и войдите заново через Google');
                localStorage.removeItem('google_access_token');
                localStorage.removeItem('google_access_token_time');
                throw new Error('UNAUTHENTICATED: Недействительные учетные данные. Используется неправильный тип токена или токен истек. Пожалуйста, выйдите и войдите заново.');
            } else if (response.status === 403) {
                console.error('❌ 403 PERMISSION_DENIED: Недостаточно прав');
                console.error('📝 Проверьте права доступа к таблице и настройки OAuth scope');
                throw new Error('PERMISSION_DENIED: Недостаточно прав доступа к Google Sheets. Проверьте настройки таблицы и OAuth scopes.');
            } else if (response.status === 404) {
                throw new Error('NOT_FOUND: Таблица не найдена. Проверьте ID таблицы.');
            } else if (response.status === 429) {
                throw new Error('QUOTA_EXCEEDED: Превышен лимит запросов. Попробуйте позже.');
            }
            
            throw new Error(errorMessage);
        }
        
        return response.json();
    } catch (error) {
        // Если это уже наша ошибка, пробрасываем дальше
        if (error instanceof Error && error.message.includes('UNAUTHENTICATED') || 
            error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
            throw error;
        }
        // Для других ошибок добавляем контекст
        console.error(`❌ Network error при запросе к Google Sheets:`, error);
        throw new Error(`Ошибка сети при обращении к Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// --- Data Mapping Helpers ---

// Map Product <-> Row
const mapRowToProduct = (row: any[]): Product => ({
    id: row[0],
    name: row[1],
    type: row[2] as any,
    dimensions: row[3],
    steelGrade: row[4],
    quantity: Number(row[5]),
    unit: row[6] as any,
    pricePerUnit: Number(row[7]),
    costPrice: Number(row[8]),
    minStockLevel: Number(row[9]),
    origin: (row[10] as 'import' | 'local') || 'local'
});

const mapProductToRow = (p: Product) => [
    p.id, p.name, p.type, p.dimensions, p.steelGrade, p.quantity, p.unit, p.pricePerUnit, p.costPrice, p.minStockLevel, p.origin || 'local'
];

// Map Order <-> Row
const mapRowToOrder = (row: any[]): Order => ({
    id: row[0],
    date: row[1],
    customerName: row[2],
    sellerName: row[3],
    items: JSON.parse(row[4] || '[]'),
    subtotalAmount: Number(row[5]),
    vatRateSnapshot: Number(row[6]),
    vatAmount: Number(row[7]),
    totalAmount: Number(row[8]),
    exchangeRate: Number(row[9]),
    totalAmountUZS: Number(row[10]),
    status: row[11] as any,
    paymentMethod: (row[12] as any) || 'cash',
    paymentStatus: (row[13] as any) || 'paid',
    amountPaid: Number(row[14]) || 0,
    paymentCurrency: (row[15] as any) || 'USD'
});

const mapOrderToRow = (o: Order) => [
    o.id, o.date, o.customerName, o.sellerName, JSON.stringify(o.items),
    o.subtotalAmount, o.vatRateSnapshot, o.vatAmount, o.totalAmount,
    o.exchangeRate, o.totalAmountUZS, o.status,
    o.paymentMethod, o.paymentStatus, o.amountPaid, o.paymentCurrency || 'USD'
];

// Map Expense <-> Row
const mapRowToExpense = (row: any[]): Expense => ({
    id: row[0],
    date: row[1],
    description: row[2],
    amount: Number(row[3]),
    category: row[4],
    paymentMethod: (row[5] as any) || 'cash',
    currency: (row[6] as any) || 'USD'
});

const mapExpenseToRow = (e: Expense) => [
    e.id, e.date, e.description, e.amount, e.category, e.paymentMethod || 'cash', e.currency || 'USD'
];

// Map FixedAsset <-> Row
const mapRowToFixedAsset = (row: any[]): FixedAsset => ({
    id: row[0],
    name: row[1],
    category: row[2] as any,
    purchaseDate: row[3],
    purchaseCost: Number(row[4]),
    currentValue: Number(row[5]),
    accumulatedDepreciation: Number(row[6]),
    depreciationRate: Number(row[7]),
    lastDepreciationDate: row[8] || undefined
});

const mapFixedAssetToRow = (fa: FixedAsset) => [
    fa.id, fa.name, fa.category, fa.purchaseDate, fa.purchaseCost, fa.currentValue, fa.accumulatedDepreciation, fa.depreciationRate, fa.lastDepreciationDate || ''
];

// Map Client <-> Row
const mapRowToClient = (row: any[]): Client => ({
    id: row[0],
    name: row[1],
    phone: row[2],
    email: row[3],
    address: row[4],
    creditLimit: Number(row[5]),
    notes: row[6],
    totalPurchases: Number(row[7]) || 0,
    totalDebt: Number(row[8]) || 0
});

const mapClientToRow = (c: Client) => [
    c.id, c.name, c.phone, c.email || '', c.address || '', c.creditLimit, c.notes || '', c.totalPurchases || 0, c.totalDebt || 0
];

// Map Employee <-> Row
const mapRowToEmployee = (row: any[]): Employee => ({
    id: row[0],
    name: row[1],
    email: row[2],
    phone: row[3],
    position: row[4],
    role: row[5] as UserRole,
    hireDate: row[6],
    salary: Number(row[7]) || 0,
    status: (row[8] as 'active' | 'inactive') || 'active',
    notes: row[9],
    permissions: row[10] ? JSON.parse(row[10]) : undefined
});

const mapEmployeeToRow = (e: Employee) => [
    e.id, e.name, e.email, e.phone || '', e.position, e.role, e.hireDate, e.salary || 0, e.status, e.notes || '',
    e.permissions ? JSON.stringify(e.permissions) : ''
];

// Map JournalEvent <-> Row
const mapRowToJournalEvent = (row: any[]): JournalEvent => ({
    id: row[0],
    date: row[1],
    type: row[2] as any,
    employeeId: row[3],
    employeeName: row[4],
    employeeEmail: row[5],
    action: row[6],
    description: row[7],
    module: row[8],
    relatedType: row[9] as any,
    relatedId: row[10],
    receiptDetails: row[11] ? JSON.parse(row[11]) : undefined,
    metadata: row[12] ? JSON.parse(row[12]) : undefined
});

const mapJournalEventToRow = (e: JournalEvent) => [
    e.id, e.date, e.type, e.employeeId || '', e.employeeName || '', e.employeeEmail || '',
    e.action, e.description, e.module || '', e.relatedType || '', e.relatedId || '',
    e.receiptDetails ? JSON.stringify(e.receiptDetails) : '',
    e.metadata ? JSON.stringify(e.metadata) : ''
];

// Map WorkflowOrder <-> Row
const mapRowToWorkflowOrder = (row: any[]): WorkflowOrder => ({
    id: row[0],
    date: row[1],
    customerName: row[2],
    customerPhone: row[3] || undefined,
    createdBy: row[4],
    items: JSON.parse(row[5] || '[]'),
    subtotalAmount: Number(row[6]) || 0,
    vatRateSnapshot: Number(row[7]) || 0,
    vatAmount: Number(row[8]) || 0,
    totalAmount: Number(row[9]) || 0,
    exchangeRate: Number(row[10]) || 0,
    totalAmountUZS: Number(row[11]) || 0,
    status: row[12] as any,
    notes: row[13] || undefined,
    deliveryDate: row[14] || undefined,
    paymentMethod: (row[15] as any) || 'cash',
    paymentStatus: (row[16] as any) || 'unpaid',
    paymentCurrency: (row[17] as any) || 'UZS',
    amountPaid: Number(row[18]) || 0,
    convertedToOrderId: row[19] || undefined,
    convertedAt: row[20] || undefined
});

const mapWorkflowOrderToRow = (o: WorkflowOrder) => [
    o.id,
    o.date,
    o.customerName,
    o.customerPhone || '',
    o.createdBy,
    JSON.stringify(o.items || []),
    o.subtotalAmount,
    o.vatRateSnapshot,
    o.vatAmount,
    o.totalAmount,
    o.exchangeRate,
    o.totalAmountUZS,
    o.status,
    o.notes || '',
    o.deliveryDate || '',
    o.paymentMethod,
    o.paymentStatus,
    o.paymentCurrency || '',
    o.amountPaid || 0,
    o.convertedToOrderId || '',
    o.convertedAt || ''
];



// --- Cache Helper ---
const cachedFetch = async <T>(
    cacheKey: string,
    accessToken: string,
    fetchFn: () => Promise<T>,
    useCache: boolean = true
): Promise<T> => {
    // Try cache first
    if (useCache) {
        const cached = cacheService.get<T>(cacheKey);
        if (cached) {
            console.log(`📦 ${cacheKey} loaded from cache`);
            return cached;
        }
    }

    try {
        const data = await fetchFn();
        // Cache the result
        cacheService.set(cacheKey, data, CACHE_TTL);
        console.log(`📥 ${cacheKey} loaded from Google Sheets`);
        return data;
    } catch (e) {
        console.error(`Failed to fetch ${cacheKey}`, e);
        // Try to return stale cache if available
        const staleCache = cacheService.get<T>(cacheKey);
        if (staleCache) {
            console.log(`⚠️ Using stale cache for ${cacheKey} due to fetch error`);
            return staleCache;
        }
        throw e;
    }
};

// --- Service Methods ---

export const sheetsService = {
    // Initialize Sheets (Create tabs and headers if empty)
    initialize: async (accessToken: string) => {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return;

        const createSheetIfNotExists = async (title: string) => {
            try {
                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requests: [{
                            addSheet: {
                                properties: { title }
                            }
                        }]
                    })
                });
            } catch (e) {
                // Ignore error if sheet already exists
            }
        };

        // 1. Ensure tabs exist
        await createSheetIfNotExists('Products');
        await createSheetIfNotExists('Orders');
        await createSheetIfNotExists('Expenses');
        await createSheetIfNotExists('FixedAssets');

        // 2. Check and create headers for Products
        try {
            await fetchSheets(accessToken, 'Products!A1:K1', 'PUT', {
                values: [['ID', 'Name', 'Type', 'Dimensions', 'Steel Grade', 'Quantity', 'Unit', 'Price', 'Cost', 'Min Stock', 'Origin']]
            });
        } catch (e) { console.error("Error init Products", e); }

        // 3. Check and create headers for Orders
        try {
            await fetchSheets(accessToken, 'Orders!A1:P1', 'PUT', {
                values: [['ID', 'Date', 'Customer', 'Seller', 'Items JSON', 'Subtotal (USD)', 'VAT Rate', 'VAT Amount', 'Total (USD)', 'Exchange Rate', 'Total (UZS)', 'Status', 'Payment Method', 'Payment Status', 'Amount Paid', 'Payment Currency']]
            });
        } catch (e) { console.error("Error init Orders", e); }

        // 4. Check and create headers for Expenses
        try {
            await fetchSheets(accessToken, 'Expenses!A1:G1', 'PUT', {
                values: [['ID', 'Date', 'Description', 'Amount (USD)', 'Category', 'Payment Method', 'Currency']]
            });
        } catch (e) { console.error("Error init Expenses", e); }

        // 5. Check and create headers for FixedAssets
        try {
            await fetchSheets(accessToken, 'FixedAssets!A1:I1', 'PUT', {
                values: [['ID', 'Name', 'Category', 'Purchase Date', 'Cost (USD)', 'Current Value (USD)', 'Accum. Depreciation', 'Annual Rate (%)', 'Last Depr. Date']]
            });
        } catch (e) { console.error("Error init FixedAssets", e); }

        // 6. Check and create headers for Clients
        await createSheetIfNotExists('Clients');
        try {
            await fetchSheets(accessToken, 'Clients!A1:I1', 'PUT', {
                values: [['ID', 'Name', 'Phone', 'Email', 'Address', 'Credit Limit', 'Notes', 'Total Purchases', 'Total Debt']]
            });
        } catch (e) { console.error("Error init Clients", e); }

        // 7. Check and create headers for Staff (Renamed from Employees)
        await createSheetIfNotExists('Staff');
        try {
            await fetchSheets(accessToken, 'Staff!A1:K1', 'PUT', {
                values: [['ID', 'Name', 'Email', 'Phone', 'Position', 'Role', 'Hire Date', 'Salary (USD)', 'Status', 'Notes', 'Permissions']]
            });
        } catch (e) { console.error("Error init Staff", e); }

        // 8. Check and create headers for Purchases (Import) - Update existing or create new
        await createSheetIfNotExists('Purchases');
        try {
            // We need to update headers if they exist, but for now let's just ensure the sheet exists.
            // If we want to be safe, we can update headers.
            await fetchSheets(accessToken, 'Purchases!A1:K1', 'PUT', {
                values: [['ID', 'Date', 'Supplier', 'Status', 'Items JSON', 'Overheads JSON', 'Total Invoice', 'Total Landed', 'Payment Method', 'Payment Status', 'Amount Paid']]
            });
        } catch (e) { console.error("Error init Purchases", e); }

        // 9. Check and create headers for Transactions
        await createSheetIfNotExists('Transactions');
        try {
            await fetchSheets(accessToken, 'Transactions!A1:I1', 'PUT', {
                values: [['ID', 'Date', 'Type', 'Amount', 'Currency', 'Exchange Rate', 'Method', 'Description', 'Related ID']]
            });
        } catch (e) { console.error("Error init Transactions", e); }

        // 10. Check and create headers for Journal
        await createSheetIfNotExists('Journal');
        try {
            await fetchSheets(accessToken, 'Journal!A1:M1', 'PUT', {
                values: [['ID', 'Date', 'Type', 'Employee ID', 'Employee Name', 'Employee Email', 'Action', 'Description', 'Module', 'Related Type', 'Related ID', 'Receipt Details', 'Metadata']]
            });
        } catch (e) { console.error("Error init Journal", e); }

        // 11. Workflow Orders
        await createSheetIfNotExists('WorkflowOrders');
        try {
            await fetchSheets(accessToken, 'WorkflowOrders!A1:U1', 'PUT', {
                values: [[
                    'ID', 'Date', 'Customer', 'Customer Phone', 'Created By', 'Items JSON',
                    'Subtotal (USD)', 'VAT Rate', 'VAT Amount', 'Total (USD)', 'Exchange Rate', 'Total (UZS)',
                    'Status', 'Notes', 'Delivery Date',
                    'Payment Method', 'Payment Status', 'Payment Currency', 'Amount Paid (USD)',
                    'Converted Order ID', 'Converted At'
                ]]
            });
        } catch (e) { console.error("Error init WorkflowOrders", e); }
    },

    // --- Workflow Orders ---
    getWorkflowOrders: async (accessToken: string, useCache: boolean = true): Promise<WorkflowOrder[]> => {
        return cachedFetch('workflowOrders', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'WorkflowOrders!A2:U');
            return (data.values || [])
                .filter((row: any[]) => row[0] && row[0] !== 'ID')
                .map(mapRowToWorkflowOrder);
        }, useCache);
    },

    saveAllWorkflowOrders: async (accessToken: string, workflowOrders: WorkflowOrder[]) => {
        try {
            const rows = workflowOrders.map(mapWorkflowOrderToRow);
            const spreadsheetId = getSpreadsheetId();
            if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/WorkflowOrders!A2:U:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            await handleApiResponse(clearResponse, 'clear WorkflowOrders sheet');

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/WorkflowOrders!A2:U?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });
            await handleApiResponse(writeResponse, 'write WorkflowOrders');

            cacheService.invalidate('workflowOrders');
        } catch (e) {
            console.error('❌ Error in saveAllWorkflowOrders:', e);
            throw e;
        }
    },

    // --- Purchases (Import) ---
    getPurchases: async (accessToken: string, useCache: boolean = true): Promise<Purchase[]> => {
        return cachedFetch('purchases', accessToken, async () => {
            console.log('📥 Loading Purchases from Google Sheets...');
            const data = await fetchSheets(accessToken, 'Purchases!A2:K');
            const purchases = (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(row => ({
                    id: row[0],
                    date: row[1],
                    supplierName: row[2],
                    status: row[3] as any,
                    items: JSON.parse(row[4] || '[]'),
                    overheads: JSON.parse(row[5] || '{}'),
                    totalInvoiceAmount: Number(row[6]),
                    totalLandedAmount: Number(row[7]),
                    paymentMethod: (row[8] as any) || 'cash',
                    paymentStatus: (row[9] as any) || 'paid',
                    amountPaid: Number(row[10]) || Number(row[7]) // Default to full amount if missing
                }));
            console.log(`✅ Loaded ${purchases.length} purchases from Sheets`);
            return purchases;
        }, useCache);
    },

    saveAllPurchases: async (accessToken: string, purchases: Purchase[]) => {
        try {
            const rows = purchases.map(p => [
                p.id, p.date, p.supplierName, p.status, JSON.stringify(p.items), JSON.stringify(p.overheads),
                p.totalInvoiceAmount, p.totalLandedAmount, p.paymentMethod, p.paymentStatus, p.amountPaid
            ]);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${purchases.length} purchases to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Purchases!A2:K:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!clearResponse.ok) {
                const errorData = await clearResponse.json();
                throw new Error(`Failed to clear Purchases sheet: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Purchases!A2:K?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            if (!writeResponse.ok) {
                const errorData = await writeResponse.json();
                throw new Error(`Failed to write Purchases: ${errorData.error?.message || 'Unknown error'}`);
            }

            console.log('✅ Purchases saved successfully!');
            cacheService.invalidate('purchases');
        } catch (e) {
            console.error('❌ Error in saveAllPurchases:', e);
            throw e;
        }
    },

    // --- Products ---
    getProducts: async (accessToken: string, useCache: boolean = true): Promise<Product[]> => {
        const cacheKey = 'products';
        
        // Try cache first
        if (useCache) {
            const cached = cacheService.get<Product[]>(cacheKey);
            if (cached) {
                console.log('📦 Products loaded from cache');
                return cached;
            }
        }

        try {
            const data = await fetchSheets(accessToken, 'Products!A2:K');
            const products = (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID' && row[1] !== 'Name')
                .map(mapRowToProduct);
            
            // Cache the result
            cacheService.set(cacheKey, products, CACHE_TTL);
            console.log('📥 Products loaded from Google Sheets');
            return products;
        } catch (e) {
            console.error("Failed to fetch products", e);
            // Try to return stale cache if available
            const staleCache = cacheService.get<Product[]>(cacheKey);
            if (staleCache && staleCache.length > 0) {
                console.log('⚠️ Using stale cache due to fetch error');
                return staleCache;
            }
            // Пробрасываем ошибку вместо возврата пустого массива
            throw e;
        }
    },

    saveAllProducts: async (accessToken: string, products: Product[]) => {
        try {
            if (!accessToken) {
                throw new Error('Access token not provided');
            }
            
            const rows = products.map(mapProductToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${products.length} products to Google Sheets (ID: ${spreadsheetId})`);

            // Clear existing
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:K:clear`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!clearResponse.ok) {
                let errorMessage = 'Failed to clear Products sheet';
                try {
                    const errorData = await clearResponse.json();
                    errorMessage = errorData.error?.message || `HTTP ${clearResponse.status}`;
                } catch (e) {
                    const text = await clearResponse.text();
                    errorMessage = `HTTP ${clearResponse.status}: ${text.substring(0, 100)}`;
                }
                console.error('❌ Error clearing Products:', errorMessage);
                throw new Error(errorMessage);
            }

            // Write new
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:K?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ values: rows })
            });

            if (!writeResponse.ok) {
                let errorMessage = 'Failed to write Products';
                try {
                    const errorData = await writeResponse.json();
                    errorMessage = errorData.error?.message || `HTTP ${writeResponse.status}`;
                } catch (e) {
                    const text = await writeResponse.text();
                    errorMessage = `HTTP ${writeResponse.status}: ${text.substring(0, 100)}`;
                }
                console.error('❌ Error writing Products:', errorMessage);
                throw new Error(errorMessage);
            }

            console.log('✅ Products saved successfully!');
            // Invalidate cache after save
            cacheService.invalidate('products');
        } catch (e) {
            console.error('❌ Error in saveAllProducts:', e);
            // Добавляем больше контекста для отладки
            if (e instanceof Error) {
                console.error('Error details:', {
                    message: e.message,
                    stack: e.stack,
                    accessToken: accessToken ? 'present' : 'missing',
                    spreadsheetId: getSpreadsheetId() || 'not set',
                    productsCount: products.length
                });
            }
            throw e;
        }
    },

    // --- Orders ---
    getOrders: async (accessToken: string, useCache: boolean = true): Promise<Order[]> => {
        const cacheKey = 'orders';
        
        // Try cache first
        if (useCache) {
            const cached = cacheService.get<Order[]>(cacheKey);
            if (cached) {
                console.log('📦 Orders loaded from cache');
                return cached;
            }
        }

        try {
            const data = await fetchSheets(accessToken, 'Orders!A2:P');
            const orders = (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToOrder);
            
            // Cache the result
            cacheService.set(cacheKey, orders, CACHE_TTL);
            console.log('📥 Orders loaded from Google Sheets');
            return orders;
        } catch (e) {
            console.error("Failed to fetch orders", e);
            // Try to return stale cache if available
            const staleCache = cacheService.get<Order[]>(cacheKey);
            if (staleCache && staleCache.length > 0) {
                console.log('⚠️ Using stale cache due to fetch error');
                return staleCache;
            }
            // Пробрасываем ошибку вместо возврата пустого массива
            throw e;
        }
    },

    saveAllOrders: async (accessToken: string, orders: Order[]) => {
        try {
            const rows = orders.map(mapOrderToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${orders.length} orders to Google Sheets (ID: ${spreadsheetId})`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:P:clear`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            await handleApiResponse(clearResponse, 'clear Orders sheet');

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:P?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });
            
            await handleApiResponse(writeResponse, 'write Orders');
            
            console.log('✅ Orders saved successfully!');
            // Invalidate cache after save
            cacheService.invalidate('orders');
        } catch (e) {
            console.error('❌ Error in saveAllOrders:', e);
            throw e;
        }
    },

    // --- Expenses ---
    getExpenses: async (accessToken: string, useCache: boolean = true): Promise<Expense[]> => {
        return cachedFetch('expenses', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'Expenses!A2:G');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToExpense);
        }, useCache);
    },

    saveAllExpenses: async (accessToken: string, expenses: Expense[]) => {
        try {
            const rows = expenses.map(mapExpenseToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${expenses.length} expenses to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A2:G:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!clearResponse.ok) {
                const errorData = await clearResponse.json();
                throw new Error(`Failed to clear Expenses sheet: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A2:G?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            if (!writeResponse.ok) {
                const errorData = await writeResponse.json();
                throw new Error(`Failed to write Expenses: ${errorData.error?.message || 'Unknown error'}`);
            }

            console.log('✅ Expenses saved successfully!');
            cacheService.invalidate('expenses');
        } catch (e) {
            console.error('❌ Error in saveAllExpenses:', e);
            throw e;
        }
    },

    // --- Fixed Assets ---
    getFixedAssets: async (accessToken: string, useCache: boolean = true): Promise<FixedAsset[]> => {
        return cachedFetch('fixedAssets', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'FixedAssets!A2:I');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToFixedAsset);
        }, useCache);
    },

    saveAllFixedAssets: async (accessToken: string, assets: FixedAsset[]) => {
        try {
            const rows = assets.map(mapFixedAssetToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${assets.length} fixed assets to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/FixedAssets!A2:I:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!clearResponse.ok) {
                const errorData = await clearResponse.json();
                throw new Error(`Failed to clear FixedAssets sheet: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/FixedAssets!A2:I?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            if (!writeResponse.ok) {
                const errorData = await writeResponse.json();
                throw new Error(`Failed to write FixedAssets: ${errorData.error?.message || 'Unknown error'}`);
            }

            console.log('✅ Fixed assets saved successfully!');
            cacheService.invalidate('fixedAssets');
        } catch (e) {
            console.error('❌ Error in saveAllFixedAssets:', e);
            throw e;
        }
    },

    // --- Clients ---
    getClients: async (accessToken: string, useCache: boolean = true): Promise<Client[]> => {
        return cachedFetch('clients', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'Clients!A2:I');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToClient);
        }, useCache);
    },

    saveAllClients: async (accessToken: string, clients: Client[]) => {
        try {
            const rows = clients.map(mapClientToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${clients.length} clients to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Clients!A2:I:clear`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            await handleApiResponse(clearResponse, 'clear Clients sheet');

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Clients!A2:I?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            await handleApiResponse(writeResponse, 'write Clients');

            console.log('✅ Clients saved successfully!');
            cacheService.invalidate('clients');
        } catch (e) {
            console.error('❌ Error in saveAllClients:', e);
            throw e;
        }
    },

    // --- Employees (Staff) ---
    getEmployees: async (accessToken: string, useCache: boolean = true): Promise<Employee[]> => {
        return cachedFetch('employees', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'Staff!A2:K');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToEmployee);
        }, useCache);
    },

    saveAllEmployees: async (accessToken: string, employees: Employee[]) => {
        try {
            const rows = employees.map(mapEmployeeToRow);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${employees.length} employees to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Staff!A2:K:clear`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!clearResponse.ok) {
                const errorData = await clearResponse.json();
                throw new Error(`Failed to clear Staff sheet: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Staff!A2:K?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            if (!writeResponse.ok) {
                const errorData = await writeResponse.json();
                throw new Error(`Failed to write Staff: ${errorData.error?.message || 'Unknown error'}`);
            }

            console.log('✅ Employees saved successfully!');
            cacheService.invalidate('employees');
        } catch (e) {
            console.error('❌ Error in saveAllEmployees:', e);
            throw e;
        }
    },

    testConnection: async (accessToken: string, providedId?: string) => {
        try {
            const spreadsheetId = providedId || getSpreadsheetId();
            if (!spreadsheetId) throw new Error("ID не установлен");

            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }).then(async res => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error?.message || 'Ошибка доступа');
                }
            });
            return "Успешно! Связь установлена.";
        } catch (e: any) {
            throw new Error(e.message || "Ошибка соединения");
        }
    },

    // --- Transactions ---
    getTransactions: async (accessToken: string, useCache: boolean = true): Promise<Transaction[]> => {
        return cachedFetch('transactions', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'Transactions!A2:I');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(row => ({
                    id: row[0],
                    date: row[1],
                    type: row[2] as any,
                    amount: Number(row[3]) || 0,
                    currency: (row[4] as 'USD' | 'UZS') || 'USD',
                    exchangeRate: row[5] ? Number(row[5]) : undefined,
                    method: (row[6] as any) || 'cash',
                    description: row[7] || '',
                    relatedId: row[8] || undefined
                }));
        }, useCache);
    },

    saveAllTransactions: async (accessToken: string, transactions: Transaction[]) => {
        try {
            const rows = transactions.map(t => [
                t.id,
                t.date,
                t.type,
                t.amount,
                t.currency || 'USD',
                t.exchangeRate || '',
                t.method,
                t.description,
                t.relatedId || ''
            ]);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                throw new Error('Spreadsheet ID not set');
            }

            console.log(`💾 Saving ${transactions.length} transactions to Google Sheets`);

            // Clear
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I:clear`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            await handleApiResponse(clearResponse, 'clear Transactions sheet');

            // Write
            const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });

            await handleApiResponse(writeResponse, 'write Transactions');

            console.log('✅ Transactions saved successfully!');
            cacheService.invalidate('transactions');
        } catch (e) {
            console.error('❌ Error in saveAllTransactions:', e);
            throw e;
        }
    },




    // --- Journal ---
    getJournalEvents: async (accessToken: string, useCache: boolean = true): Promise<JournalEvent[]> => {
        return cachedFetch('journalEvents', accessToken, async () => {
            const data = await fetchSheets(accessToken, 'Journal!A2:M');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToJournalEvent);
        }, useCache);
    },

    addJournalEvent: async (accessToken: string, event: JournalEvent) => {
        try {
            const row = mapJournalEventToRow(event);
            const spreadsheetId = getSpreadsheetId();
            
            if (!spreadsheetId) {
                console.warn('⚠️ Spreadsheet ID not set, journal event not saved');
                return;
            }

            await fetchSheets(accessToken, 'Journal!A:M', 'POST', {
                values: [row]
            });
            console.log('✅ Journal event saved:', event.id);
        } catch (e) {
            console.error("❌ Failed to add journal event", e);
            // Don't throw - journal events are not critical
        }
    }
};
