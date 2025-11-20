import { Product, Order, Expense, Purchase } from '../types';

const SPREADSHEET_ID_KEY = 'metal_erp_spreadsheet_id';

// Helper to get/set Spreadsheet ID
export const getSpreadsheetId = (): string => {
    return localStorage.getItem(SPREADSHEET_ID_KEY) || '';
};

export const saveSpreadsheetId = (id: string) => {
    localStorage.setItem(SPREADSHEET_ID_KEY, id);
};

// Helper to make authenticated requests to Sheets API
const fetchSheets = async (accessToken: string, range: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: any) => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) throw new Error("Spreadsheet ID not set");

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

    const response = await fetch(url, options);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Sheets API Error');
    }
    return response.json();
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
    },

    // --- Products ---
    getProducts: async (accessToken: string): Promise<Product[]> => {
        try {
            const data = await fetchSheets(accessToken, 'Products!A2:K');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID' && row[1] !== 'Name')
                .map(mapRowToProduct);
        } catch (e) {
            console.error("Failed to fetch products", e);
            return [];
        }
    },

    saveAllProducts: async (accessToken: string, products: Product[]) => {
        const rows = products.map(mapProductToRow);
        const spreadsheetId = getSpreadsheetId();

        // Clear existing
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:K:clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Write new
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:K?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: rows })
        });
    },

    // --- Orders ---
    getOrders: async (accessToken: string): Promise<Order[]> => {
        try {
            const data = await fetchSheets(accessToken, 'Orders!A2:P');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToOrder);
        } catch (e) {
            console.error("Failed to fetch orders", e);
            return [];
        }
    },

    saveAllOrders: async (accessToken: string, orders: Order[]) => {
        const rows = orders.map(mapOrderToRow);
        const spreadsheetId = getSpreadsheetId();

        // Clear
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:P:clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Write
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:P?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: rows })
        });
    },

    // --- Expenses ---
    getExpenses: async (accessToken: string): Promise<Expense[]> => {
        try {
            const data = await fetchSheets(accessToken, 'Expenses!A2:G');
            return (data.values || [])
                .filter(row => row[0] && row[0] !== 'ID')
                .map(mapRowToExpense);
        } catch (e) {
            console.error("Failed to fetch expenses", e);
            return [];
        }
    },

    saveAllExpenses: async (accessToken: string, expenses: Expense[]) => {
        const rows = expenses.map(mapExpenseToRow);
        const spreadsheetId = getSpreadsheetId();

        // Clear
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A2:G:clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Write
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A2:G?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: rows })
        });
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
    }
};
