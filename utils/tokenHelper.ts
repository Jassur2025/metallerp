/**
 * Helper functions for managing access tokens
 */

/**
 * Validates if access token is present and not empty
 */
export const validateAccessToken = (token: string | null | undefined): boolean => {
  if (!token) {
    console.warn('⚠️ Access token is missing');
    return false;
  }
  
  if (typeof token !== 'string' || token.trim().length === 0) {
    console.warn('⚠️ Access token is invalid (empty string)');
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
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔑 Token status ${context}:`, {
      present: !!token,
      length: token?.length || 0,
      preview: token ? `${token.substring(0, 20)}...` : 'none'
    });
  }
};




