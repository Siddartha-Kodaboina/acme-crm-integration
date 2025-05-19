/**
 * Webhook Schema
 * Defines the structure and validation rules for webhook events
 * 
 * This schema validates:
 * 1. Event type (must be one of the supported types)
 * 2. Event ID (must be a string)
 * 3. Timestamp (must be a valid ISO date string)
 * 4. Data structure (must match the expected structure for the event type)
 */

const Joi = require('joi');

/**
 * Base webhook schema
 * Validates common fields for all webhook events
 * 
 * Example valid data:
 * {
 *   "event": "contact.created",
 *   "timestamp": "2025-05-19T00:00:00.000Z",
 *   "id": "evt_123456789",
 *   "data": {
 *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *     "firstName": "John",
 *     "lastName": "Smith",
 *     "email": "john.smith@example.com"
 *   }
 * }
 */
const webhookSchema = Joi.object({
  // Event type must be one of the supported types
  event: Joi.string().valid(
    'contact.created',
    'contact.updated',
    'contact.deleted'
  ).required()
    .description('Type of webhook event'),
  
  // Timestamp must be a valid ISO date string
  timestamp: Joi.string().isoDate().required()
    .description('Timestamp when the event occurred'),
  
  // Event ID must be a string
  id: Joi.string().required()
    .description('Unique identifier for the event'),
  
  // Data structure depends on the event type
  data: Joi.object().required()
    .description('Event data')
}).unknown(true);

/**
 * Contact created event schema
 * Validates data structure for contact.created events
 * 
 * Example valid data:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "email": "john.smith@example.com",
 *   "phone": "555-987-6543",
 *   "company": "Acme Inc",
 *   "title": "Senior Engineer",
 *   "createdAt": "2025-05-19T00:00:00.000Z",
 *   "updatedAt": "2025-05-19T00:00:00.000Z"
 * }
 */
const contactCreatedSchema = Joi.object({
  id: Joi.string().required()
    .description('Contact ID'),
  firstName: Joi.string().required()
    .description('First name'),
  lastName: Joi.string().required()
    .description('Last name'),
  email: Joi.string().email().required()
    .description('Email address'),
  phone: Joi.string().allow(null, '')
    .description('Phone number'),
  company: Joi.string().allow(null, '')
    .description('Company name'),
  title: Joi.string().allow(null, '')
    .description('Job title'),
  createdAt: Joi.string().isoDate().required()
    .description('Creation timestamp'),
  updatedAt: Joi.string().isoDate().required()
    .description('Last update timestamp')
}).unknown(true);

/**
 * Contact updated event schema
 * Validates data structure for contact.updated events
 * 
 * Example valid data:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "email": "john.smith@example.com",
 *   "phone": "555-987-6543",
 *   "company": "Updated Company",
 *   "title": "Senior Engineer",
 *   "createdAt": "2025-05-19T00:00:00.000Z",
 *   "updatedAt": "2025-05-19T00:15:00.000Z"
 * }
 */
const contactUpdatedSchema = Joi.object({
  id: Joi.string().required()
    .description('Contact ID'),
  firstName: Joi.string().required()
    .description('First name'),
  lastName: Joi.string().required()
    .description('Last name'),
  email: Joi.string().email().required()
    .description('Email address'),
  phone: Joi.string().allow(null, '')
    .description('Phone number'),
  company: Joi.string().allow(null, '')
    .description('Company name'),
  title: Joi.string().allow(null, '')
    .description('Job title'),
  createdAt: Joi.string().isoDate().required()
    .description('Creation timestamp'),
  updatedAt: Joi.string().isoDate().required()
    .description('Last update timestamp')
}).unknown(true);

/**
 * Contact deleted event schema
 * Validates data structure for contact.deleted events
 * 
 * Example valid data:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "deletedAt": "2025-05-19T00:30:00.000Z"
 * }
 */
const contactDeletedSchema = Joi.object({
  id: Joi.string().required()
    .description('Contact ID'),
  deletedAt: Joi.string().isoDate().required()
    .description('Deletion timestamp')
}).unknown(true);

/**
 * Validate webhook data based on event type
 * @param {Object} data - Webhook data to validate
 * @returns {Object} Validation result
 */
const validate = (data) => {
  // First validate the base webhook structure
  const baseResult = webhookSchema.validate(data);
  if (baseResult.error) {
    return baseResult;
  }

  // Then validate the data structure based on event type
  let dataSchema;
  switch (data.event) {
    case 'contact.created':
      dataSchema = contactCreatedSchema;
      break;
    case 'contact.updated':
      dataSchema = contactUpdatedSchema;
      break;
    case 'contact.deleted':
      dataSchema = contactDeletedSchema;
      break;
    default:
      // If we get here, the event type is not supported
      // This shouldn't happen due to the base schema validation
      return { 
        error: new Error(`Unsupported event type: ${data.event}`),
        value: data
      };
  }

  // Validate the data structure
  const dataResult = dataSchema.validate(data.data);
  if (dataResult.error) {
    return {
      error: dataResult.error,
      value: data
    };
  }

  // If all validations pass, return the validated data
  return {
    value: data
  };
};

module.exports = {
  validate,
  webhookSchema,
  contactCreatedSchema,
  contactUpdatedSchema,
  contactDeletedSchema
};
