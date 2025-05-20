/**
 * Contact Model
 * Provides methods for working with contact data
 * 
 * This model:
 * 1. Validates contact data against schemas
 * 2. Handles mapping between AcmeCRM and internal formats
 * 3. Provides factory methods for creating contacts
 * 4. Manages schema versioning and migration
 * 5. Uses storage adapters for database operations (Redis, PostgreSQL)
 */

const { v4: uuidv4 } = require('uuid');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const acmeContactSchema = require('./schemas/acme-contact.schema');
const internalContactSchema = require('./schemas/internal-contact.schema');
const contactMapperService = require('../services/contact-mapper.service');
const StorageFactory = require('../services/storage/storage-factory');
const logger = require('../utils/logger');

/**
 * Contact Model class
 * Provides methods for working with contact data
 * Uses storage adapters for database operations
 */
class ContactModel {
  /**
   * Get the storage adapter
   * @returns {Object} Storage adapter instance
   * 
   * @private
   */
  static _getStorageAdapter() {
    return StorageFactory.getAdapter();
  }
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
      
      // Store in database using adapter
      await this.saveContact(internalContact);
      
      // Also store the original AcmeCRM data
      const storageAdapter = this._getStorageAdapter();
      await storageAdapter.storeAcmeContact(acmeContact.id, acmeContact);
      
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
      
      // Store in database using adapter
      await this.saveContact(internalContact);
      
      // If the source is AcmeCRM, also store in AcmeCRM format
      if (internalContact.source === 'acmecrm') {
        const acmeContact = contactMapperService.mapInternalToAcme(internalContact);
        const storageAdapter = this._getStorageAdapter();
        await storageAdapter.storeAcmeContact(acmeContact.id, acmeContact);
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
      // Get from database using adapter
      const storageAdapter = this._getStorageAdapter();
      const contact = await storageAdapter.getInternalContact(id);
      
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
      // Use the storage adapter to get the contact by source and source ID
      const storageAdapter = this._getStorageAdapter();
      const contact = await storageAdapter.getInternalContactBySourceId(source, sourceId);
      
      // If we found a contact, return it
      if (contact) {
        return contact;
      }
      
      // For AcmeCRM, we can also try to get the contact data directly and map it
      if (source === 'acmecrm') {
        const acmeContact = await storageAdapter.getAcmeContact(sourceId);
        
        if (acmeContact) {
          // Map to internal format
          return contactMapperService.mapAcmeToInternal(acmeContact);
        }
      }
      
      // Contact not found
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
   *   "lastName": "Smith",
   *   "version": 1
   * }
   * 
   * Output:
   * {
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "email": "john.doe@example.com",
   *   "version": 2,
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
      
      // Check version for optimistic concurrency control
      if (updateData.version !== undefined && existingContact.version !== updateData.version) {
        throw new AppError('Contact has been modified by another user', errorTypes.CONFLICT, {
          code: errorCodes.VERSION_CONFLICT,
          details: {
            currentVersion: existingContact.version,
            submittedVersion: updateData.version
          }
        });
      }
      
      // Merge existing data with update data
      const updatedContact = {
        ...existingContact,
        ...updateData,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
        version: (existingContact.version || 0) + 1 // Increment version
      };
      
      // Validate the updated contact
      const { error } = internalContactSchema.validateInternalContact(updatedContact);
      
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Save to database using adapter
      await this.saveContact(updatedContact);
      
      // If the source is AcmeCRM, also update in AcmeCRM format
      if (updatedContact.source === 'acmecrm') {
        const acmeContact = contactMapperService.mapInternalToAcme(updatedContact);
        const storageAdapter = this._getStorageAdapter();
        await storageAdapter.storeAcmeContact(acmeContact.id, acmeContact);
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
      
      // Delete from database using adapter
      const storageAdapter = this._getStorageAdapter();
      await storageAdapter.deleteInternalContact(id);
      
      // If the source is AcmeCRM, also delete the AcmeCRM data
      if (existingContact.source === 'acmecrm') {
        await storageAdapter.deleteAcmeContact(existingContact.sourceId);
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
   * Save a contact to the database
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
      // Use the storage adapter to save the contact
      const storageAdapter = this._getStorageAdapter();
      await storageAdapter.storeInternalContact(contact.id, contact);
    } catch (error) {
      throw new AppError(`Failed to save contact with ID ${contact.id}`, errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Get contacts with pagination and filtering
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @param {string} options.sort - Field to sort by
   * @param {string} options.order - Sort order ('asc' or 'desc')
   * @param {string} options.search - Search term for name, email, or company
   * @param {string} options.source - Filter by source system
   * @param {string} options.status - Filter by status
   * @returns {Promise<Object>} Paginated contacts and metadata
   * 
   * Example:
   * Input: { page: 1, limit: 10, sort: 'lastName', order: 'asc' }
   * Output: {
   *   data: [ ... array of contacts ... ],
   *   pagination: {
   *     page: 1,
   *     limit: 10,
   *     totalItems: 42,
   *     totalPages: 5,
   *     hasNextPage: true,
   *     hasPrevPage: false
   *   }
   * }
   */
  static async getContacts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search = '',
        source = '',
        status = ''
      } = options;
      
      // Use the storage adapter to get contacts with pagination
      const storageAdapter = this._getStorageAdapter();
      const result = await storageAdapter.getInternalContacts({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort,
        order,
        search,
        source,
        status
      });
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(result.total / limit);
      
      return {
        data: result.contacts,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalItems: result.total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new AppError('Failed to get contacts', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
}

module.exports = ContactModel;
