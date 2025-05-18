/**
 * Error handling middleware
 * Catches errors and sends appropriate responses
 * 
 * Example incoming error:
 * new AppError('Contact not found', errorTypes.NOT_FOUND, {
 *   code: errorCodes.RESOURCE_NOT_FOUND,
 *   details: { resourceId: '123', resourceType: 'contact' }
 * })
 * 
 * Example outgoing response:
 * {
 *   "error": {
 *     "message": "Contact not found",
 *     "type": "NOT_FOUND",
 *     "code": "RESOURCE_NOT_FOUND",
 *     "status": 404,
 *     "timestamp": "2025-05-18T09:15:30.123Z",
 *     "details": {
 *       "resourceId": "123",
 *       "resourceType": "contact"
 *     }
 *   }
 * }
 */

const logger = require('../utils/logger');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique request ID if not already present
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requestIdMiddleware = (req, res, next) => {
  // Generate a unique request ID if not already set
  req.id = req.id || req.headers['x-request-id'] || uuidv4();
  
  // Add the request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

/**
 * Middleware to handle 404 errors for routes that don't exist
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, errorTypes.NOT_FOUND, {
    code: errorCodes.RESOURCE_NOT_FOUND,
    requestId: req.id,
    details: {
      method: req.method,
      path: req.originalUrl,
      availableMethods: req.route ? Object.keys(req.route.methods).map(m => m.toUpperCase()) : []
    }
  });
  next(error);
};

/**
 * Middleware to handle method not allowed errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const methodNotAllowedHandler = (req, res, next) => {
  if (req.route && !req.route.methods[req.method.toLowerCase()]) {
    const error = new AppError(`Method ${req.method} not allowed for ${req.originalUrl}`, errorTypes.METHOD_NOT_ALLOWED, {
      code: errorCodes.INVALID_INPUT,
      requestId: req.id,
      details: {
        method: req.method,
        path: req.originalUrl,
        allowedMethods: Object.keys(req.route.methods).map(m => m.toUpperCase())
      }
    });
    return next(error);
  }
  next();
};

/**
 * Middleware to handle all errors
 * @param {Error|AppError} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Default to internal server error
  let error = err;
  
  // If it's not an AppError, convert it
  if (!(error instanceof AppError)) {
    // For specific known errors, convert appropriately
    if (error.name === 'ValidationError') {
      error = new AppError(error.message, errorTypes.VALIDATION_ERROR, {
        code: errorCodes.INVALID_INPUT,
        requestId: req.id,
        source: 'validation',
        details: error.details || error
      });
    } else if (error.name === 'JsonWebTokenError') {
      error = new AppError('Invalid token', errorTypes.UNAUTHORIZED, {
        code: errorCodes.INVALID_TOKEN,
        requestId: req.id,
        source: 'authentication'
      });
    } else if (error.name === 'TokenExpiredError') {
      error = new AppError('Token expired', errorTypes.UNAUTHORIZED, {
        code: errorCodes.TOKEN_EXPIRED,
        requestId: req.id,
        source: 'authentication'
      });
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      error = new AppError('Service unavailable', errorTypes.SERVICE_UNAVAILABLE, {
        code: errorCodes.SERVICE_UNAVAILABLE,
        requestId: req.id,
        source: 'external_service',
        details: { originalError: error.message }
      });
    } else if (error.timeout || error.code === 'ETIMEDOUT') {
      error = new AppError('Request timeout', errorTypes.TIMEOUT_ERROR, {
        code: errorCodes.REQUEST_TIMEOUT,
        requestId: req.id,
        source: 'external_service',
        details: { originalError: error.message }
      });
    } else {
      // For unknown errors, create a generic error
      error = new AppError(error.message || 'Internal server error', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.INTERNAL_SERVER_ERROR,
        requestId: req.id,
        source: 'server'
      });
      
      // Log the original error for debugging
      logger.error('Unhandled error', {
        error: err,
        stack: err.stack,
        requestId: req.id,
        path: req.originalUrl,
        method: req.method
      });
    }
  } else {
    // If it's already an AppError, ensure it has a request ID
    if (!error.requestId && req.id) {
      error.requestId = req.id;
    }
  }
  
  // Add rate limit headers if applicable
  if (error.type === errorTypes.RATE_LIMIT && error.retryAfter) {
    res.setHeader('Retry-After', error.retryAfter);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + error.retryAfter * 1000).toISOString());
  }
  
  // Log the error
  if (error.status >= 500) {
    logger.error(`${error.status} error:`, {
      message: error.message,
      type: error.type,
      code: error.code,
      requestId: error.requestId,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.warn(`${error.status} error:`, {
      message: error.message,
      type: error.type,
      code: error.code,
      requestId: error.requestId,
      path: req.originalUrl,
      method: req.method
    });
  }
  
  // Send the error response using the AppError's toResponse method
  res.status(error.status).json(error.toResponse());
};

/**
 * Middleware to handle async errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * Example usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  requestIdMiddleware,
  notFoundHandler,
  methodNotAllowedHandler,
  errorHandler,
  asyncHandler
};
