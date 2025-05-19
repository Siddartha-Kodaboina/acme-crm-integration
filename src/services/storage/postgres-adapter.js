/**
 * PostgreSQL Storage Adapter
 * Implements the storage adapter interface for PostgreSQL
 * 
 * This adapter uses the PostgreSQL service to store and retrieve contact data.
 * It handles the conversion between the contact model and the database schema.
 */

const StorageAdapter = require('./storage-adapter');
const PostgresService = require('../postgres.service');
const logger = require('../../utils/logger');
const { AppError, errorTypes, errorCodes } = require('../../utils/error-handler');

/**
 * PostgreSQL Storage Adapter
 * Implements the storage adapter interface for PostgreSQL
 */
class PostgresAdapter extends StorageAdapter {
  /**
   * Store an AcmeCRM contact in PostgreSQL
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
      const result = await PostgresService.storeAcmeContact(id, contact);
      return result.data; // Return the stored contact data
    } catch (error) {
      logger.error(`PostgresAdapter: Error storing AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to store AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an AcmeCRM contact from PostgreSQL
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
      return await PostgresService.getAcmeContact(id);
    } catch (error) {
      logger.error(`PostgresAdapter: Error retrieving AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to retrieve AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an AcmeCRM contact from PostgreSQL
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example:
   * Input: id: "123456"
   * Output: true
   */
  async deleteAcmeContact(id) {
    try {
      return await PostgresService.deleteAcmeContact(id);
    } catch (error) {
      logger.error(`PostgresAdapter: Error deleting AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to delete AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Store an internal contact in PostgreSQL
   * @param {string} id - Internal contact ID
   * @param {Object} contact - Internal contact data
   * @returns {Promise<Object>} Stored contact in internal format
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
      // Store the contact in PostgreSQL
      const result = await PostgresService.storeInternalContact(id, contact);
      
      // Convert the result from snake_case to camelCase
      return {
        id: result.id,
        firstName: result.first_name,
        lastName: result.last_name,
        email: result.email,
        phone: result.phone,
        company: result.company,
        title: result.title,
        address: result.address,
        notes: result.notes,
        status: result.status,
        tags: result.tags,
        customFields: result.custom_fields,
        source: result.source,
        sourceId: result.source_id,
        createdAt: result.created_at.toISOString(),
        updatedAt: result.updated_at.toISOString(),
        version: result.version
      };
    } catch (error) {
      logger.error(`PostgresAdapter: Error storing internal contact with ID ${id}`, error);
      throw new AppError('Failed to store internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an internal contact from PostgreSQL
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
      return await PostgresService.getInternalContact(id);
    } catch (error) {
      logger.error(`PostgresAdapter: Error retrieving internal contact with ID ${id}`, error);
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
      return await PostgresService.getInternalContactBySourceId(source, sourceId);
    } catch (error) {
      logger.error(`PostgresAdapter: Error retrieving internal contact with source ${source} and ID ${sourceId}`, error);
      throw new AppError('Failed to retrieve internal contact by source ID', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an internal contact from PostgreSQL
   * @param {string} id - Internal contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example:
   * Input: id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * Output: true
   */
  async deleteInternalContact(id) {
    try {
      return await PostgresService.deleteInternalContact(id);
    } catch (error) {
      logger.error(`PostgresAdapter: Error deleting internal contact with ID ${id}`, error);
      throw new AppError('Failed to delete internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Close the PostgreSQL connection
   * @returns {Promise<void>}
   */
  async close() {
    try {
      await PostgresService.close();
    } catch (error) {
      logger.error('PostgresAdapter: Error closing PostgreSQL connection', error);
    }
  }
}

module.exports = PostgresAdapter;
