/**
 * Internal Contact Schema
 * Defines the schema for contacts in our internal format
 * 
 * This schema represents how contact data is stored and processed within our application.
 * It uses a normalized structure with clear field names and nested objects where appropriate.
 */

const Joi = require('joi');

/**
 * Current schema version
 * Increment this when making changes to the schema structure
 */
const CURRENT_VERSION = 1;

/**
 * Joi schema for validating address data
 */
const addressSchema = Joi.object({
  street: Joi.string().max(200).allow('').optional().description('Street address'),
  city: Joi.string().max(100).allow('').optional().description('City'),
  state: Joi.string().max(100).allow('').optional().description('State or province'),
  zipCode: Joi.string().max(20).allow('').optional().description('ZIP or postal code'),
  country: Joi.string().max(100).allow('').optional().description('Country')
}).description('Structured address');

/**
 * Joi schema for validating internal contact data
 * 
 * Example of valid contact:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "phone": "+1-555-123-4567",
 *   "company": "Acme Inc",
 *   "title": "Software Engineer",
 *   "address": {
 *     "street": "123 Main St",
 *     "city": "San Francisco",
 *     "state": "CA",
 *     "zipCode": "94105",
 *     "country": "USA"
 *   },
 *   "notes": "Met at conference",
 *   "status": "active",
 *   "tags": ["customer", "tech"],
 *   "customFields": {
 *     "industry": "Technology",
 *     "referralSource": "Website"
 *   },
 *   "source": "acmecrm",
 *   "sourceId": "123456",
 *   "createdAt": "2025-05-01T10:30:00Z",
 *   "updatedAt": "2025-05-18T09:15:30Z",
 *   "version": 1
 * }
 */
const internalContactSchema = Joi.object({
  // Required fields
  id: Joi.string().required().description('Unique identifier in our system'),
  firstName: Joi.string().max(100).required().description('First name of the contact'),
  lastName: Joi.string().max(100).required().description('Last name of the contact'),
  email: Joi.string().email().required().description('Primary email address'),
  
  // Optional fields
  phone: Joi.string().allow('').optional().description('Primary phone number'),
  company: Joi.string().max(200).allow('').optional().description('Company name'),
  title: Joi.string().max(200).allow('').optional().description('Job title'),
  address: addressSchema.optional().default({}).description('Structured address'),
  notes: Joi.string().max(2000).allow('').optional().description('Additional notes'),
  status: Joi.string().valid('active', 'inactive', 'lead').default('active').description('Status in our system'),
  tags: Joi.array().items(Joi.string().max(50)).default([]).description('Array of tags'),
  customFields: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
  ).default({}).description('Custom fields'),
  
  // Source tracking
  source: Joi.string().required().description('Source system (e.g., "acmecrm")'),
  sourceId: Joi.string().required().description('ID in the source system'),
  
  // Metadata fields
  createdAt: Joi.string().isoDate().required().description('Creation timestamp'),
  updatedAt: Joi.string().isoDate().required().description('Last update timestamp'),
  version: Joi.number().integer().positive().default(CURRENT_VERSION).description('Schema version')
}).required();

/**
 * Validate internal contact data
 * @param {Object} data - Contact data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowUnknown - Whether to allow unknown fields (default: false)
 * @param {boolean} options.abortEarly - Whether to abort after the first validation error (default: false)
 * @returns {Object} Validation result { value, error }
 * 
 * Example:
 * Input: 
 * {
 *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   firstName: "John",
 *   email: "invalid-email"
 * }
 * 
 * Output:
 * {
 *   error: {
 *     message: "\"lastName\" is required. \"email\" must be a valid email",
 *     details: [
 *       { message: "\"lastName\" is required", path: ["lastName"] },
 *       { message: "\"email\" must be a valid email", path: ["email"] }
 *     ]
 *   }
 * }
 */
function validateInternalContact(data, options = {}) {
  const validationOptions = {
    abortEarly: options.abortEarly || false,
    allowUnknown: options.allowUnknown || false,
    stripUnknown: !options.allowUnknown
  };
  
  return internalContactSchema.validate(data, validationOptions);
}

/**
 * Create a minimal valid internal contact
 * @param {Object} data - Partial contact data
 * @returns {Object} Complete contact object with defaults
 * 
 * Example:
 * Input: 
 * {
 *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   firstName: "John",
 *   lastName: "Doe",
 *   email: "john.doe@example.com",
 *   source: "acmecrm",
 *   sourceId: "123456"
 * }
 * 
 * Output:
 * {
 *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   firstName: "John",
 *   lastName: "Doe",
 *   email: "john.doe@example.com",
 *   source: "acmecrm",
 *   sourceId: "123456",
 *   status: "active",
 *   tags: [],
 *   customFields: {},
 *   address: {},
 *   createdAt: "2025-05-18T10:15:30.123Z",
 *   updatedAt: "2025-05-18T10:15:30.123Z",
 *   version: 1
 * }
 */
function createInternalContact(data) {
  const now = new Date().toISOString();
  
  const defaults = {
    status: 'active',
    tags: [],
    customFields: {},
    address: {},
    createdAt: now,
    updatedAt: now,
    version: CURRENT_VERSION
  };
  
  return { ...defaults, ...data };
}

/**
 * Check if the schema version needs migration
 * @param {Object} contact - Internal contact data
 * @returns {boolean} True if migration is needed
 * 
 * Example:
 * Input: { version: 1 }
 * Output: false (no migration needed for current version)
 */
function needsMigration(contact) {
  return contact.version < CURRENT_VERSION;
}

/**
 * Migrate contact data to the current schema version
 * @param {Object} contact - Internal contact data
 * @returns {Object} Migrated contact data
 * 
 * Example:
 * Input: Old version contact
 * Output: Current version contact with migrated fields
 */
function migrateContact(contact) {
  // Clone the contact to avoid modifying the original
  const migrated = { ...contact };
  
  // Currently at version 1, so no migrations needed yet
  // This function will be expanded when schema evolves
  
  // Always update to current version
  migrated.version = CURRENT_VERSION;
  migrated.updatedAt = new Date().toISOString();
  
  return migrated;
}

module.exports = {
  CURRENT_VERSION,
  addressSchema,
  internalContactSchema,
  validateInternalContact,
  createInternalContact,
  needsMigration,
  migrateContact
};
