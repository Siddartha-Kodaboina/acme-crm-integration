/**
 * Rate Limiting Middleware
 * Implements rate limiting with Redis and exponential backoff
 * 
 * This middleware:
 * 1. Tracks request counts by IP, user ID, or custom key
 * 2. Enforces configurable rate limits
 * 3. Provides exponential backoff for repeated violations
 * 4. Adds rate limit headers to responses
 */

const RedisService = require('../services/redis.service');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');
const config = require('../config/app.config');

/**
 * Calculate exponential backoff time
 * @param {number} attempts - Number of rate limit violations
 * @param {number} baseTime - Base time in seconds
 * @param {number} maxTime - Maximum backoff time in seconds
 * @returns {number} Backoff time in seconds
 * 
 * Example:
 * Input: attempts=1, baseTime=5, maxTime=3600
 * Output: 5 (5 * 2^0)
 * 
 * Input: attempts=2, baseTime=5, maxTime=3600
 * Output: 10 (5 * 2^1)
 * 
 * Input: attempts=3, baseTime=5, maxTime=3600
 * Output: 20 (5 * 2^2)
 */
function calculateBackoff(attempts, baseTime = 5, maxTime = 3600) {
  const backoff = baseTime * Math.pow(2, attempts - 1);
  return Math.min(backoff, maxTime);
}

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.limit - Maximum number of requests allowed in window
 * @param {number} options.windowSec - Time window in seconds
 * @param {Function} [options.keyGenerator] - Function to generate rate limit key from request
 * @param {number} [options.baseBackoffSec] - Base backoff time in seconds
 * @param {number} [options.maxBackoffSec] - Maximum backoff time in seconds
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * // Limit to 100 requests per minute by IP
 * app.use(rateLimiter({ limit: 100, windowSec: 60 }));
 * 
 * // Limit to 10 requests per second for a specific endpoint
 * app.use('/api/contacts', rateLimiter({ limit: 10, windowSec: 1 }));
 * 
 * // Custom key generator for user-based rate limiting
 * app.use(rateLimiter({
 *   limit: 1000,
 *   windowSec: 3600,
 *   keyGenerator: (req) => req.user ? `user:${req.user.id}` : `ip:${req.ip}`
 * }));
 */
function rateLimiter(options) {
  const {
    limit = 100,
    windowSec = 60,
    keyGenerator = (req) => `ip:${req.ip}`,
    baseBackoffSec = 5,
    maxBackoffSec = 3600
  } = options;

  return async (req, res, next) => {
    try {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
        return next();
      }

      // Generate rate limit key
      const key = keyGenerator(req);
      
      // Get current count and violations
      const [currentCount, violationCount] = await Promise.all([
        RedisService.getRateLimitCount(key),
        RedisService.getRateLimitViolationCount(key)
      ]);

      // Check if rate limit exceeded
      if (currentCount >= limit) {
        // Calculate backoff time
        const retryAfter = calculateBackoff(
          violationCount + 1,
          baseBackoffSec,
          maxBackoffSec
        );

        // Track violation
        await RedisService.trackRateLimitViolation(key, 24 * 60 * 60); // 24 hours TTL

        // Calculate reset time
        const resetTime = new Date(Date.now() + windowSec * 1000).toISOString();

        // Log rate limit violation
        logger.warn('Rate limit exceeded', {
          key,
          limit,
          current: currentCount,
          violations: violationCount + 1,
          retryAfter,
          requestId: req.id,
          path: req.originalUrl,
          method: req.method,
          ip: req.ip
        });

        // Throw rate limit error
        throw new AppError('Rate limit exceeded', errorTypes.RATE_LIMIT, {
          code: errorCodes.TOO_MANY_REQUESTS,
          retryAfter,
          requestId: req.id,
          details: {
            limit,
            current: currentCount,
            windowSec,
            resetAt: resetTime
          }
        });
      }

      // Track request
      await RedisService.trackRateLimit(key, windowSec);

      // Get the new TTL
      const rateLimitKey = RedisService.generateKey('rateLimit', key);
      const ttl = await RedisService.ttl(rateLimitKey);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - (currentCount + 1)));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create a rate limiter middleware for authenticated routes
 * Uses user ID as the rate limit key
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * // Limit authenticated users to 1000 requests per hour
 * router.use(authRateLimiter({ limit: 1000, windowSec: 3600 }));
 */
function authRateLimiter(options) {
  return rateLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    }
  });
}

/**
 * Create a rate limiter middleware for API endpoints
 * Uses a combination of endpoint path and IP as the rate limit key
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware
 * 
 * Example usage:
 * // Limit each API endpoint to 10 requests per second per IP
 * router.use('/api', apiRateLimiter({ limit: 10, windowSec: 1 }));
 */
function apiRateLimiter(options) {
  return rateLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use endpoint path and IP
      const path = req.path.replace(/\/[0-9a-f]{24}(\/|$)/g, '/:id$1');
      return `${req.method}:${path}:${req.ip}`;
    }
  });
}

module.exports = {
  rateLimiter,
  authRateLimiter,
  apiRateLimiter,
  calculateBackoff
};
