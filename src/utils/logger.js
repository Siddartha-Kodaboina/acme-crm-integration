/**
 * Logger utility
 * Provides consistent logging throughout the application
 * 
 * Example usage:
 * const logger = require('./utils/logger');
 * logger.info('Server started on port 3000');
 * logger.error('Failed to connect to Redis', error);
 */

const logger = {
  /**
   * Log informational message
   * @param {string} message - The message to log
   * @param {Object} [data] - Optional data to include
   */
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  
  /**
   * Log warning message
   * @param {string} message - The warning message
   * @param {Object} [data] - Optional data to include
   */
  warn: (message, data) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  
  /**
   * Log error message
   * @param {string} message - The error message
   * @param {Error} [error] - Optional error object
   */
  error: (message, error) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  },
  
  /**
   * Log debug message (only in development)
   * @param {string} message - The debug message
   * @param {Object} [data] - Optional data to include
   */
  debug: (message, data) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ? data : '');
    }
  }
};

module.exports = logger;
