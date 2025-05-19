/**
 * Redis Service
 * Provides methods for interacting with Redis
 * 
 * This service implements:
 * 1. Connection management with error handling and reconnection
 * 2. Separate namespaces for authentication and rate limiting
 * 3. Basic CRUD operations for ephemeral data
 * 4. TTL support for cached items
 * 5. JWT token management and rate limiting
 * 
 * Note: Contact storage has been moved to PostgreSQL
 */

const Redis = require('ioredis');
const redisConfig = require('../config/redis.config');
const logger = require('../utils/logger');
const { AppError, errorTypes } = require('../utils/error-handler');

// Redis client instance (singleton)
let redisClient = null;

/**
 * Redis Service class
 * Provides methods for interacting with Redis
 */
class RedisService {
  /**
   * Initialize Redis connection
   * @returns {Redis} Redis client instance
   */
  static getClient() {
    if (!redisClient) {
      redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        retryStrategy: redisConfig.retryStrategy,
        connectTimeout: redisConfig.connectTimeout,
        autoReconnect: redisConfig.autoReconnect
      });
      
      // Set up event listeners
      redisClient.on('connect', () => {
        logger.info('Connected to Redis');
      });
      
      redisClient.on('ready', () => {
        logger.info('Redis client ready');
      });
      
      redisClient.on('error', (err) => {
        logger.error('Redis error', err);
      });
      
      redisClient.on('close', () => {
        logger.warn('Redis connection closed');
      });
      
