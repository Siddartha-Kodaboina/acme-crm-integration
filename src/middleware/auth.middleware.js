/**
 * Authentication Middleware
 * Provides middleware for protecting routes with JWT authentication
 * 
 * This middleware:
 * 1. Extracts JWT token from request
 * 2. Verifies the token
 * 3. Attaches user information to the request
 * 4. Handles authentication errors
 */

const AuthService = require('../services/auth.service');
const { AppError, errorTypes } = require('../utils/error-handler');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate requests using JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 * 
 * Example incoming request:
 * {
 *   headers: {
 *     authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   }
 * }
 * 
 * After middleware execution, req will have:
 * {
 *   user: {
 *     id: "1",
 *     username: "admin@acmecrm.com",
 *     role: "admin"
 *   }
 * }
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from request
    const token = AuthService.extractTokenFromRequest(req);
    
    if (!token) {
      throw new AppError('Authentication token is required', errorTypes.UNAUTHORIZED);
    }
    
    // Verify token
    const decoded = await AuthService.verifyToken(token);
    
    // Attach user information to request
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role
    };
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Authentication error', error);
      next(new AppError('Authentication failed', errorTypes.UNAUTHORIZED));
    }
  }
}

/**
 * Middleware to check if user has required role
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * router.get('/admin-only', authenticate, requireRole('admin'), (req, res) => {...});
 * 
 * Example incoming request after authenticate middleware:
 * {
 *   user: {
 *     id: "1",
 *     username: "admin@acmecrm.com",
 *     role: "admin"
 *   }
 * }
 */
function requireRole(roles) {
  // Convert single role to array
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    // Check if user exists and has required role
    if (!req.user) {
      return next(new AppError('Authentication required', errorTypes.UNAUTHORIZED));
    }
    
    if (!requiredRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', errorTypes.FORBIDDEN));
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
