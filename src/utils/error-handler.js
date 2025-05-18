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
  BAD_REQUEST: 'BAD_REQUEST',                // 400
  UNAUTHORIZED: 'UNAUTHORIZED',              // 401
  FORBIDDEN: 'FORBIDDEN',                    // 403
  NOT_FOUND: 'NOT_FOUND',                    // 404
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',  // 405
  CONFLICT: 'CONFLICT',                      // 409
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY', // 422
  RATE_LIMIT: 'RATE_LIMIT',                  // 429
  INTERNAL_ERROR: 'INTERNAL_ERROR',          // 500
  BAD_GATEWAY: 'BAD_GATEWAY',                // 502
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE', // 503
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',        // 504
  VALIDATION_ERROR: 'VALIDATION_ERROR',      // 400 (specialized)
  DATABASE_ERROR: 'DATABASE_ERROR',          // 500 (specialized)
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',  // 502 (specialized)
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'             // 504 (specialized)
};

/**
 * Map error types to HTTP status codes
 */
const errorStatusCodes = {
  [errorTypes.BAD_REQUEST]: 400,
  [errorTypes.UNAUTHORIZED]: 401,
  [errorTypes.FORBIDDEN]: 403,
  [errorTypes.NOT_FOUND]: 404,
  [errorTypes.METHOD_NOT_ALLOWED]: 405,
  [errorTypes.CONFLICT]: 409,
  [errorTypes.UNPROCESSABLE_ENTITY]: 422,
  [errorTypes.RATE_LIMIT]: 429,
  [errorTypes.INTERNAL_ERROR]: 500,
  [errorTypes.BAD_GATEWAY]: 502,
  [errorTypes.SERVICE_UNAVAILABLE]: 503,
  [errorTypes.GATEWAY_TIMEOUT]: 504,
  [errorTypes.VALIDATION_ERROR]: 400,
  [errorTypes.DATABASE_ERROR]: 500,
  [errorTypes.EXTERNAL_API_ERROR]: 502,
  [errorTypes.TIMEOUT_ERROR]: 504
};

/**
 * Error codes for more specific error identification
 */
const errorCodes = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Authentication/Authorization errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  
  // Rate limiting errors
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  EXTERNAL_SERVICE_TIMEOUT: 'EXTERNAL_SERVICE_TIMEOUT',
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  
  // Database errors
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_ERROR: 'DATABASE_CONSTRAINT_ERROR',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT'
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
   * @param {Object} [options] - Additional error options
   * @param {string} [options.code] - Specific error code from errorCodes
   * @param {Object} [options.details] - Additional error details
   * @param {number} [options.retryAfter] - Seconds to wait before retrying (for rate limit errors)
   * @param {string} [options.requestId] - Unique request ID for tracking
   * @param {string} [options.source] - Error source (e.g., 'database', 'api', 'validation')
   * 
   * @example
   * // Incoming data: { id: 123 }
   * // Error: Contact with ID 123 not found
   * throw new AppError(`Contact with ID ${data.id} not found`, errorTypes.NOT_FOUND, {
   *   code: errorCodes.RESOURCE_NOT_FOUND,
   *   details: { resourceId: data.id, resourceType: 'contact' }
   * });
   * 
   * @example
   * // Rate limit error with retry information
   * throw new AppError('Rate limit exceeded', errorTypes.RATE_LIMIT, {
   *   code: errorCodes.TOO_MANY_REQUESTS,
   *   retryAfter: 30,
   *   details: { limit: 100, remaining: 0, resetAt: '2025-05-18T10:15:00Z' }
   * });
   */
  constructor(message, type = errorTypes.INTERNAL_ERROR, options = {}) {
    super(message);
    
    const { code, details, retryAfter, requestId, source } = options;
    
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
    this.requestId = requestId;
    this.source = source;
    this.status = errorStatusCodes[type] || 500;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert the error to a response object
   * @param {boolean} includeDetails - Whether to include details in the response
   * @returns {Object} Response object
   */
  toResponse(includeDetails = process.env.NODE_ENV !== 'production') {
    const response = {
      error: {
        message: this.message,
        type: this.type,
        status: this.status,
        timestamp: this.timestamp
      }
    };
    
    if (this.code) {
      response.error.code = this.code;
    }
    
    if (this.requestId) {
      response.error.requestId = this.requestId;
    }
    
    if (this.retryAfter) {
      response.error.retryAfter = this.retryAfter;
    }
    
    if (includeDetails && this.details) {
      response.error.details = this.details;
    }
    
    if (includeDetails && this.source) {
      response.error.source = this.source;
    }
    
    return response;
  }
}

module.exports = {
  AppError,
  errorTypes,
  errorCodes,
  errorStatusCodes
};
