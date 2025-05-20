/**
 * Contact Controller
 * Handles API requests for contact operations
 * 
 * This controller:
 * 1. Processes requests for contact creation and retrieval
 * 2. Calls the Contact Model for business logic
 * 3. Formats responses according to API standards
 * 4. Handles errors and returns appropriate responses
 * 5. Triggers webhooks for data changes
 */

const ContactModel = require('../models/contact.model');
const WebhookService = require('../services/webhook.service');
const WebhookSimulatorService = require('../services/webhook-simulator.service');
const PostgresService = require('../services/postgres.service');
const { contactSchemas } = require('../utils/validation');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');
const config = require('../config/app.config');

/**
 * Helper function to simulate a webhook event
 * @param {string} eventType - Type of event (e.g., "contact.created")
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 * 
 * @private
 */
const simulateWebhook = async (eventType, data) => {
  if (config.acme.webhookSimulator && config.acme.webhookSimulator.autoTrigger) {
    try {
      await WebhookSimulatorService.simulateWebhook(
        eventType, 
        data, 
        config.acme.webhookSimulator.targetUrl
      );
      logger.info(`Simulated ${eventType} webhook for contact ${data.id}`);
    } catch (error) {
      logger.error(`Error simulating ${eventType} webhook`, error);
    }
  }
};

/**
 * Contact Controller object
 * Provides methods for handling contact API requests
 */
