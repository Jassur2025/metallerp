// Facade: keep stable import paths across the app (`../services/sheetsService`)
// Actual implementation is split into `services/sheets/*`

export { getSpreadsheetId, saveSpreadsheetId } from './sheets/spreadsheetId';
export { sheetsService } from './sheets/service';



