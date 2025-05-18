/**
 * Test file for Authentication service
 * Run with: node src/tests/auth.test.js
 */

const AuthService = require('../services/auth.service');
const UserModel = require('../models/user.model');
const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const config = require('../config/app.config');

/**
 * Simple test function to verify Authentication service is working
 */
async function testAuthService() {
  try {
    logger.info('Starting Authentication service test');
    
    // Test user login
    const testUser = {
      id: '1',
      username: 'admin@acmecrm.com',
      role: 'admin'
    };
    
    // Generate token
    logger.info('Generating token');
    const tokenData = await AuthService.generateToken(testUser);
    logger.info(`Token generated: ${tokenData.token.substring(0, 20)}...`);
    
    // Verify token
    logger.info('Verifying token');
    const decoded = await AuthService.verifyToken(tokenData.token);
    logger.info('Token verified', decoded);
    
    // Check if decoded token contains correct user information
    if (decoded.sub !== testUser.id || decoded.username !== testUser.username) {
      throw new Error('Token payload does not match user data');
    }
    
    // Refresh token
    logger.info('Refreshing token');
    const refreshedTokenData = await AuthService.refreshToken(tokenData.token);
    logger.info(`Refreshed token: ${refreshedTokenData.token.substring(0, 20)}...`);
    
    // Verify refreshed token
    logger.info('Verifying refreshed token');
    const decodedRefreshed = await AuthService.verifyToken(refreshedTokenData.token);
    logger.info('Refreshed token verified', decodedRefreshed);
    
    // Revoke token
    logger.info('Revoking token');
    await AuthService.revokeToken(decodedRefreshed.jti);
    
    // Try to verify revoked token (should fail)
    logger.info('Trying to verify revoked token (should fail)');
    try {
      await AuthService.verifyToken(refreshedTokenData.token);
      throw new Error('Revoked token verification should have failed');
    } catch (error) {
      logger.info('Revoked token verification failed as expected', error.message);
    }
    
    logger.info('Authentication service test completed successfully');
    
    // Close Redis connection
    await RedisService.close();
  } catch (error) {
    logger.error('Authentication service test failed', error);
    
    // Close Redis connection
    await RedisService.close();
    
    process.exit(1);
  }
}

// Run the test
testAuthService();