const contactController = {
  /**
   * Create a new contact
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example request body:
   * {
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com",
   *   "phone": "555-123-4567",
   *   "company": "Acme Inc",
   *   "title": "Software Engineer",
   *   "source": "acmecrm",
   *   "sourceId": "12345"
   * }
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "email": "john.doe@example.com",
   *     "phone": "555-123-4567",
   *     "company": "Acme Inc",
   *     "title": "Software Engineer",
   *     "source": "acmecrm",
   *     "sourceId": "12345",
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-18T23:45:00.000Z"
   *   }
   * }
   */
  createContact: async (req, res, next) => {
    try {
      // Check if contact with same source and sourceId already exists
      if (req.body.source && req.body.sourceId) {
        const existingContact = await ContactModel.getContactBySourceId(req.body.source, req.body.sourceId);
        
        if (existingContact) {
          throw new AppError('Contact with this source and sourceId already exists', errorTypes.VALIDATION_ERROR, {
            code: errorCodes.RESOURCE_ALREADY_EXISTS,
            details: {
              id: existingContact.id,
              source: existingContact.source,
              sourceId: existingContact.sourceId
            }
          });
        }
      }
      
      // Create the contact
      const contact = await ContactModel.createContact(req.body);
      
      // Trigger internal webhook event
      WebhookService.contactCreated(contact)
        .catch(error => logger.error('Error triggering contact.created webhook', error));
      
      // Simulate external webhook
      simulateWebhook('contact.created', contact);
      
      // Return success response
      res.status(201).json({
        data: contact
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Create a new contact from AcmeCRM data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example request body:
   * {
   *   "id": "12345",
   *   "acme_first_name": "John",
   *   "acme_last_name": "Doe",
   *   "acme_email": "john.doe@example.com",
   *   "acme_phone": "555-123-4567",
   *   "acme_company": "Acme Inc",
   *   "acme_title": "Software Engineer"
   * }
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "email": "john.doe@example.com",
   *     "phone": "555-123-4567",
   *     "company": "Acme Inc",
   *     "title": "Software Engineer",
   *     "source": "acmecrm",
   *     "sourceId": "12345",
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-18T23:45:00.000Z"
   *   }
   * }
   */
  createAcmeContact: async (req, res, next) => {
    try {
      // Validate request body
      const { error, value } = contactSchemas.acmeContact.validate(req.body);
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Check if contact already exists
      const existingContact = await ContactModel.getContactBySourceId('acmecrm', req.body.id);
      
      if (existingContact) {
        // Update existing contact
        const updatedContact = await ContactModel.updateContact(existingContact.id, {
          firstName: req.body.acme_first_name,
          lastName: req.body.acme_last_name,
          email: req.body.acme_email,
          phone: req.body.acme_phone,
          company: req.body.acme_company,
          title: req.body.acme_title,
          version: existingContact.version
        });
        
        // Trigger internal webhook event
        WebhookService.contactUpdated(existingContact, updatedContact)
          .catch(error => logger.error('Error triggering contact.updated webhook', error));
        
        // Simulate external webhook
        simulateWebhook('contact.updated', updatedContact);
        
        res.status(200).json({
          data: updatedContact
        });
      } else {
        // Create new contact
        const contact = await ContactModel.createContact({
          firstName: req.body.acme_first_name,
          lastName: req.body.acme_last_name,
          email: req.body.acme_email,
          phone: req.body.acme_phone,
          company: req.body.acme_company,
          title: req.body.acme_title,
          source: 'acmecrm',
          sourceId: req.body.id
        });
        
        // Trigger internal webhook event
        WebhookService.contactCreated(contact)
          .catch(error => logger.error('Error triggering contact.created webhook', error));
        
        // Simulate external webhook
        simulateWebhook('contact.created', contact);
        
        res.status(201).json({
          data: contact
        });
      }
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get a contact by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts/c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "email": "john.doe@example.com",
   *     "phone": "555-123-4567",
   *     "company": "Acme Inc",
   *     "title": "Software Engineer",
   *     "source": "acmecrm",
   *     "sourceId": "12345",
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-18T23:45:00.000Z"
   *   }
   * }
   */
  getContactById: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Get contact by ID
      const contact = await ContactModel.getContactById(id);
      
      if (!contact) {
        throw new AppError(`Contact with ID ${id} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Return success response
      res.status(200).json({
        data: contact
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get a contact by source and source ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts/source/acmecrm/12345
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "email": "john.doe@example.com",
   *     "phone": "555-123-4567",
   *     "company": "Acme Inc",
   *     "title": "Software Engineer",
   *     "source": "acmecrm",
   *     "sourceId": "12345",
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-18T23:45:00.000Z"
   *   }
   * }
   */
  getContactBySourceId: async (req, res, next) => {
    try {
      const { source, sourceId } = req.params;
      
      // Get contact by source and sourceId
      const contact = await ContactModel.getContactBySourceId(source, sourceId);
      
      if (!contact) {
        throw new AppError(`Contact with source ${source} and sourceId ${sourceId} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Return success response
      res.status(200).json({
        data: contact
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get contacts with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts?page=1&limit=10&sort=lastName&order=asc&search=john&source=acmecrm&status=active
   * 
   * Example response:
   * {
   *   "data": [
   *     {
   *       "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *       "firstName": "John",
   *       "lastName": "Doe",
   *       "email": "john.doe@example.com",
   *       "phone": "555-123-4567",
   *       "company": "Acme Inc",
   *       "title": "Software Engineer",
   *       "source": "acmecrm",
   *       "sourceId": "12345",
   *       "createdAt": "2025-05-18T23:45:00.000Z",
   *       "updatedAt": "2025-05-18T23:45:00.000Z"
   *     },
   *     // More contacts...
   *   ],
   *   "pagination": {
   *     "page": 1,
   *     "limit": 10,
   *     "totalItems": 42,
   *     "totalPages": 5,
   *     "hasNextPage": true,
   *     "hasPrevPage": false
   *   }
   * }
   */
  getContacts: async (req, res, next) => {
    try {
      // Parse query parameters
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const sort = req.query.sort || 'createdAt';
      const order = req.query.order || 'desc';
      const search = req.query.search || '';
      const source = req.query.source || '';
      const status = req.query.status || '';
      
      // Validate pagination parameters
      if (page < 1) {
        throw new AppError('Page must be greater than 0', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT
        });
      }
      
      if (limit < 1 || limit > 100) {
        throw new AppError('Limit must be between 1 and 100', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT
        });
      }
      
      // Validate sort field
      const allowedSortFields = [
        'firstName', 'lastName', 'email', 'company', 'createdAt', 'updatedAt'
      ];
      
      if (!allowedSortFields.includes(sort)) {
        throw new AppError(`Invalid sort field: ${sort}`, errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: {
            allowedFields: allowedSortFields
          }
        });
      }
      
      // Validate order
      if (order !== 'asc' && order !== 'desc') {
        throw new AppError('Order must be "asc" or "desc"', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT
        });
      }
      
      // Get contacts with pagination
      const result = await ContactModel.getContacts({
        page,
        limit,
        sort,
        order,
        search,
        source,
        status
      });
      
      // Return success response
      res.status(200).json({
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update a contact (full update)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts/c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c
   * 
   * Example request body:
   * {
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "email": "john.smith@example.com",
   *   "phone": "555-987-6543",
   *   "company": "Updated Company",
   *   "title": "Senior Engineer",
   *   "version": 1
   * }
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Smith",
   *     "email": "john.smith@example.com",
   *     "phone": "555-987-6543",
   *     "company": "Updated Company",
   *     "title": "Senior Engineer",
   *     "version": 2,
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-19T00:15:00.000Z"
   *   }
   * }
   */
  updateContact: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const { error, value } = contactSchemas.updateContactSchema.validate(req.body);
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Check if contact exists
      const existingContact = await ContactModel.getContactById(id);
      
      if (!existingContact) {
        throw new AppError(`Contact with ID ${id} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Check version for optimistic concurrency control
      if (req.body.version !== undefined && req.body.version !== existingContact.version) {
        throw new AppError('Contact has been modified by another user', errorTypes.CONFLICT, {
          code: errorCodes.VERSION_CONFLICT,
          details: {
            currentVersion: existingContact.version,
            providedVersion: req.body.version
          }
        });
      }
      
      // Use transaction to ensure atomicity
      const updatedContact = await PostgresService.transaction(async (client) => {
        // Store the original contact for webhook event
        const originalContact = { ...existingContact };
        
        // Update the contact
        const contact = await ContactModel.updateContact(id, req.body);
        
        // Trigger internal webhook event
        WebhookService.contactUpdated(contact)
          .catch(error => logger.error('Error triggering contact.updated webhook', error));
        
        // Simulate external webhook
        simulateWebhook('contact.updated', contact);
        
        return contact;
      });
      
      // Return success response
      res.status(200).json({
        data: updatedContact
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update a contact (partial update)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts/c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c
   * 
   * Example request body:
   * {
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "version": 1
   * }
   * 
   * Example response:
   * {
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Smith",
   *     "email": "john.doe@example.com",
   *     "phone": "555-123-4567",
   *     "company": "Acme Inc",
   *     "title": "Software Engineer",
   *     "version": 2,
   *     "createdAt": "2025-05-18T23:45:00.000Z",
   *     "updatedAt": "2025-05-19T00:15:00.000Z"
   *   }
   * }
   */
  patchContact: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const { error, value } = contactSchemas.patchContactSchema.validate(req.body);
      if (error) {
        throw new AppError('Invalid contact data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }
      
      // Check if contact exists
      const existingContact = await ContactModel.getContactById(id);
      
      if (!existingContact) {
        throw new AppError(`Contact with ID ${id} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Check version for optimistic concurrency control
      if (req.body.version !== undefined && req.body.version !== existingContact.version) {
        throw new AppError('Contact has been modified by another user', errorTypes.CONFLICT, {
          code: errorCodes.VERSION_CONFLICT,
          details: {
            currentVersion: existingContact.version,
            providedVersion: req.body.version
          }
        });
      }
      
      // Use transaction to ensure atomicity
      const updatedContact = await PostgresService.transaction(async (client) => {
        // Store the original contact for webhook event
        const originalContact = { ...existingContact };
        
        // Update the contact
        const contact = await ContactModel.updateContact(id, req.body);
        
        // Trigger internal webhook event
        WebhookService.contactUpdated(contact)
          .catch(error => logger.error('Error triggering contact.updated webhook', error));
        
        // Simulate external webhook
        simulateWebhook('contact.updated', contact);
        
        return contact;
      });
      
      // Return success response
      res.status(200).json({
        data: updatedContact
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a contact
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example URL: /api/contacts/c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c
   * 
   * Example response:
   * {
   *   "message": "Contact deleted successfully",
   *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * }
   */
  deleteContact: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Check if contact exists
      const existingContact = await ContactModel.getContactById(id);
      
      if (!existingContact) {
        throw new AppError(`Contact with ID ${id} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      // Use transaction to ensure atomicity
      await PostgresService.transaction(async (client) => {
        // Delete the contact
        const result = await ContactModel.deleteContact(id);
        
        if (!result) {
          throw new AppError(`Failed to delete contact with ID ${id}`, errorTypes.INTERNAL_ERROR, {
            code: errorCodes.DATABASE_ERROR
          });
        }
        
        // Trigger internal webhook event
        WebhookService.contactDeleted(existingContact)
          .catch(error => logger.error('Error triggering contact.deleted webhook', error));
        
        // Simulate external webhook
        simulateWebhook('contact.deleted', { id: existingContact.id });
      });
      
      // Return success response
      res.status(200).json({
        message: 'Contact deleted successfully',
        id
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = contactController;
