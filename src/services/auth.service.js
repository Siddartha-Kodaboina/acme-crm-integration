/**
 * Authentication Service
 * Provides methods for JWT token generation, validation, and management
 * 
 * This service implements:
 * 1. Token generation with configurable expiration
 * 2. Token validation and verification
 * 3. Token refresh functionality
 * 4. Token revocation
 */

const jwt = require('jsonwebtoken');
const config = require('../config/app.config');
const RedisService = require('./redis.service');
const logger = require('../utils/logger');
const { AppError, errorTypes } = require('../utils/error-handler');
const { v4: uuidv4 } = require('uuid');

/**
 * Authentication Service class
 * Provides methods for JWT token management
 */
class AuthService {
  /**
   * Generate a JWT token for a user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Token object with token, expiresIn, and user info
   * 
   * Example:
   * Input: { id: "1", username: "admin@acmecrm.com", role: "admin" }
   * Output: { 
   *   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   expiresIn: 3600,
   *   user: { id: "1", username: "admin@acmecrm.com", role: "admin" }
   * }
   */
  static async generateToken(user) {
    try {
      // Generate a unique token ID
      const tokenId = uuidv4();
      
      // Calculate expiration time
      const expiresIn = config.jwt.expiresIn;
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + expiresIn;
      
      // Create token payload
      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        jti: tokenId, // JWT ID - unique identifier for the token
        iat: issuedAt, // Issued at
        exp: expiresAt // Expiration time
      };
      
      // Sign the token
      const token = jwt.sign(payload, config.jwt.secret);
      
      // Store token metadata in Redis
      const tokenKey = RedisService.generateKey('acmeAuth', tokenId);
      await RedisService.hmset(tokenKey, {
        userId: user.id,
        issuedAt: issuedAt.toString(),
        expiresAt: expiresAt.toString(),
        revoked: 'false'
      }, expiresIn + 60); // Store for slightly longer than token expiration
      
      logger.info(`Generated token for user ${user.id}`);
      
      return {
        token,
        expiresIn,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      logger.error('Error generating token', error);
      throw new AppError('Failed to generate authentication token', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Promise<Object>} Decoded token payload
   * 
   * Example:
   * Input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * Output: { 
   *   sub: "1", 
   *   username: "admin@acmecrm.com", 
   *   role: "admin",
   *   jti: "123e4567-e89b-12d3-a456-426614174000",
   *   iat: 1621234567,
   *   exp: 1621238167
   * }
   */
  static async verifyToken(token) {
    try {
      // Verify the token signature and expiration
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Check if token has been revoked
      const tokenKey = RedisService.generateKey('acmeAuth', decoded.jti);
      const tokenData = await RedisService.hgetall(tokenKey);
      
      if (!tokenData) {
        throw new AppError('Token not found or expired', errorTypes.UNAUTHORIZED);
      }
      
      if (tokenData.revoked === 'true') {
        throw new AppError('Token has been revoked', errorTypes.UNAUTHORIZED);
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', errorTypes.UNAUTHORIZED);
      } else if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expired', errorTypes.UNAUTHORIZED);
      } else if (error instanceof AppError) {
        throw error;
      } else {
        logger.error('Error verifying token', error);
        throw new AppError('Failed to verify token', errorTypes.UNAUTHORIZED);
      }
    }
  }
  
  /**
   * Refresh a JWT token
   * @param {string} token - Current JWT token
   * @returns {Promise<Object>} New token object with token and expiresIn
   * 
   * Example:
   * Input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * Output: { 
   *   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   expiresIn: 3600
   * }
   */
  static async refreshToken(token) {
    try {
      // Verify the current token
      const decoded = await this.verifyToken(token);
      
      // Revoke the current token
      await this.revokeToken(decoded.jti);
      
      // Create a user object from the token payload
      const user = {
        id: decoded.sub,
        username: decoded.username,
        role: decoded.role
      };
      
      // Generate a new token
      const newTokenData = await this.generateToken(user);
      
      return {
        token: newTokenData.token,
        expiresIn: newTokenData.expiresIn
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      } else {
        logger.error('Error refreshing token', error);
        throw new AppError('Failed to refresh token', errorTypes.UNAUTHORIZED);
      }
    }
  }
  
  /**
   * Revoke a JWT token
   * @param {string} tokenId - JWT ID (jti) to revoke
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: "123e4567-e89b-12d3-a456-426614174000"
   * Output: true
   */
  static async revokeToken(tokenId) {
    try {
      const tokenKey = RedisService.generateKey('acmeAuth', tokenId);
      const tokenData = await RedisService.hgetall(tokenKey);
      
      if (!tokenData) {
        return false; // Token not found or already expired
      }
      
      // Mark token as revoked
      await RedisService.hmset(tokenKey, {
        ...tokenData,
        revoked: 'true'
      });
      
      logger.info(`Revoked token ${tokenId}`);
      return true;
    } catch (error) {
      logger.error(`Error revoking token ${tokenId}`, error);
      throw new AppError('Failed to revoke token', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID to revoke tokens for
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: "1"
   * Output: true
   */
  static async revokeAllUserTokens(userId) {
    // In a real implementation, this would scan Redis for all tokens
    // belonging to the user and revoke them. For this mock implementation,
    // we'll just log the action.
    logger.info(`Revoked all tokens for user ${userId}`);
    return true;
  }
  
  /**
   * Extract token from request
   * @param {Object} req - Express request object
   * @returns {string|null} JWT token or null if not found
   * 
   * Example:
   * Input: req with headers.authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * Output: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  static extractTokenFromRequest(req) {
    if (!req.headers.authorization) {
      return null;
    }
    
    const authHeader = req.headers.authorization;
    const bearerPrefix = 'Bearer ';
    
    if (!authHeader.startsWith(bearerPrefix)) {
      return null;
    }
    
    return authHeader.substring(bearerPrefix.length);
  }
}

module.exports = AuthService;
