const SPREADSHEET_ID_KEY = 'metal_erp_spreadsheet_id';

export const getSpreadsheetId = (): string => {
  return localStorage.getItem(SPREADSHEET_ID_KEY) || '';
};

export const saveSpreadsheetId = (id: string) => {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
};








