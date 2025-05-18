/**
 * Error handling utilities
 * Provides consistent error handling throughout the application
 * 
 * Example usage:
 * const { AppError, errorTypes } = require('./utils/error-handler');
 * throw new AppError('Contact not found', errorTypes.NOT_FOUND);
 */

/**
 * Error types used throughout the application
 * These map to HTTP status codes
 */
const errorTypes = {
  BAD_REQUEST: 'BAD_REQUEST',        // 400
  UNAUTHORIZED: 'UNAUTHORIZED',      // 401
  FORBIDDEN: 'FORBIDDEN',            // 403
  NOT_FOUND: 'NOT_FOUND',            // 404
  CONFLICT: 'CONFLICT',              // 409
  RATE_LIMIT: 'RATE_LIMIT',          // 429
  INTERNAL_ERROR: 'INTERNAL_ERROR',  // 500
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE' // 503
};

/**
 * Map error types to HTTP status codes
 */
const errorStatusCodes = {
  [errorTypes.BAD_REQUEST]: 400,
  [errorTypes.UNAUTHORIZED]: 401,
  [errorTypes.FORBIDDEN]: 403,
  [errorTypes.NOT_FOUND]: 404,
  [errorTypes.CONFLICT]: 409,
  [errorTypes.RATE_LIMIT]: 429,
  [errorTypes.INTERNAL_ERROR]: 500,
  [errorTypes.SERVICE_UNAVAILABLE]: 503
};

/**
 * Custom application error class
 * @extends Error
 */
class AppError extends Error {
  /**
   * Create a new AppError
   * @param {string} message - Error message
   * @param {string} type - Error type from errorTypes
   * @param {Object} [details] - Additional error details
   * 
   * @example
   * // Incoming data: { id: 123 }
   * // Error: Contact with ID 123 not found
   * throw new AppError(`Contact with ID ${data.id} not found`, errorTypes.NOT_FOUND);
   */
  constructor(message, type = errorTypes.INTERNAL_ERROR, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    this.status = errorStatusCodes[type] || 500;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  AppError,
  errorTypes,
  errorStatusCodes
};
