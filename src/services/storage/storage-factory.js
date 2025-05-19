/**
 * Storage Factory
 * Creates and provides storage adapters based on configuration
 * 
 * This module allows the application to switch between different storage backends
 * (Redis, PostgreSQL, etc.) based on configuration or environment variables.
 */

const config = require('../../config/app.config');
const RedisAdapter = require('./redis-adapter');
const PostgresAdapter = require('./postgres-adapter');
const logger = require('../../utils/logger');

// Default storage type
const DEFAULT_STORAGE_TYPE = 'postgres';

/**
 * Storage Factory class
 * Creates and provides storage adapters
 */
class StorageFactory {
  /**
   * Get a storage adapter based on configuration
   * @param {string} [type] - Storage type ('redis', 'postgres')
   * @returns {Object} Storage adapter instance
   * 
   * Example:
   * Input: type: "postgres"
   * Output: PostgresAdapter instance
   */
  static getAdapter(type = null) {
    // Use provided type, environment variable, or default
    const storageType = type || process.env.STORAGE_TYPE || DEFAULT_STORAGE_TYPE;
    
    logger.info(`Creating storage adapter of type: ${storageType}`);
    
    switch (storageType.toLowerCase()) {
      case 'redis':
        return new RedisAdapter();
      case 'postgres':
        return new PostgresAdapter();
      default:
        logger.warn(`Unknown storage type: ${storageType}, using default: ${DEFAULT_STORAGE_TYPE}`);
        return new PostgresAdapter();
    }
  }
}

module.exports = StorageFactory;
