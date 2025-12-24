import { errorDev, warnDev } from './logger';
import { getSpreadsheetId } from './spreadsheetId';

export type SheetsMethod = 'GET' | 'POST' | 'PUT';

export interface SheetsValuesResponse {
  values?: unknown[][];
}

async function handleApiResponse(response: Response, context: string): Promise<void> {
  if (response.ok) return;

  let errorMessage = `HTTP ${response.status}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData?.error?.message || errorData?.error?.status || errorMessage;
    errorDev(`❌ Google Sheets API Error (${response.status}) in ${context}:`, errorData);
  } catch {
    const text = await response.text();
    errorDev(`❌ Google Sheets API Error (${response.status}) in ${context}:`, text);
    errorMessage = `HTTP ${response.status}: ${text.substring(0, 150)}`;
  }

  if (response.status === 401) {
    // OAuth access tokens are short-lived; clear stored token to force re-login
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_time');
    throw new Error(
      'UNAUTHENTICATED: Токен доступа истек или недействителен. Пожалуйста, выйдите и войдите заново.'
    );
  }

  if (response.status === 403) {
    throw new Error(
      'PERMISSION_DENIED: Недостаточно прав доступа к Google Sheets. Проверьте доступ к таблице и OAuth scopes.'
    );
  }

  if (response.status === 404) {
    throw new Error('NOT_FOUND: Таблица/диапазон не найден. Проверьте ID таблицы и названия листов.');
  }

  if (response.status === 429) {
    throw new Error('QUOTA_EXCEEDED: Превышен лимит запросов. Попробуйте позже.');
  }

  throw new Error(errorMessage);
}

export async function fetchSheets(
  accessToken: string,
  range: string,
  method: SheetsMethod = 'GET',
  body?: unknown
): Promise<SheetsValuesResponse> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID_NOT_SET: Пожалуйста, настройте ID таблицы в настройках.');
  }

  if (!accessToken) {
    throw new Error('ACCESS_TOKEN_MISSING: Отсутствует OAuth access token. Пожалуйста, войдите заново.');
  }

  // OAuth access token обычно начинается с "ya29."
  if (!accessToken.startsWith('ya29.')) {
    warnDev('⚠️ Токен не похож на OAuth 2.0 access token (ожидается префикс "ya29.")');
  }

  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  if (method === 'POST') url += ':append?valueInputOption=USER_ENTERED';
  if (method === 'PUT') url += '?valueInputOption=USER_ENTERED';

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  await handleApiResponse(response, `${method} ${range}`);
  return (await response.json()) as SheetsValuesResponse;
}

export async function clearRange(accessToken: string, a1Range: string): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${a1Range}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  await handleApiResponse(response, `clear ${a1Range}`);
}

export async function writeRange(accessToken: string, a1Range: string, values: unknown[][]): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not set');

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${a1Range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  await handleApiResponse(response, `write ${a1Range}`);
}








