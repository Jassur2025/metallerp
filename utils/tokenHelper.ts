/**
 * Helper functions for managing access tokens
 */

/**
 * Validates if access token is present and not empty
 */
const isDev = import.meta.env.DEV;
const warnDev = (...args: unknown[]) => { if (isDev) console.warn(...args); };
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };

export const validateAccessToken = (token: string | null | undefined): boolean => {
  if (!token) {
    warnDev('⚠️ Access token is missing');
    return false;
  }
  
  if (typeof token !== 'string' || token.trim().length === 0) {
    warnDev('⚠️ Access token is invalid (empty string)');
    return false;
  }
  
  return true;
};

/**
 * Checks if error indicates token expiration
 */
export const isTokenExpiredError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('unauthorized') || 
           msg.includes('unauthenticated') || 
           msg.includes('401') ||
           msg.includes('токен') ||
           msg.includes('сессия истекла');
  }
  return false;
};

/**
 * Logs token status for debugging
 */
export const logTokenStatus = (token: string | null, context: string = ''): void => {
  if (isDev) {
    logDev(`🔑 Token status ${context}:`, {
      present: !!token,
      length: token?.length || 0,
      preview: token ? `${token.substring(0, 20)}...` : 'none'
    });
  }
};








