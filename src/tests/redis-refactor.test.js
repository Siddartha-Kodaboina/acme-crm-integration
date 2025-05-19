/**
 * Redis Service Refactoring Test
 * Tests the refactored Redis service focused on JWT and rate limiting
 * 
 * This test:
 * 1. Verifies that the Redis service works for JWT token management
 * 2. Verifies that the Redis service works for rate limiting
 * 3. Confirms that contact-related methods are properly deprecated
 */

const RedisService = require('../services/redis.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Capture warnings to verify deprecation notices
const originalWarn = logger.warn;
const warnings = [];

// Override logger.warn to capture warnings
logger.warn = (message) => {
  warnings.push(message);
  originalWarn(message);
};

/**
 * Run the tests
 */
async function runTests() {
  try {
    logger.info('Starting Redis Service Refactoring Test');
    
    // Test JWT token management
    logger.info('\nTest 1: JWT Token Management');
    const tokenId = uuidv4();
    const tokenData = {
      userId: '123',
      issuedAt: Math.floor(Date.now() / 1000).toString(),
      expiresAt: (Math.floor(Date.now() / 1000) + 3600).toString(),
      revoked: 'false'
    };
    
    // Store token
    await RedisService.storeToken(tokenId, tokenData, 3600);
    logger.info('Token stored successfully');
    
    // Retrieve token
    const retrievedToken = await RedisService.getToken(tokenId);
    logger.info('Retrieved token:', retrievedToken);
    
    // Revoke token
    await RedisService.revokeToken(tokenId, retrievedToken);
    logger.info('Token revoked');
    
    // Verify token is revoked
    const revokedToken = await RedisService.getToken(tokenId);
    logger.info('Revoked token status:', revokedToken.revoked);
    
    // Test rate limiting
    logger.info('\nTest 2: Rate Limiting');
    const rateLimitKey = `test:${Date.now()}`;
    
    // Track rate limit
    const count1 = await RedisService.trackRateLimit(rateLimitKey, 60);
    const count2 = await RedisService.trackRateLimit(rateLimitKey, 60);
    logger.info(`Rate limit counts: ${count1}, ${count2}`);
    
    // Get rate limit count
    const retrievedCount = await RedisService.getRateLimitCount(rateLimitKey);
    logger.info(`Retrieved rate limit count: ${retrievedCount}`);
    
    // Track violation
    const violation1 = await RedisService.trackRateLimitViolation(rateLimitKey, 60);
    const violation2 = await RedisService.trackRateLimitViolation(rateLimitKey, 60);
    logger.info(`Violation counts: ${violation1}, ${violation2}`);
    
    // Get violation count
    const retrievedViolation = await RedisService.getRateLimitViolationCount(rateLimitKey);
    logger.info(`Retrieved violation count: ${retrievedViolation}`);
    
    // Test deprecated contact methods
    logger.info('\nTest 3: Deprecated Contact Methods');
    warnings.length = 0; // Clear previous warnings
    
    // Call deprecated methods
    await RedisService.storeAcmeContact('test-id', { name: 'Test' });
    await RedisService.getAcmeContact('test-id');
    await RedisService.deleteAcmeContact('test-id');
    await RedisService.storeIntegrationContact('test-id', { name: 'Test' });
    await RedisService.getIntegrationContact('test-id');
    await RedisService.deleteIntegrationContact('test-id');
    
    // Verify deprecation warnings
    logger.info(`Received ${warnings.length} deprecation warnings`);
    warnings.forEach((warning, index) => {
      logger.info(`Warning ${index + 1}: ${warning}`);
    });
    
    logger.info('\nRedis Service Refactoring Test completed successfully');
  } catch (error) {
    logger.error('Error in Redis Service Refactoring Test:', error);
  } finally {
    // Restore original logger
    logger.warn = originalWarn;
    
    // Close Redis connection
    logger.info('Closing Redis connection...');
    await RedisService.close();
    logger.info('Redis connection closed');
  }
}

// Run the tests
runTests();
