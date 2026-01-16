import { errorDev } from './logger';
import { getSpreadsheetId } from './spreadsheetId';
import { fetchSheets } from './api';

export async function initializeSheets(accessToken: string): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return;

  const createSheetIfNotExists = async (title: string) => {
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title },
              },
            },
          ],
        }),
      });
    } catch {
      // ignore if already exists
    }
  };

  // Ensure tabs exist
  await createSheetIfNotExists('Products');
  await createSheetIfNotExists('Orders');
  await createSheetIfNotExists('Expenses');
  await createSheetIfNotExists('FixedAssets');
  await createSheetIfNotExists('Clients');
  await createSheetIfNotExists('Staff');
  await createSheetIfNotExists('Purchases');
  await createSheetIfNotExists('Transactions');
  await createSheetIfNotExists('Journal');
  await createSheetIfNotExists('WorkflowOrders');

  // Headers
  try {
    await fetchSheets(accessToken, 'Products!A1:L1', 'PUT', {
      values: [['ID', 'Name', 'Type', 'Dimensions', 'Steel Grade', 'Quantity', 'Unit', 'Price', 'Cost', 'Min Stock', 'Origin', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init Products', e);
  }

  try {
    await fetchSheets(accessToken, 'Orders!A1:U1', 'PUT', {
      values: [[
        'ID',
        'Date',
        'Customer',
        'Seller',
        'Items JSON',
        'Subtotal (USD)',
        'VAT Rate',
        'VAT Amount',
        'Total (USD)',
        'Exchange Rate',
        'Total (UZS)',
        'Status',
        'Payment Method',
        'Payment Status',
        'Amount Paid',
        'Payment Currency',
        'Updated At',
        'Seller ID',
        'Version',
        'Report No',
        'Payment Due Date',
      ]],
    });
  } catch (e) {
    errorDev('Error init Orders', e);
  }

  try {
    await fetchSheets(accessToken, 'Expenses!A1:H1', 'PUT', {
      values: [['ID', 'Date', 'Description', 'Amount (USD)', 'Category', 'Payment Method', 'Currency', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init Expenses', e);
  }

  try {
    await fetchSheets(accessToken, 'FixedAssets!A1:J1', 'PUT', {
      values: [['ID', 'Name', 'Category', 'Purchase Date', 'Cost (USD)', 'Current Value (USD)', 'Accum. Depreciation', 'Annual Rate (%)', 'Last Depr. Date', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init FixedAssets', e);
  }

  try {
    await fetchSheets(accessToken, 'Clients!A1:Q1', 'PUT', {
      values: [['ID', 'Name', 'Type', 'Phone', 'Email', 'Address', 'Credit Limit', 'Notes', 'Total Purchases', 'Total Debt', 'Company Name', 'INN', 'MFO', 'Bank Account', 'Bank Name', 'Legal Address', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init Clients', e);
  }

  try {
    await fetchSheets(accessToken, 'Staff!A1:O1', 'PUT', {
      values: [['ID', 'Name', 'Email', 'Phone', 'Position', 'Role', 'Hire Date', 'Salary (USD)', 'Status', 'Notes', 'Permissions', 'Updated At', 'Commission Rate', 'Has KPI', 'Termination Date']],
    });
  } catch (e) {
    errorDev('Error init Staff', e);
  }

  try {
    await fetchSheets(accessToken, 'Purchases!A1:L1', 'PUT', {
      values: [['ID', 'Date', 'Supplier', 'Status', 'Items JSON', 'Overheads JSON', 'Total Invoice', 'Total Landed', 'Payment Method', 'Payment Status', 'Amount Paid', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init Purchases', e);
  }

  try {
    await fetchSheets(accessToken, 'Transactions!A1:J1', 'PUT', {
      values: [['ID', 'Date', 'Type', 'Amount', 'Currency', 'Exchange Rate', 'Method', 'Description', 'Related ID', 'Updated At']],
    });
  } catch (e) {
    errorDev('Error init Transactions', e);
  }

  try {
    await fetchSheets(accessToken, 'Journal!A1:M1', 'PUT', {
      values: [['ID', 'Date', 'Type', 'Employee ID', 'Employee Name', 'Employee Email', 'Action', 'Description', 'Module', 'Related Type', 'Related ID', 'Receipt Details', 'Metadata']],
    });
  } catch (e) {
    errorDev('Error init Journal', e);
  }

  try {
    await fetchSheets(accessToken, 'WorkflowOrders!A1:V1', 'PUT', {
      values: [[
        'ID',
        'Date',
        'Customer',
        'Customer Phone',
        'Created By',
        'Items JSON',
        'Subtotal (USD)',
        'VAT Rate',
        'VAT Amount',
        'Total (USD)',
        'Exchange Rate',
        'Total (UZS)',
        'Status',
        'Notes',
        'Delivery Date',
        'Payment Method',
        'Payment Status',
        'Payment Currency',
        'Amount Paid (USD)',
        'Converted Order ID',
        'Converted At',
        'Updated At',
      ]],
    });
  } catch (e) {
    errorDev('Error init WorkflowOrders', e);
  }
}








