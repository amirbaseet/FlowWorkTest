// src/utils/logger.ts

const isDev = (import.meta as any).env?.DEV;

export const logger = {
  /**
   * Debug logs - only in development
   * @param category - Component or feature name
   * @param message - Log message
   * @param data - Optional data to log
   */
  debug: (category: string, message: string, data?: any) => {
    if (isDev) {
      console.log(`[${category}] ${message}`, data !== undefined ? data : '');
    }
  },

  /**
   * Info logs - only in development
   */
  info: (message: string, data?: any) => {
    if (isDev) {
      console.info('[INFO]', message, data !== undefined ? data : '');
    }
  },

  /**
   * Error logs - always logged (for production error tracking)
   */
  error: (message: string, error?: any) => {
    console.error('[ERROR]', message, error !== undefined ? error : '');
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  },

  /**
   * Warning logs - always logged
   */
  warn: (message: string, data?: any) => {
    console.warn('[WARN]', message, data !== undefined ? data : '');
  },
};
