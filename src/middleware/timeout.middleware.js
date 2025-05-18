/**
 * Timeout Middleware
 * Implements request timeout handling
 * 
 * This middleware:
 * 1. Sets a timeout for each request
 * 2. Aborts the request if it exceeds the timeout
 * 3. Sends a timeout response to the client
 */

const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');
const config = require('../config/app.config');

/**
 * Create a timeout middleware
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * // Set a 30 second timeout for all requests
 * app.use(timeout(30000));
 * 
 * // Set a 5 second timeout for a specific route
 * app.use('/api/contacts', timeout(5000));
 * 
 * Example incoming request:
 * GET /api/contacts
 * 
 * If the request takes longer than the specified timeout:
 * Response:
 * {
 *   "error": {
 *     "message": "Request timeout",
 *     "type": "TIMEOUT_ERROR",
 *     "code": "REQUEST_TIMEOUT",
 *     "status": 504,
 *     "timestamp": "2025-05-18T09:15:30.123Z"
 *   }
 * }
 */
function timeout(timeoutMs = 30000) {
  return (req, res, next) => {
    // Skip timeout in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    
    // Set a flag to track if the request has completed
    req.timedOut = false;
    
    // Create a timeout
    const timeoutId = setTimeout(() => {
      // Mark the request as timed out
      req.timedOut = true;
      
      // Log the timeout
      logger.warn('Request timeout', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timeoutMs,
        requestId: req.id
      });
      
      // Create a timeout error
      const error = new AppError('Request timeout', errorTypes.TIMEOUT_ERROR, {
        code: errorCodes.REQUEST_TIMEOUT,
        requestId: req.id,
        details: {
          path: req.originalUrl,
          method: req.method,
          timeoutMs
        }
      });
      
      // Send the error response
      res.status(error.status).json(error.toResponse());
    }, timeoutMs);
    
    // Clear the timeout when the response is sent
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });
    
    // Clear the timeout when the response is closed
    res.on('close', () => {
      clearTimeout(timeoutId);
    });
    
    // Continue to the next middleware
    next();
  };
}

/**
 * Create a timeout middleware with different timeouts for different endpoints
 * @param {Object} routeTimeouts - Map of route patterns to timeout values in milliseconds
 * @param {number} defaultTimeoutMs - Default timeout in milliseconds
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * // Set different timeouts for different routes
 * app.use(dynamicTimeout({
 *   '/api/contacts': 5000,
 *   '/api/webhooks': 60000,
 *   '/api/reports': 30000
 * }, 10000));
 */
function dynamicTimeout(routeTimeouts = {}, defaultTimeoutMs = 30000) {
  const routePatterns = Object.keys(routeTimeouts).map(pattern => ({
    regex: new RegExp(`^${pattern.replace(/\*/g, '.*')}$`),
    timeout: routeTimeouts[pattern]
  }));
  
  return (req, res, next) => {
    // Find matching route pattern
    const match = routePatterns.find(pattern => pattern.regex.test(req.path));
    
    // Use matching timeout or default
    const timeoutMs = match ? match.timeout : defaultTimeoutMs;
    
    // Apply timeout middleware
    return timeout(timeoutMs)(req, res, next);
  };
}

module.exports = {
  timeout,
  dynamicTimeout
};
