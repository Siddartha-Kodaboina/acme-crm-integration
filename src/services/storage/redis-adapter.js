/**
 * Redis Storage Adapter
 * Implements the storage adapter interface for Redis
 * 
 * This adapter uses the Redis service to store and retrieve contact data.
 * It provides backward compatibility with the existing Redis-based implementation.
 */

const StorageAdapter = require('./storage-adapter');
const RedisService = require('../redis.service');
const logger = require('../../utils/logger');
const { AppError, errorTypes, errorCodes } = require('../../utils/error-handler');

/**
 * Redis Storage Adapter
 * Implements the storage adapter interface for Redis
 */
class RedisAdapter extends StorageAdapter {
  /**
   * Store an AcmeCRM contact in Redis
   * @param {string} id - AcmeCRM contact ID
   * @param {Object} contact - AcmeCRM contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * Example:
   * Input: 
   *   id: "123456"
   *   contact: { 
   *     id: "123456", 
   *     acme_first_name: "John", 
   *     acme_last_name: "Doe", 
   *     acme_email: "john.doe@example.com" 
   *   }
   * 
   * Output:
   *   { 
   *     id: "123456", 
   *     acme_first_name: "John", 
   *     acme_last_name: "Doe", 
   *     acme_email: "john.doe@example.com" 
   *   }
   */
  async storeAcmeContact(id, contact) {
    try {
      await RedisService.storeAcmeContact(id, contact);
      return contact;
    } catch (error) {
      logger.error(`RedisAdapter: Error storing AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to store AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an AcmeCRM contact from Redis
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<Object|null>} AcmeCRM contact data or null if not found
   * 
   * Example:
   * Input: id: "123456"
   * Output: { 
   *   id: "123456", 
   *   acme_first_name: "John", 
   *   acme_last_name: "Doe", 
   *   acme_email: "john.doe@example.com" 
   * }
   */
  async getAcmeContact(id) {
    try {
      return await RedisService.getAcmeContact(id);
    } catch (error) {
      logger.error(`RedisAdapter: Error retrieving AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to retrieve AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an AcmeCRM contact from Redis
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example:
   * Input: id: "123456"
   * Output: true
   */
  async deleteAcmeContact(id) {
    try {
      const result = await RedisService.deleteAcmeContact(id);
      return result === 1;
    } catch (error) {
      logger.error(`RedisAdapter: Error deleting AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to delete AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Store an internal contact in Redis
   * @param {string} id - Internal contact ID
   * @param {Object} contact - Internal contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * Example:
   * Input:
   *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   *   contact: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com",
   *     source: "acmecrm",
   *     sourceId: "123456"
   *   }
   * 
   * Output:
   *   {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com",
   *     source: "acmecrm",
   *     sourceId: "123456"
   *   }
   */
  async storeInternalContact(id, contact) {
    try {
      await RedisService.storeIntegrationContact(id, contact);
      return contact;
    } catch (error) {
      logger.error(`RedisAdapter: Error storing internal contact with ID ${id}`, error);
      throw new AppError('Failed to store internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an internal contact from Redis
   * @param {string} id - Internal contact ID
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * Example:
   * Input: id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * Output: {
   *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   firstName: "John",
   *   lastName: "Doe",
   *   email: "john.doe@example.com",
   *   source: "acmecrm",
   *   sourceId: "123456"
   * }
   */
  async getInternalContact(id) {
    try {
      return await RedisService.getIntegrationContact(id);
    } catch (error) {
      logger.error(`RedisAdapter: Error retrieving internal contact with ID ${id}`, error);
      throw new AppError('Failed to retrieve internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an internal contact by source and source ID
   * @param {string} source - Source system (e.g., "acmecrm")
   * @param {string} sourceId - ID in the source system
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * Example:
   * Input: 
   *   source: "acmecrm"
   *   sourceId: "123456"
   * Output: {
   *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   firstName: "John",
   *   lastName: "Doe",
   *   email: "john.doe@example.com",
   *   source: "acmecrm",
   *   sourceId: "123456"
   * }
   */
  async getInternalContactBySourceId(source, sourceId) {
    try {
      // For AcmeCRM, we can directly get the contact data
      if (source === 'acmecrm') {
        const acmeContact = await RedisService.getAcmeContact(sourceId);
        
        if (!acmeContact) {
          return null;
        }
        
        // We need to find the internal contact that has this source and sourceId
        // This is a simplified implementation - in a real application, you would use a Redis index
        // For now, we'll just return null
        return null;
      }
      
      // For other sources, we need to search by source and sourceId
      // This is a simplified implementation - in a real application, you would use a Redis index
      return null;
    } catch (error) {
      logger.error(`RedisAdapter: Error retrieving internal contact with source ${source} and ID ${sourceId}`, error);
      throw new AppError('Failed to retrieve internal contact by source ID', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an internal contact from Redis
   * @param {string} id - Internal contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example:
   * Input: id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * Output: true
   */
  async deleteInternalContact(id) {
    try {
      const result = await RedisService.deleteIntegrationContact(id);
      return result === 1;
    } catch (error) {
      logger.error(`RedisAdapter: Error deleting internal contact with ID ${id}`, error);
      throw new AppError('Failed to delete internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Close the Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    try {
      await RedisService.close();
    } catch (error) {
      logger.error('RedisAdapter: Error closing Redis connection', error);
    }
  }
}

module.exports = RedisAdapter;
