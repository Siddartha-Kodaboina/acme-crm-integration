/**
 * Validation Utilities
 * Provides validation schemas for API requests
 * 
 * This module:
 * 1. Defines validation schemas for various API endpoints
 * 2. Uses Joi for schema validation
 * 3. Provides helper functions for common validation tasks
 */

const Joi = require('joi');

/**
 * Contact validation schemas
 */
const contactSchemas = {
  /**
   * Schema for creating a contact (internal format)
   * 
   * Example valid data:
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
   */
  createContactSchema: Joi.object({
    firstName: Joi.string().min(1).max(100).required()
      .description('First name of the contact'),
    lastName: Joi.string().min(1).max(100).required()
      .description('Last name of the contact'),
    email: Joi.string().email().required()
      .description('Email address of the contact'),
    phone: Joi.string().max(50).allow(null, '')
      .description('Phone number of the contact'),
    company: Joi.string().max(200).allow(null, '')
      .description('Company name of the contact'),
    title: Joi.string().max(200).allow(null, '')
      .description('Job title of the contact'),
    address: Joi.object({
      street: Joi.string().max(200).allow(null, ''),
      city: Joi.string().max(100).allow(null, ''),
      state: Joi.string().max(100).allow(null, ''),
      postalCode: Joi.string().max(20).allow(null, ''),
      country: Joi.string().max(100).allow(null, '')
    }).allow(null)
      .description('Address of the contact'),
    notes: Joi.string().allow(null, '')
      .description('Notes about the contact'),
    status: Joi.string().valid('active', 'inactive', 'pending').default('active')
      .description('Status of the contact'),
    tags: Joi.array().items(Joi.string()).default([])
      .description('Tags associated with the contact'),
    customFields: Joi.object().pattern(
      Joi.string(), 
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ).default({})
      .description('Custom fields for the contact'),
    source: Joi.string().required()
      .description('Source system of the contact (e.g., "acmecrm")'),
    sourceId: Joi.string().required()
      .description('ID of the contact in the source system')
  }),

  /**
   * Schema for creating a contact from AcmeCRM data
   * 
   * Example valid data:
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
  /**
   * Schema for updating a contact (PUT - full update)
   * Requires all fields except id
   * 
   * Example valid data:
   * {
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "email": "john.smith@example.com",
   *   "phone": "555-987-6543",
   *   "company": "Updated Company",
   *   "title": "Senior Engineer",
   *   "version": 1
   * }
   */
  updateContactSchema: Joi.object({
    firstName: Joi.string().min(1).max(100).required()
      .description('First name of the contact'),
    lastName: Joi.string().min(1).max(100).required()
      .description('Last name of the contact'),
    email: Joi.string().email().required()
      .description('Email address of the contact'),
    phone: Joi.string().max(50).allow(null, '')
      .description('Phone number of the contact'),
    company: Joi.string().max(200).allow(null, '')
      .description('Company name of the contact'),
    title: Joi.string().max(200).allow(null, '')
      .description('Job title of the contact'),
    address: Joi.object({
      street: Joi.string().max(200).allow(null, ''),
      city: Joi.string().max(100).allow(null, ''),
      state: Joi.string().max(100).allow(null, ''),
      postalCode: Joi.string().max(20).allow(null, ''),
      country: Joi.string().max(100).allow(null, '')
    }).allow(null)
      .description('Address of the contact'),
    notes: Joi.string().allow(null, '')
      .description('Notes about the contact'),
    status: Joi.string().valid('active', 'inactive', 'pending').default('active')
      .description('Status of the contact'),
    tags: Joi.array().items(Joi.string()).default([])
      .description('Tags associated with the contact'),
    customFields: Joi.object().pattern(
      Joi.string(), 
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ).default({})
      .description('Custom fields for the contact'),
    version: Joi.number().integer().min(1).required()
      .description('Version number for optimistic concurrency control')
  }),

  /**
   * Schema for partially updating a contact (PATCH)
   * All fields are optional
   * 
   * Example valid data:
   * {
   *   "firstName": "John",
   *   "lastName": "Smith",
   *   "version": 1
   * }
   */
  patchContactSchema: Joi.object({
    firstName: Joi.string().min(1).max(100)
      .description('First name of the contact'),
    lastName: Joi.string().min(1).max(100)
      .description('Last name of the contact'),
    email: Joi.string().email()
      .description('Email address of the contact'),
    phone: Joi.string().max(50).allow(null, '')
      .description('Phone number of the contact'),
    company: Joi.string().max(200).allow(null, '')
      .description('Company name of the contact'),
    title: Joi.string().max(200).allow(null, '')
      .description('Job title of the contact'),
    address: Joi.object({
      street: Joi.string().max(200).allow(null, ''),
      city: Joi.string().max(100).allow(null, ''),
      state: Joi.string().max(100).allow(null, ''),
      postalCode: Joi.string().max(20).allow(null, ''),
      country: Joi.string().max(100).allow(null, '')
    }).allow(null)
      .description('Address of the contact'),
    notes: Joi.string().allow(null, '')
      .description('Notes about the contact'),
    status: Joi.string().valid('active', 'inactive', 'pending')
      .description('Status of the contact'),
    tags: Joi.array().items(Joi.string())
      .description('Tags associated with the contact'),
    customFields: Joi.object().pattern(
      Joi.string(), 
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    )
      .description('Custom fields for the contact'),
    version: Joi.number().integer().min(1).required()
      .description('Version number for optimistic concurrency control')
  }).min(2) // Require at least one field to update plus version
    .message('At least one field to update must be provided'),

  createAcmeContactSchema: Joi.object({
    id: Joi.string().required()
      .description('AcmeCRM contact ID'),
    acme_first_name: Joi.string().min(1).max(100).required()
      .description('First name of the contact in AcmeCRM'),
    acme_last_name: Joi.string().min(1).max(100).required()
      .description('Last name of the contact in AcmeCRM'),
    acme_email: Joi.string().email().required()
      .description('Email address of the contact in AcmeCRM'),
    acme_phone: Joi.string().max(50).allow(null, '')
      .description('Phone number of the contact in AcmeCRM'),
    acme_company: Joi.string().max(200).allow(null, '')
      .description('Company name of the contact in AcmeCRM'),
    acme_title: Joi.string().max(200).allow(null, '')
      .description('Job title of the contact in AcmeCRM'),
    acme_address: Joi.object({
      street: Joi.string().max(200).allow(null, ''),
      city: Joi.string().max(100).allow(null, ''),
      state: Joi.string().max(100).allow(null, ''),
      postal_code: Joi.string().max(20).allow(null, ''),
      country: Joi.string().max(100).allow(null, '')
    }).allow(null)
      .description('Address of the contact in AcmeCRM'),
    acme_notes: Joi.string().allow(null, '')
      .description('Notes about the contact in AcmeCRM'),
    acme_status: Joi.string().allow(null, '')
      .description('Status of the contact in AcmeCRM'),
    acme_tags: Joi.array().items(Joi.string()).default([])
      .description('Tags associated with the contact in AcmeCRM'),
    acme_custom_fields: Joi.object().pattern(
      Joi.string(), 
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ).default({})
      .description('Custom fields for the contact in AcmeCRM')
  }),

  /**
   * Schema for pagination and filtering parameters
   * 
   * Example valid query parameters:
   * ?page=2&limit=20&sort=lastName&order=asc&search=john&source=acmecrm&status=active
   */
  paginationSchema: Joi.object({
    page: Joi.number().integer().min(1).default(1)
      .description('Page number'),
    limit: Joi.number().integer().min(1).max(100).default(10)
      .description('Number of items per page'),
    sort: Joi.string().valid(
      'firstName', 'lastName', 'email', 'company', 'createdAt', 'updatedAt'
    ).default('createdAt')
      .description('Field to sort by'),
    order: Joi.string().valid('asc', 'desc').default('desc')
      .description('Sort order'),
    search: Joi.string().allow('', null)
      .description('Search term for name, email, or company'),
    source: Joi.string().allow('', null)
      .description('Filter by source system'),
    status: Joi.string().valid('active', 'inactive', 'pending').allow('', null)
      .description('Filter by status')
  })
};

/**
 * Authentication validation schemas
 */
const authSchemas = {
  /**
   * Schema for login requests
   * 
   * Example valid data:
   * {
   *   "username": "user@example.com",
   *   "password": "password123"
   * }
   */
  loginSchema: Joi.object({
    username: Joi.string().required()
      .description('Username or email address'),
    password: Joi.string().required()
      .description('Password')
  }),

  /**
   * Schema for token refresh requests
   * 
   * Example valid data:
   * {
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  refreshTokenSchema: Joi.object({
    refreshToken: Joi.string().required()
      .description('Refresh token')
  })
};

module.exports = {
  contactSchemas,
  authSchemas
};
