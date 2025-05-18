/**
 * Authentication Controller
 * Handles authentication-related requests
 * 
 * This controller implements:
 * 1. User login
 * 2. Token refresh
 * 3. User logout
 */

const AuthService = require('../services/auth.service');
const UserModel = require('../models/user.model');
const { AppError, errorTypes } = require('../utils/error-handler');
const logger = require('../utils/logger');

/**
 * Login a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 * 
 * Example request:
 * POST /mock-acme/auth/login
 * {
 *   "username": "admin@acmecrm.com",
 *   "password": "admin123"
 * }
 * 
 * Example response:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 3600,
 *   "user": {
 *     "id": "1",
 *     "username": "admin@acmecrm.com",
 *     "role": "admin"
 *   }
 * }
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    
    // Validate required fields
    if (!username || !password) {
      throw new AppError('Username and password are required', errorTypes.BAD_REQUEST);
    }
    
    // Validate credentials
    const user = UserModel.validateCredentials(username, password);
    if (!user) {
      throw new AppError('Invalid username or password', errorTypes.UNAUTHORIZED);
    }
    
    // Generate token
    const tokenData = await AuthService.generateToken(user);
    
    // Return token and user information
    res.json(tokenData);
    
    logger.info(`User ${user.id} logged in`);
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh a token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 * 
 * Example request:
 * POST /mock-acme/auth/refresh
 * Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * Example response:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 3600
 * }
 */
async function refreshToken(req, res, next) {
  try {
    // Extract token from request
    const token = AuthService.extractTokenFromRequest(req);
    
    if (!token) {
      throw new AppError('Authentication token is required', errorTypes.UNAUTHORIZED);
    }
    
    // Refresh token
    const newTokenData = await AuthService.refreshToken(token);
    
    // Return new token
    res.json(newTokenData);
    
    logger.info('Token refreshed');
  } catch (error) {
    next(error);
  }
}

/**
 * Logout a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 * 
 * Example request:
 * POST /mock-acme/auth/logout
 * Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * Example response:
 * {
 *   "message": "Logged out successfully"
 * }
 */
async function logout(req, res, next) {
  try {
    // Extract token from request
    const token = AuthService.extractTokenFromRequest(req);
    
    if (!token) {
      throw new AppError('Authentication token is required', errorTypes.UNAUTHORIZED);
    }
    
    // Verify token to get the JWT ID
    const decoded = await AuthService.verifyToken(token);
    
    // Revoke token
    await AuthService.revokeToken(decoded.jti);
    
    // Return success message
    res.json({ message: 'Logged out successfully' });
    
    logger.info(`User ${decoded.sub} logged out`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  refreshToken,
  logout
};