      redisClient.on('reconnecting', () => {
        logger.info('Reconnecting to Redis');
      });
    }
    
    return redisClient;
  }
  
  /**
   * Generate a key with the appropriate prefix
   * @param {string} prefix - Key prefix from redisConfig.keyPrefixes
   * @param {string} id - Unique identifier
   * @returns {string} Prefixed key
   */
  static generateKey(prefix, id) {
    if (!redisConfig.keyPrefixes[prefix]) {
      throw new AppError(`Invalid Redis key prefix: ${prefix}`, errorTypes.INTERNAL_ERROR);
    }
    return `${redisConfig.keyPrefixes[prefix]}${id}`;
  }
  
  /**
   * Store a value in Redis
   * @param {string} key - Redis key
   * @param {string|Object} value - Value to store (objects will be JSON stringified)
   * @param {number} [ttl] - Time-to-live in seconds (optional)
   * @returns {Promise<string>} "OK" if successful
   */
  static async set(key, value, ttl) {
    const client = this.getClient();
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    try {
      if (ttl) {
        return await client.set(key, stringValue, 'EX', ttl);
      } else {
        return await client.set(key, stringValue);
      }
    } catch (error) {
      logger.error(`Error setting Redis key ${key}`, error);
      throw new AppError('Failed to store data in Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Retrieve a value from Redis
   * @param {string} key - Redis key
   * @param {boolean} [parse=true] - Whether to parse JSON (default: true)
   * @returns {Promise<Object|string|null>} Retrieved value or null if not found
   */
  static async get(key, parse = true) {
    const client = this.getClient();
    
    try {
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }
      
      if (parse) {
        try {
          return JSON.parse(value);
        } catch (e) {
          // If not valid JSON, return as is
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error(`Error getting Redis key ${key}`, error);
      throw new AppError('Failed to retrieve data from Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Delete a value from Redis
   * @param {string} key - Redis key
   * @returns {Promise<number>} 1 if key was removed, 0 if key did not exist
   */
  static async del(key) {
    const client = this.getClient();
    
    try {
      return await client.del(key);
    } catch (error) {
      logger.error(`Error deleting Redis key ${key}`, error);
      throw new AppError('Failed to delete data from Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Check if a key exists in Redis
   * @param {string} key - Redis key
   * @returns {Promise<boolean>} True if key exists, false otherwise
   */
  static async exists(key) {
    const client = this.getClient();
    
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking if Redis key ${key} exists`, error);
      throw new AppError('Failed to check if key exists in Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Set a hash in Redis
   * @param {string} key - Redis key
   * @param {Object} hash - Hash to store
   * @param {number} [ttl] - Time-to-live in seconds (optional)
   * @returns {Promise<boolean>} True if successful
   */
  static async hmset(key, hash, ttl) {
    const client = this.getClient();
    
    try {
      await client.hmset(key, hash);
      
      if (ttl) {
        await client.expire(key, ttl);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error setting Redis hash ${key}`, error);
      throw new AppError('Failed to store hash in Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Get a hash from Redis
   * @param {string} key - Redis key
   * @returns {Promise<Object|null>} Hash as an object or null if not found
   */
  static async hgetall(key) {
    const client = this.getClient();
    
    try {
      const hash = await client.hgetall(key);
      
      if (!hash || Object.keys(hash).length === 0) {
        return null;
      }
      
      return hash;
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}`, error);
      throw new AppError('Failed to retrieve hash from Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Set a value in Redis with a TTL
   * @param {string} key - Redis key
   * @param {string|Object} value - Value to store
   * @param {number} ttl - Time-to-live in seconds
   * @returns {Promise<string>} "OK" if successful
   */
  static async setex(key, value, ttl) {
    return this.set(key, value, ttl);
  }
  
  /**
   * Set a value in Redis only if the key does not exist
   * @param {string} key - Redis key
   * @param {string|Object} value - Value to store
   * @param {number} [ttl] - Time-to-live in seconds (optional)
   * @returns {Promise<boolean>} True if set, false if key already exists
   */
  static async setnx(key, value, ttl) {
    const client = this.getClient();
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    try {
      const result = await client.setnx(key, stringValue);
      
      if (result === 1 && ttl) {
        await client.expire(key, ttl);
      }
      
      return result === 1;
    } catch (error) {
      logger.error(`Error setting Redis key ${key} if not exists`, error);
      throw new AppError('Failed to set value in Redis if not exists', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Get the TTL of a key in Redis
   * @param {string} key - Redis key
   * @returns {Promise<number>} TTL in seconds, -1 if no TTL, -2 if key does not exist
   */
  static async ttl(key) {
    const client = this.getClient();
    
    try {
      return await client.ttl(key);
    } catch (error) {
      logger.error(`Error getting TTL for Redis key ${key}`, error);
      throw new AppError('Failed to get TTL from Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Increment a value in Redis
   * @param {string} key - Redis key
   * @returns {Promise<number>} New value after increment
   */
  static async incr(key) {
    const client = this.getClient();
    
    try {
      return await client.incr(key);
    } catch (error) {
      logger.error(`Error incrementing Redis key ${key}`, error);
      throw new AppError('Failed to increment value in Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Store a JWT token in Redis
   * @param {string} tokenId - JWT token ID (jti)
   * @param {Object} tokenData - Token metadata
   * @param {number} ttl - Time-to-live in seconds
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: 
   *   tokenId: "123e4567-e89b-12d3-a456-426614174000"
   *   tokenData: {
   *     userId: "1",
   *     issuedAt: "1621234567",
   *     expiresAt: "1621238167",
   *     revoked: "false"
   *   }
   *   ttl: 3660
   * Output: true
   */
  static async storeToken(tokenId, tokenData, ttl) {
    const key = this.generateKey('acmeAuth', tokenId);
    return this.hmset(key, tokenData, ttl);
  }
  
  /**
   * Get JWT token data from Redis
   * @param {string} tokenId - JWT token ID (jti)
   * @returns {Promise<Object|null>} Token data or null if not found
   * 
   * Example:
   * Input: "123e4567-e89b-12d3-a456-426614174000"
   * Output: {
   *   userId: "1",
   *   issuedAt: "1621234567",
   *   expiresAt: "1621238167",
   *   revoked: "false"
   * }
   */
  static async getToken(tokenId) {
    const key = this.generateKey('acmeAuth', tokenId);
    return this.hgetall(key);
  }
  
  /**
   * Revoke a JWT token
   * @param {string} tokenId - JWT token ID (jti)
   * @param {Object} tokenData - Existing token data
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: 
   *   tokenId: "123e4567-e89b-12d3-a456-426614174000"
   *   tokenData: {
   *     userId: "1",
   *     issuedAt: "1621234567",
   *     expiresAt: "1621238167",
   *     revoked: "false"
   *   }
   * Output: true
   */
  static async revokeToken(tokenId, tokenData) {
    const key = this.generateKey('acmeAuth', tokenId);
    return this.hmset(key, { ...tokenData, revoked: 'true' });
  }
  
  /**
   * Track rate limit for a key
   * @param {string} key - Rate limit key
   * @param {number} windowSec - Time window in seconds
   * @returns {Promise<number>} Current count after increment
   * 
   * Example:
   * Input: 
   *   key: "ip:127.0.0.1"
   *   windowSec: 60
   * Output: 1
   */
  static async trackRateLimit(key, windowSec) {
    const rateLimitKey = this.generateKey('rateLimit', key);
    const count = await this.incr(rateLimitKey);
    
    // Set expiration only if this is the first request in the window
    if (count === 1) {
      const client = this.getClient();
      await client.expire(rateLimitKey, windowSec);
    }
    
    return count;
  }
  
  /**
   * Track rate limit violations
   * @param {string} key - Rate limit key
   * @param {number} ttl - Time-to-live in seconds
   * @returns {Promise<number>} Current violation count after increment
   * 
   * Example:
   * Input: 
   *   key: "ip:127.0.0.1"
   *   ttl: 3600
   * Output: 1
   */
  static async trackRateLimitViolation(key, ttl) {
    const violationsKey = this.generateKey('rateLimitViolations', key);
    const count = await this.incr(violationsKey);
    
    // Set expiration only if this is the first violation
    if (count === 1) {
      const client = this.getClient();
      await client.expire(violationsKey, ttl);
    }
    
    return count;
  }
  
  /**
   * Get current rate limit count
   * @param {string} key - Rate limit key
   * @returns {Promise<number>} Current count
   * 
   * Example:
   * Input: "ip:127.0.0.1"
   * Output: 5
   */
  static async getRateLimitCount(key) {
    const rateLimitKey = this.generateKey('rateLimit', key);
    const count = await this.get(rateLimitKey, false);
    return parseInt(count) || 0;
  }
  
  /**
   * Get current rate limit violation count
   * @param {string} key - Rate limit key
   * @returns {Promise<number>} Current violation count
   * 
   * Example:
   * Input: "ip:127.0.0.1"
   * Output: 2
   */
  static async getRateLimitViolationCount(key) {
    const violationsKey = this.generateKey('rateLimitViolations', key);
    const count = await this.get(violationsKey, false);
    return parseInt(count) || 0;
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async storeAcmeContact(id, contact, ttl) {
    logger.warn(`Redis.storeAcmeContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return 'OK';
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async getAcmeContact(id) {
    logger.warn(`Redis.getAcmeContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return null;
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async deleteAcmeContact(id) {
    logger.warn(`Redis.deleteAcmeContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return 0;
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async storeIntegrationContact(id, contact, ttl) {
    logger.warn(`Redis.storeIntegrationContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return 'OK';
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async getIntegrationContact(id) {
    logger.warn(`Redis.getIntegrationContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return null;
  }
  
  /**
   * @deprecated Use PostgreSQL storage adapter instead
   * Legacy method for backward compatibility
   */
  static async deleteIntegrationContact(id) {
    logger.warn(`Redis.deleteIntegrationContact is deprecated. Use PostgreSQL storage adapter instead. Called with ID: ${id}`);
    return 0;
  }
  
  /**
   * Close the Redis connection
   * @returns {Promise<void>}
   */
  static async close() {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    }
  }
}

module.exports = RedisService;
