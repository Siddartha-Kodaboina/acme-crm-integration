/**
 * Test file for Error Handling and Rate Limiting
 * Run with: node src/tests/error-handling.test.js
 */

const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const { calculateBackoff } = require('../middleware/rate-limit.middleware');
const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');

/**
 * Simple test function to verify Error Handling and Rate Limiting
 */
async function testErrorHandling() {
  try {
    logger.info('Starting Error Handling and Rate Limiting test');
    
    // Test 1: Create and format a basic error
    logger.info('Test 1: Basic error creation and formatting');
    const basicError = new AppError('Resource not found', errorTypes.NOT_FOUND, {
      code: errorCodes.RESOURCE_NOT_FOUND,
      details: { resourceId: '123', resourceType: 'contact' }
    });
    
    logger.info('Basic error created:', {
      message: basicError.message,
      type: basicError.type,
      code: basicError.code,
      status: basicError.status
    });
    
    const errorResponse = basicError.toResponse(true);
    logger.info('Error response format:', JSON.stringify(errorResponse, null, 2));
    
    // Test 2: Test rate limit error with retry information
    logger.info('\nTest 2: Rate limit error with retry information');
    const rateLimitError = new AppError('Rate limit exceeded', errorTypes.RATE_LIMIT, {
      code: errorCodes.TOO_MANY_REQUESTS,
      retryAfter: 30,
      details: { limit: 100, remaining: 0, resetAt: new Date(Date.now() + 30000).toISOString() }
    });
    
    logger.info('Rate limit error created:', {
      message: rateLimitError.message,
      type: rateLimitError.type,
      code: rateLimitError.code,
      status: rateLimitError.status,
      retryAfter: rateLimitError.retryAfter
    });
    
    const rateLimitResponse = rateLimitError.toResponse(true);
    logger.info('Rate limit error response format:', JSON.stringify(rateLimitResponse, null, 2));
    
    // Test 3: Test exponential backoff calculation
    logger.info('\nTest 3: Exponential backoff calculation');
    const baseTime = 5; // 5 seconds
    const maxTime = 3600; // 1 hour
    
    for (let attempts = 1; attempts <= 10; attempts++) {
      const backoff = calculateBackoff(attempts, baseTime, maxTime);
      logger.info(`Backoff for attempt ${attempts}: ${backoff} seconds`);
    }
    
    // Test 4: Test Redis rate limiting key generation and storage
    logger.info('\nTest 4: Redis rate limiting key generation and storage');
    
    // Get Redis client (this automatically connects)
    logger.info('Getting Redis client...');
    const redisClient = RedisService.getClient();
    logger.info('Redis client obtained');
    
    // Generate a test rate limit key
    const testIp = '127.0.0.1';
    const rateLimitKey = RedisService.generateKey('rateLimit', `ip:${testIp}`);
    logger.info(`Generated rate limit key: ${rateLimitKey}`);
    
    // Store a test count
    await RedisService.set(rateLimitKey, 1, 60);
    logger.info('Stored test count in Redis');
    
    // Retrieve the count
    const count = await RedisService.get(rateLimitKey);
    logger.info(`Retrieved count from Redis: ${count}`);
    
    // Get TTL (using the Redis client directly)
    const ttl = await redisClient.ttl(rateLimitKey);
    logger.info(`TTL for rate limit key: ${ttl} seconds`);
    
    // Clean up
    await RedisService.del(rateLimitKey);
    logger.info('Cleaned up test data');
    
    logger.info('\nError Handling and Rate Limiting test completed successfully');
    
    // Close Redis connection
    logger.info('Closing Redis connection...');
    await RedisService.close();
  } catch (error) {
    logger.error('Error Handling and Rate Limiting test failed', error);
    
    // Close Redis connection
    try {
      logger.info('Attempting to close Redis connection...');
      await RedisService.close();
    } catch (closeError) {
      logger.warn('Error closing Redis connection', closeError);
    }
    
    process.exit(1);
  }
}

// Run the test
testErrorHandling();
