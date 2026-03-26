/**
 * Error logging utility for consistent error tracking and debugging
 * Development mode logs additional debug information
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log informational messages (dev mode only)
   */
  info: (...args: unknown[]) => {
    if (isDev) console.log('[INFO]', ...args);
  },

  /**
   * Log warning messages (always visible)
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Log error messages (always visible)
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log debug messages (dev mode only)
   */
  debug: (...args: unknown[]) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },
};
