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

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}${method === 'GET' ? '' : ':append?valueInputOption=USER_ENTERED'}`;

    const options: RequestInit = {
        method: method === 'GET' ? 'GET' : 'POST', // We use POST for append
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
    minStockLevel: Number(row[9])
});

const mapProductToRow = (p: Product) => [
    p.id, p.name, p.type, p.dimensions, p.steelGrade, p.quantity, p.unit, p.pricePerUnit, p.costPrice, p.minStockLevel
];

// Map Order <-> Row (Simplified for MVP: storing JSON in one cell for complex objects like items)
const mapRowToOrder = (row: any[]): Order => ({
    id: row[0],
    date: row[1],
    customerName: row[2],
    sellerName: row[3],
    status: row[4] as any,
    subtotalAmount: Number(row[5]),
    vatRateSnapshot: Number(row[6]),
    vatAmount: Number(row[7]),
    totalAmount: Number(row[8]),
    exchangeRate: Number(row[9]),
    totalAmountUZS: Number(row[10]),
    items: JSON.parse(row[11] || '[]')
});

const mapOrderToRow = (o: Order) => [
    o.id, o.date, o.customerName, o.sellerName, o.status,
    o.subtotalAmount, o.vatRateSnapshot, o.vatAmount, o.totalAmount,
    o.exchangeRate, o.totalAmountUZS, JSON.stringify(o.items)
];

// --- Service Methods ---

export const sheetsService = {
    // Initialize Sheets (Create tabs and headers if empty)
    initialize: async (accessToken: string) => {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return;

        const createSheetIfNotExists = async (title: string) => {
            try {
                // Try to create the sheet. If it exists, this returns 400, which we ignore.
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

        // 2. Check and create headers for Products
        try {
            // Read A1 to check if empty
            const check = await fetchSheets(accessToken, 'Products!A1');
            if (!check.values || !check.values[0]) {
                await fetchSheets(accessToken, 'Products!A1:J1', 'PUT', { // Use PUT to set headers
                    values: [['ID', 'Name', 'Type', 'Dimensions', 'Steel Grade', 'Quantity', 'Unit', 'Price', 'Cost', 'Min Stock']]
                });
            }
        } catch (e) { console.error("Error init Products", e); }

        // 3. Check and create headers for Orders
        try {
            const check = await fetchSheets(accessToken, 'Orders!A1');
            if (!check.values || !check.values[0]) {
                await fetchSheets(accessToken, 'Orders!A1:L1', 'PUT', {
                    values: [['ID', 'Date', 'Customer', 'Seller', 'Status', 'Subtotal', 'VAT Rate', 'VAT Amount', 'Total USD', 'Exchange Rate', 'Total UZS', 'Items JSON']]
                });
            }
        } catch (e) { console.error("Error init Orders", e); }
    },

    getProducts: async (accessToken: string): Promise<Product[]> => {
        try {
            const data = await fetchSheets(accessToken, 'Products!A2:J');
            return (data.values || []).map(mapRowToProduct);
        } catch (e) {
            console.error("Failed to fetch products", e);
            return [];
        }
    },

    saveProduct: async (accessToken: string, product: Product) => {
        // For MVP: We are just appending. Real sync requires finding and updating rows.
        // To keep it simple: We will clear and rewrite for now (Not efficient for large data, but safe)
        // OR: Just append new ones.
        // Let's implement: Append Only for now, or "Sync" which is complex.

        // BETTER APPROACH FOR MVP:
        // We will read all, update in memory, and WRITE BACK ALL.
        // This is safe for small datasets (< 1000 rows).

        // This function signature implies saving ONE. 
        // But our App.tsx saves ALL products at once in useEffect.
        // So we should expose a "saveAllProducts" method.
    },

    saveAllProducts: async (accessToken: string, products: Product[]) => {
        const rows = products.map(mapProductToRow);
        // Clear existing
        const spreadsheetId = getSpreadsheetId();
        const urlClear = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:J:clear`;
        await fetch(urlClear, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Write new
        const urlWrite = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A2:J?valueInputOption=USER_ENTERED`;
        await fetch(urlWrite, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: rows })
        });
    },

    saveAllOrders: async (accessToken: string, orders: Order[]) => {
        const rows = orders.map(mapOrderToRow);
        const spreadsheetId = getSpreadsheetId();

        // Clear
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:L:clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Write
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A2:L?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: rows })
        });
    },

    getOrders: async (accessToken: string): Promise<Order[]> => {
        try {
            const data = await fetchSheets(accessToken, 'Orders!A2:L');
            return (data.values || []).map(mapRowToOrder);
        } catch (e) {
            console.error("Failed to fetch orders", e);
            return [];
        }
    },

    testConnection: async (accessToken: string) => {
        try {
            const spreadsheetId = getSpreadsheetId();
            if (!spreadsheetId) throw new Error("ID не установлен");

            // Try to read A1 of the first sheet (usually exists)
            // We use a generic range to avoid 400 if tabs don't exist yet
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
