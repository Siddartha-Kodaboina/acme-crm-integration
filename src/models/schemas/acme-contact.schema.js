/**
 * AcmeCRM Contact Schema
 * Defines the schema for contacts in AcmeCRM format
 * 
 * This schema represents how contact data is stored and retrieved from the AcmeCRM system.
 * All fields are prefixed with 'acme_' to clearly indicate they are from the external system.
 */

const Joi = require('joi');

/**
 * Current schema version
 * Increment this when making changes to the schema structure
 */
const CURRENT_VERSION = 1;

/**
 * Joi schema for validating AcmeCRM contact data
 * 
 * Example of valid contact:
 * {
 *   "id": "123456",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Doe",
 *   "acme_email": "john.doe@example.com",
 *   "acme_phone": "+1-555-123-4567",
 *   "acme_company": "Acme Inc",
 *   "acme_title": "Software Engineer",
 *   "acme_address": "123 Main St, San Francisco, CA 94105, USA",
 *   "acme_notes": "Met at conference",
 *   "acme_status": "Active",
 *   "acme_tags": ["customer", "tech"],
 *   "acme_custom_fields": {
 *     "industry": "Technology",
 *     "referral_source": "Website"
 *   },
 *   "acme_created_at": "2025-05-01T10:30:00Z",
 *   "acme_updated_at": "2025-05-18T09:15:30Z",
 *   "acme_version": 1
 * }
 */
const acmeContactSchema = Joi.object({
  // Required fields
  id: Joi.string().required().description('Unique identifier in AcmeCRM'),
  acme_first_name: Joi.string().max(100).required().description('First name of the contact'),
  acme_last_name: Joi.string().max(100).required().description('Last name of the contact'),
  acme_email: Joi.string().email().required().description('Primary email address'),
  
  // Optional fields
  acme_phone: Joi.string().allow('').optional().description('Primary phone number'),
  acme_company: Joi.string().max(200).allow('').optional().description('Company name'),
  acme_title: Joi.string().max(200).allow('').optional().description('Job title'),
  acme_address: Joi.string().max(500).allow('').optional().description('Full address as a single string'),
  acme_notes: Joi.string().max(2000).allow('').optional().description('Additional notes'),
  acme_status: Joi.string().valid('Active', 'Inactive', 'Lead').default('Active').description('Status in AcmeCRM'),
  acme_tags: Joi.array().items(Joi.string().max(50)).default([]).description('Array of tags'),
  acme_custom_fields: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
  ).default({}).description('Custom fields defined in AcmeCRM'),
  
  // Metadata fields
  acme_created_at: Joi.string().isoDate().required().description('Creation timestamp'),
  acme_updated_at: Joi.string().isoDate().required().description('Last update timestamp'),
  acme_version: Joi.number().integer().positive().default(CURRENT_VERSION).description('Schema version')
}).required();

/**
 * Validate AcmeCRM contact data
 * @param {Object} data - Contact data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowUnknown - Whether to allow unknown fields (default: false)
 * @param {boolean} options.abortEarly - Whether to abort after the first validation error (default: false)
 * @returns {Object} Validation result { value, error }
 * 
 * Example:
 * Input: 
 * {
 *   id: "123456",
 *   acme_first_name: "John",
 *   acme_email: "invalid-email"
 * }
 * 
 * Output:
 * {
 *   error: {
 *     message: "\"acme_last_name\" is required. \"acme_email\" must be a valid email",
 *     details: [
 *       { message: "\"acme_last_name\" is required", path: ["acme_last_name"] },
 *       { message: "\"acme_email\" must be a valid email", path: ["acme_email"] }
 *     ]
 *   }
 * }
 */
function validateAcmeContact(data, options = {}) {
  const validationOptions = {
    abortEarly: options.abortEarly || false,
    allowUnknown: options.allowUnknown || false,
    stripUnknown: !options.allowUnknown
  };
  
  return acmeContactSchema.validate(data, validationOptions);
}

/**
 * Create a minimal valid AcmeCRM contact
 * @param {Object} data - Partial contact data
 * @returns {Object} Complete contact object with defaults
 * 
 * Example:
 * Input: 
 * {
 *   id: "123456",
 *   acme_first_name: "John",
 *   acme_last_name: "Doe",
 *   acme_email: "john.doe@example.com"
 * }
 * 
 * Output:
 * {
 *   id: "123456",
 *   acme_first_name: "John",
 *   acme_last_name: "Doe",
 *   acme_email: "john.doe@example.com",
 *   acme_status: "Active",
 *   acme_tags: [],
 *   acme_custom_fields: {},
 *   acme_created_at: "2025-05-18T10:15:30.123Z",
 *   acme_updated_at: "2025-05-18T10:15:30.123Z",
 *   acme_version: 1
 * }
 */
function createAcmeContact(data) {
  const now = new Date().toISOString();
  
  const defaults = {
    acme_status: 'Active',
    acme_tags: [],
    acme_custom_fields: {},
    acme_created_at: now,
    acme_updated_at: now,
    acme_version: CURRENT_VERSION
  };
  
  return { ...defaults, ...data };
}

/**
 * Check if the schema version needs migration
 * @param {Object} contact - AcmeCRM contact data
 * @returns {boolean} True if migration is needed
 * 
 * Example:
 * Input: { acme_version: 1 }
 * Output: false (no migration needed for current version)
 */
function needsMigration(contact) {
  return contact.acme_version < CURRENT_VERSION;
}

/**
 * Migrate contact data to the current schema version
 * @param {Object} contact - AcmeCRM contact data
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
  migrated.acme_version = CURRENT_VERSION;
  migrated.acme_updated_at = new Date().toISOString();
  
  return migrated;
}

module.exports = {
  CURRENT_VERSION,
  acmeContactSchema,
  validateAcmeContact,
  createAcmeContact,
  needsMigration,
  migrateContact
};
