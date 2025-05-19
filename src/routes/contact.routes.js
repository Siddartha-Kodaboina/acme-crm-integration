/**
 * Contact Routes
 * Defines API routes for contact operations
 * 
 * This module:
 * 1. Defines routes for contact creation and retrieval
 * 2. Applies middleware for authentication and validation
 * 3. Maps routes to controller functions
 */

const express = require('express');
const contactController = require('../controllers/contact.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');
const { contactSchemas } = require('../utils/validation');

const router = express.Router();

/**
 * @route   POST /api/contacts
 * @desc    Create a new contact
 * @access  Private
 * 
 * Request body example:
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
 * OR (AcmeCRM format):
 * 
 * {
 *   "id": "12345",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Doe",
 *   "acme_email": "john.doe@example.com",
 *   "acme_phone": "555-123-4567",
 *   "acme_company": "Acme Inc",
 *   "acme_title": "Software Engineer"
 * }
 */
router.post(
  '/',
  authMiddleware.authenticate,
  validationMiddleware.validateBody(contactSchemas.createContactSchema),
  contactController.createContact
);

/**
 * @route   POST /api/contacts/acme
 * @desc    Create a new contact from AcmeCRM data
 * @access  Private
 * 
 * Request body example:
 * {
 *   "id": "12345",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Doe",
 *   "acme_email": "john.doe@example.com",
 *   "acme_phone": "555-123-4567",
 *   "acme_company": "Acme Inc",
 *   "acme_title": "Software Engineer"
 * }
 */
router.post(
  '/acme',
  authMiddleware.authenticate,
  validationMiddleware.validateBody(contactSchemas.createAcmeContactSchema),
  contactController.createAcmeContact
);

/**
 * @route   GET /api/contacts/:id
 * @desc    Get a contact by ID
 * @access  Private
 * 
 * URL parameter:
 * id - Contact ID (UUID)
 * 
 * Response example:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "phone": "555-123-4567",
 *   "company": "Acme Inc",
 *   "title": "Software Engineer",
 *   "source": "acmecrm",
 *   "sourceId": "12345",
 *   "createdAt": "2025-05-18T23:45:00.000Z",
 *   "updatedAt": "2025-05-18T23:45:00.000Z"
 * }
 */
router.get(
  '/:id',
  authMiddleware.authenticate,
  contactController.getContactById
);

/**
 * @route   GET /api/contacts/source/:source/:sourceId
 * @desc    Get a contact by source and source ID
 * @access  Private
 * 
 * URL parameters:
 * source - Source system (e.g., "acmecrm")
 * sourceId - ID in the source system
 * 
 * Response example:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "phone": "555-123-4567",
 *   "company": "Acme Inc",
 *   "title": "Software Engineer",
 *   "source": "acmecrm",
 *   "sourceId": "12345",
 *   "createdAt": "2025-05-18T23:45:00.000Z",
 *   "updatedAt": "2025-05-18T23:45:00.000Z"
 * }
 */
router.get(
  '/source/:source/:sourceId',
  authMiddleware.authenticate,
  contactController.getContactBySourceId
);

/**
 * @route   GET /api/contacts
 * @desc    Get contacts with pagination and filtering
 * @access  Private
 * 
 * Query parameters:
 * page - Page number (default: 1)
 * limit - Number of contacts per page (default: 10, max: 100)
 * sort - Field to sort by (default: "createdAt")
 * order - Sort order ("asc" or "desc", default: "desc")
 * search - Search term for name, email, or company
 * source - Filter by source system
 * status - Filter by status
 * 
 * Response example:
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
router.get(
  '/',
  authMiddleware.authenticate,
  contactController.getContacts
);

/**
 * @route   PUT /api/contacts/:id
 * @desc    Update a contact (full update)
 * @access  Private
 * 
 * URL parameter:
 * id - Contact ID (UUID)
 * 
 * Request body example:
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
 * Response example:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "email": "john.smith@example.com",
 *   "phone": "555-987-6543",
 *   "company": "Updated Company",
 *   "title": "Senior Engineer",
 *   "version": 2,
 *   "createdAt": "2025-05-18T23:45:00.000Z",
 *   "updatedAt": "2025-05-19T00:15:00.000Z"
 * }
 */
router.put(
  '/:id',
  authMiddleware.authenticate,
  validationMiddleware.validateBody(contactSchemas.updateContactSchema),
  contactController.updateContact
);

/**
 * @route   PATCH /api/contacts/:id
 * @desc    Update a contact (partial update)
 * @access  Private
 * 
 * URL parameter:
 * id - Contact ID (UUID)
 * 
 * Request body example:
 * {
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "version": 1
 * }
 * 
 * Response example:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "email": "john.doe@example.com",
 *   "phone": "555-123-4567",
 *   "company": "Acme Inc",
 *   "title": "Software Engineer",
 *   "version": 2,
 *   "createdAt": "2025-05-18T23:45:00.000Z",
 *   "updatedAt": "2025-05-19T00:15:00.000Z"
 * }
 */
router.patch(
  '/:id',
  authMiddleware.authenticate,
  validationMiddleware.validateBody(contactSchemas.patchContactSchema),
  contactController.patchContact
);

/**
 * @route   DELETE /api/contacts/:id
 * @desc    Delete a contact
 * @access  Private
 * 
 * URL parameter:
 * id - Contact ID (UUID)
 * 
 * Response example:
 * {
 *   "message": "Contact deleted successfully",
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
 * }
 */
router.delete(
  '/:id',
  authMiddleware.authenticate,
  contactController.deleteContact
);

module.exports = router;
