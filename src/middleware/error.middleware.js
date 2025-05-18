/**
 * Error handling middleware
 * Catches errors and sends appropriate responses
 * 
 * Example incoming error:
 * new AppError('Contact not found', errorTypes.NOT_FOUND)
 * 
 * Example outgoing response:
 * {
 *   "error": {
 *     "message": "Contact not found",
 *     "type": "NOT_FOUND",
 *     "status": 404
 *   }
 * }
 */

const logger = require('../utils/logger');
const { AppError, errorTypes } = require('../utils/error-handler');

/**
 * Middleware to handle 404 errors for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, errorTypes.NOT_FOUND);
  next(error);
};

/**
 * Middleware to handle all errors
 */
const errorHandler = (err, req, res, next) => {
  // Default to internal server error
  let error = err;
  
  // If it's not an AppError, convert it
  if (!(error instanceof AppError)) {
    // For specific known errors, convert appropriately
    if (error.name === 'ValidationError') {
      error = new AppError(error.message, errorTypes.BAD_REQUEST, error.details);
    } else if (error.name === 'JsonWebTokenError') {
      error = new AppError('Invalid token', errorTypes.UNAUTHORIZED);
    } else if (error.name === 'TokenExpiredError') {
      error = new AppError('Token expired', errorTypes.UNAUTHORIZED);
    } else {
      // For unknown errors, create a generic error
      error = new AppError(error.message || 'Internal server error', errorTypes.INTERNAL_ERROR);
      
      // Log the original error for debugging
      logger.error('Unhandled error', err);
    }
  }
  
  // Send the error response
  res.status(error.status).json({
    error: {
      message: error.message,
      type: error.type,
      status: error.status,
      ...(process.env.NODE_ENV !== 'production' && error.details ? { details: error.details } : {})
    }
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
