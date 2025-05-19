/**
 * Auth Service with Refactored Redis Test
 * Tests the auth service with the refactored Redis service
 * 
 * This test:
 * 1. Verifies that token generation works with the refactored Redis service
 * 2. Verifies that token verification works
 * 3. Verifies that token revocation works
 * 4. Verifies that token refresh works
 */

const AuthService = require('../services/auth.service');
const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');

/**
 * Run the tests
 */
async function runTests() {
  try {
    logger.info('Starting Auth Service with Refactored Redis Test');
    
    // Test user
    const testUser = {
      id: 'test-user-123',
      username: 'test@example.com',
      role: 'user'
    };
    
    // Test token generation
    logger.info('\nTest 1: Token Generation');
    const tokenData = await AuthService.generateToken(testUser);
    logger.info('Token generated successfully:', {
      token: tokenData.token.substring(0, 20) + '...',
      expiresIn: tokenData.expiresIn,
      user: tokenData.user
    });
    
    // Test token verification
    logger.info('\nTest 2: Token Verification');
    const decodedToken = await AuthService.verifyToken(tokenData.token);
    logger.info('Token verified successfully:', {
      sub: decodedToken.sub,
      username: decodedToken.username,
      role: decodedToken.role,
      jti: decodedToken.jti
    });
    
    // Test token refresh
    logger.info('\nTest 3: Token Refresh');
    const refreshedToken = await AuthService.refreshToken(tokenData.token);
    logger.info('Token refreshed successfully:', {
      token: refreshedToken.token.substring(0, 20) + '...',
      expiresIn: refreshedToken.expiresIn
    });
    
    // Verify the original token is revoked
    logger.info('\nTest 4: Original Token Revocation');
    try {
      await AuthService.verifyToken(tokenData.token);
      logger.error('ERROR: Original token should be revoked');
    } catch (error) {
      logger.info('Original token correctly rejected:', error.message);
    }
    
    // Test token revocation
    logger.info('\nTest 5: Token Revocation');
    const decodedRefreshedToken = await AuthService.verifyToken(refreshedToken.token);
    const revoked = await AuthService.revokeToken(decodedRefreshedToken.jti);
    logger.info(`Token revocation result: ${revoked}`);
    
    // Verify the revoked token is rejected
    logger.info('\nTest 6: Revoked Token Verification');
    try {
      await AuthService.verifyToken(refreshedToken.token);
      logger.error('ERROR: Revoked token should be rejected');
    } catch (error) {
      logger.info('Revoked token correctly rejected:', error.message);
    }
    
    logger.info('\nAuth Service with Refactored Redis Test completed successfully');
  } catch (error) {
    logger.error('Error in Auth Service with Refactored Redis Test:', error);
  } finally {
    // Close Redis connection
    logger.info('Closing Redis connection...');
    await RedisService.close();
    logger.info('Redis connection closed');
  }
}

// Run the tests
runTests();
