/**
 * Storage Adapter Interface
 * Defines the interface for storage adapters
 * 
 * This module provides an abstract interface for different storage backends.
 * Implementations can be created for different databases (Redis, PostgreSQL, etc.)
 * while maintaining the same interface for the contact model.
 */

/**
 * Base Storage Adapter class
 * All storage adapters should extend this class and implement its methods
 */
class StorageAdapter {
  /**
   * Store an AcmeCRM contact
   * @param {string} id - AcmeCRM contact ID
   * @param {Object} contact - AcmeCRM contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * @abstract
   */
  async storeAcmeContact(id, contact) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Retrieve an AcmeCRM contact
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<Object|null>} AcmeCRM contact data or null if not found
   * 
   * @abstract
   */
  async getAcmeContact(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Delete an AcmeCRM contact
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * @abstract
   */
  async deleteAcmeContact(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Store an internal contact
   * @param {string} id - Internal contact ID
   * @param {Object} contact - Internal contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * @abstract
   */
  async storeInternalContact(id, contact) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Retrieve an internal contact
   * @param {string} id - Internal contact ID
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * @abstract
   */
  async getInternalContact(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Retrieve an internal contact by source and source ID
   * @param {string} source - Source system (e.g., "acmecrm")
   * @param {string} sourceId - ID in the source system
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * @abstract
   */
  async getInternalContactBySourceId(source, sourceId) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Delete an internal contact
   * @param {string} id - Internal contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * @abstract
   */
  async deleteInternalContact(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Close the storage connection
   * @returns {Promise<void>}
   * 
   * @abstract
   */
  async close() {
    throw new Error('Method not implemented');
  }
}

module.exports = StorageAdapter;
