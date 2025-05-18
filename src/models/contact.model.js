/**
 * Contact Model
 * Provides methods for working with contact data
 * 
 * This model:
 * 1. Validates contact data against schemas
 * 2. Handles mapping between AcmeCRM and internal formats
 * 3. Provides factory methods for creating contacts
 * 4. Manages schema versioning and migration
 */

const { v4: uuidv4 } = require('uuid');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const acmeContactSchema = require('./schemas/acme-contact.schema');
const internalContactSchema = require('./schemas/internal-contact.schema');
const contactMapperService = require('../services/contact-mapper.service');
const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');

/**
 * Contact Model class
 * Provides methods for working with contact data
 */
class ContactModel {
  /**
   * Create a new contact from AcmeCRM data
   * @param {Object} acmeContactData - Contact data in AcmeCRM format
   * @returns {Promise<Object>} Created contact in internal format
   * 
   * Example:
   * Input: 
   * {
   *   "id": "123456",
   *   "acme_first_name": "John",
   *   "acme_last_name": "Doe",
   *   "acme_email": "john.doe@example.com"
   * }
   * 
   * Output:
   * {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   "source": "acmecrm",
   *   "sourceId": "123456",
   *   ...
   * }
   */
  static async createFromAcmeData(acmeContactData) {
    try {
      // Validate and complete AcmeCRM data
      const { error, value: acmeContact } = acmeContactSchema.validateAcmeContact(
        acmeContactSchema.createAcmeContact(acmeContactData)
      );
      
      if (error) {
        throw new AppError('Invalid AcmeCRM contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Map to internal format
      const internalContact = contactMapperService.mapAcmeToInternal(acmeContact);
      
      // Store in Redis
      await this.saveContact(internalContact);
      
      // Also store the original AcmeCRM data
      await RedisService.storeAcmeContact(acmeContact.id, acmeContact);
      
      logger.info(`Created contact from AcmeCRM data: ${internalContact.id} (source ID: ${internalContact.sourceId})`);
      
      return internalContact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create contact from AcmeCRM data', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.INTERNAL_SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Create a new contact from internal data
   * @param {Object} contactData - Contact data in internal format
   * @returns {Promise<Object>} Created contact in internal format
   * 
   * Example:
   * Input: 
   * {
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   "source": "acmecrm",
   *   "sourceId": "123456"
   * }
   * 
   * Output:
   * {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   "source": "acmecrm",
   *   "sourceId": "123456",
   *   ...
   * }
   */
  static async createContact(contactData) {
    try {
      // Generate an ID if not provided
      const data = {
        id: contactData.id || uuidv4(),
        ...contactData
      };
      
      // Validate and complete internal data
      const { error, value: internalContact } = internalContactSchema.validateInternalContact(
        internalContactSchema.createInternalContact(data)
      );
      
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Store in Redis
      await this.saveContact(internalContact);
      
      // If the source is AcmeCRM, also store in AcmeCRM format
      if (internalContact.source === 'acmecrm') {
        const acmeContact = contactMapperService.mapInternalToAcme(internalContact);
        await RedisService.storeAcmeContact(acmeContact.id, acmeContact);
      }
      
      logger.info(`Created contact: ${internalContact.id}`);
      
      return internalContact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create contact', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.INTERNAL_SERVER_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Get a contact by ID
   * @param {string} id - Contact ID
   * @returns {Promise<Object|null>} Contact in internal format or null if not found
   * 
   * Example:
   * Input: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * Output: {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   ...
   * }
   */
  static async getContactById(id) {
    try {
      // Get from Redis
      const contact = await RedisService.getIntegrationContact(id);
      
      if (!contact) {
        return null;
      }
      
      // Check if migration is needed
      if (internalContactSchema.needsMigration(contact)) {
        const migratedContact = internalContactSchema.migrateContact(contact);
        await this.saveContact(migratedContact);
        return migratedContact;
      }
      
      return contact;
    } catch (error) {
      throw new AppError(`Failed to get contact with ID ${id}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Get a contact by source and source ID
   * @param {string} source - Source system (e.g., "acmecrm")
   * @param {string} sourceId - ID in the source system
   * @returns {Promise<Object|null>} Contact in internal format or null if not found
   * 
   * Example:
   * Input: "acmecrm", "123456"
   * Output: {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   "source": "acmecrm",
   *   "sourceId": "123456",
   *   ...
   * }
   */
  static async getContactBySourceId(source, sourceId) {
    try {
      // For AcmeCRM, we can directly get the contact data
      if (source === 'acmecrm') {
        const acmeContact = await RedisService.getAcmeContact(sourceId);
        
        if (!acmeContact) {
          return null;
        }
        
        // Map to internal format
        return contactMapperService.mapAcmeToInternal(acmeContact);
      }
      
      // For other sources, we need to search by source and sourceId
      // This is a simplified implementation - in a real application, you would use a database query
      // or a Redis index to find contacts by source and sourceId
      
      // For now, we'll just return null for non-AcmeCRM sources
      return null;
    } catch (error) {
      throw new AppError(`Failed to get contact with source ${source} and ID ${sourceId}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Update a contact
   * @param {string} id - Contact ID
   * @param {Object} updateData - Contact data to update
   * @returns {Promise<Object>} Updated contact in internal format
   * 
   * Example:
   * Input: 
   * "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   * {
   *   "firstName": "John",
   *   "lastName": "Smith"
   * }
   * 
   * Output:
   * {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "email": "john.doe@example.com",
   *   ...
   * }
   */
  static async updateContact(id, updateData) {
    try {
      // Get existing contact
      const existingContact = await this.getContactById(id);
      
      if (!existingContact) {
        throw new AppError(`Contact with ID ${id} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Merge existing data with update data
      const updatedContact = {
        ...existingContact,
        ...updateData,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };
      
      // Validate the updated contact
      const { error } = internalContactSchema.validateInternalContact(updatedContact);
      
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Save to Redis
      await this.saveContact(updatedContact);
      
      // If the source is AcmeCRM, also update in AcmeCRM format
      if (updatedContact.source === 'acmecrm') {
        const acmeContact = contactMapperService.mapInternalToAcme(updatedContact);
        await RedisService.storeAcmeContact(acmeContact.id, acmeContact);
      }
      
      logger.info(`Updated contact: ${id}`);
      
      return updatedContact;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to update contact with ID ${id}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete a contact
   * @param {string} id - Contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example:
   * Input: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * Output: true
   */
  static async deleteContact(id) {
    try {
      // Get existing contact to check if it exists and get source info
      const existingContact = await this.getContactById(id);
      
      if (!existingContact) {
        return false;
      }
      
      // Delete from Redis
      await RedisService.deleteIntegrationContact(id);
      
      // If the source is AcmeCRM, also delete the AcmeCRM data
      if (existingContact.source === 'acmecrm') {
        await RedisService.deleteAcmeContact(existingContact.sourceId);
      }
      
      logger.info(`Deleted contact: ${id}`);
      
      return true;
    } catch (error) {
      throw new AppError(`Failed to delete contact with ID ${id}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Save a contact to Redis
   * @param {Object} contact - Contact in internal format
   * @returns {Promise<void>}
   * 
   * Example:
   * Input: {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   ...
   * }
   */
  static async saveContact(contact) {
    try {
      await RedisService.storeIntegrationContact(contact.id, contact);
    } catch (error) {
      throw new AppError(`Failed to save contact with ID ${contact.id}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
}

module.exports = ContactModel;
