/**
 * Redis Service
 * Provides methods for interacting with Redis
 * 
 * This service implements:
 * 1. Connection management with error handling and reconnection
 * 2. Separate namespaces for AcmeCRM and integration service data
 * 3. Basic CRUD operations for both data types
 * 4. TTL support for cached items
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
   * 
   * Example:
   * Input: 
   *   key: "acme:contact:123"
   *   value: { id: "123", acme_first_name: "John", acme_last_name: "Doe" }
   *   ttl: 3600
   * Output: "OK"
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
   * 
   * Example:
   * Input: 
   *   key: "acme:contact:123"
   *   parse: true
   * Output: { id: "123", acme_first_name: "John", acme_last_name: "Doe" }
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
   * 
   * Example:
   * Input: key: "acme:contact:123"
   * Output: 1
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
   * 
   * Example:
   * Input: key: "acme:contact:123"
   * Output: true
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
   * 
   * Example:
   * Input: 
   *   key: "acme:contact:123"
   *   hash: { acme_first_name: "John", acme_last_name: "Doe" }
   *   ttl: 3600
   * Output: true
   */
  static async hmset(key, hash, ttl) {
    const client = this.getClient();
    
    try {
      // Convert any nested objects to JSON strings
      const processedHash = {};
      for (const [field, value] of Object.entries(hash)) {
        processedHash[field] = typeof value === 'object' ? JSON.stringify(value) : value;
      }
      
      await client.hmset(key, processedHash);
      
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
   * @param {boolean} [parseValues=true] - Whether to parse JSON values (default: true)
   * @returns {Promise<Object|null>} Retrieved hash or null if not found
   * 
   * Example:
   * Input: 
   *   key: "acme:contact:123"
   *   parseValues: true
   * Output: { acme_first_name: "John", acme_last_name: "Doe" }
   */
  static async hgetall(key, parseValues = true) {
    const client = this.getClient();
    
    try {
      const hash = await client.hgetall(key);
      
      if (!hash || Object.keys(hash).length === 0) {
        return null;
      }
      
      if (parseValues) {
        // Try to parse any JSON string values
        for (const [field, value] of Object.entries(hash)) {
          try {
            hash[field] = JSON.parse(value);
          } catch (e) {
            // If not valid JSON, keep as is
          }
        }
      }
      
      return hash;
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}`, error);
      throw new AppError('Failed to retrieve hash from Redis', errorTypes.INTERNAL_ERROR);
    }
  }
  
  /**
   * Store an AcmeCRM contact
   * @param {string} id - Contact ID
   * @param {Object} contact - Contact data in AcmeCRM format
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: 
   *   id: "123"
   *   contact: { 
   *     acme_first_name: "John", 
   *     acme_last_name: "Doe",
   *     acme_email: "john.doe@example.com" 
   *   }
   * Output: true
   */
  static async storeAcmeContact(id, contact) {
    const key = this.generateKey('acmeContact', id);
    return await this.hmset(key, contact);
  }
  
  /**
   * Retrieve an AcmeCRM contact
   * @param {string} id - Contact ID
   * @returns {Promise<Object|null>} Contact data or null if not found
   * 
   * Example:
   * Input: id: "123"
   * Output: { 
   *   acme_first_name: "John", 
   *   acme_last_name: "Doe",
   *   acme_email: "john.doe@example.com" 
   * }
   */
  static async getAcmeContact(id) {
    const key = this.generateKey('acmeContact', id);
    return await this.hgetall(key);
  }
  
  /**
   * Delete an AcmeCRM contact
   * @param {string} id - Contact ID
   * @returns {Promise<boolean>} True if successful, false if contact did not exist
   * 
   * Example:
   * Input: id: "123"
   * Output: true
   */
  static async deleteAcmeContact(id) {
    const key = this.generateKey('acmeContact', id);
    const result = await this.del(key);
    return result === 1;
  }
  
  /**
   * Store an integration contact
   * @param {string} id - Contact ID
   * @param {Object} contact - Contact data in internal format
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: 
   *   id: "123"
   *   contact: { 
   *     firstName: "John", 
   *     lastName: "Doe",
   *     email: "john.doe@example.com" 
   *   }
   * Output: true
   */
  static async storeIntegrationContact(id, contact) {
    const key = this.generateKey('integrationContact', id);
    return await this.hmset(key, contact);
  }
  
  /**
   * Retrieve an integration contact
   * @param {string} id - Contact ID
   * @returns {Promise<Object|null>} Contact data or null if not found
   * 
   * Example:
   * Input: id: "123"
   * Output: { 
   *   firstName: "John", 
   *   lastName: "Doe",
   *   email: "john.doe@example.com" 
   * }
   */
  static async getIntegrationContact(id) {
    const key = this.generateKey('integrationContact', id);
    return await this.hgetall(key);
  }
  
  /**
   * Delete an integration contact
   * @param {string} id - Contact ID
   * @returns {Promise<boolean>} True if successful, false if contact did not exist
   * 
   * Example:
   * Input: id: "123"
   * Output: true
   */
  static async deleteIntegrationContact(id) {
    const key = this.generateKey('integrationContact', id);
    const result = await this.del(key);
    return result === 1;
  }
  
  /**
   * Store a cached item with TTL
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} [ttl] - Time-to-live in seconds (defaults to config value)
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: 
   *   key: "user:123:contacts"
   *   value: [{ id: "1", name: "Contact 1" }, { id: "2", name: "Contact 2" }]
   *   ttl: 300
   * Output: true
   */
  static async cache(key, value, ttl = redisConfig.ttl.cache) {
    const cacheKey = this.generateKey('integrationCache', key);
    await this.set(cacheKey, value, ttl);
    return true;
  }
  
  /**
   * Retrieve a cached item
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached value or null if not found/expired
   * 
   * Example:
   * Input: key: "user:123:contacts"
   * Output: [{ id: "1", name: "Contact 1" }, { id: "2", name: "Contact 2" }]
   */
  static async getCached(key) {
    const cacheKey = this.generateKey('integrationCache', key);
    return await this.get(cacheKey);
  }
  
  /**
   * Invalidate a cached item
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if successful
   * 
   * Example:
   * Input: key: "user:123:contacts"
   * Output: true
   */
  static async invalidateCache(key) {
    const cacheKey = this.generateKey('integrationCache', key);
    await this.del(cacheKey);
    return true;
  }
  
  /**
   * Close Redis connection
   * Should be called when shutting down the application
   */
  static async close() {
    if (redisClient) {
      logger.info('Closing Redis connection');
      await redisClient.quit();
      redisClient = null;
    }
  }
}

module.exports = RedisService;
