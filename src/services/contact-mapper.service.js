/**
 * Contact Mapper Service
 * Provides methods for mapping between AcmeCRM and internal contact formats
 * 
 * This service implements:
 * 1. Mapping from AcmeCRM format to internal format
 * 2. Mapping from internal format to AcmeCRM format
 * 3. Address parsing and formatting
 * 4. Field transformations
 */

const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const acmeContactSchema = require('../models/schemas/acme-contact.schema');
const internalContactSchema = require('../models/schemas/internal-contact.schema');

/**
 * Parse a flat address string into structured address components
 * @param {string} addressString - Flat address string
 * @returns {Object} Structured address object
 * 
 * Example:
 * Input: "123 Main St, San Francisco, CA 94105, USA"
 * Output: {
 *   street: "123 Main St",
 *   city: "San Francisco",
 *   state: "CA",
 *   zipCode: "94105",
 *   country: "USA"
 * }
 */
function parseAddress(addressString) {
  if (!addressString) {
    return {};
  }
  
  // Simple address parser - in a real application, you might use a more sophisticated library
  const parts = addressString.split(',').map(part => part.trim());
  
  // Default structure
  const address = {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  };
  
  // Try to extract components based on position and patterns
  if (parts.length >= 1) {
    address.street = parts[0];
  }
  
  if (parts.length >= 2) {
    address.city = parts[1];
  }
  
  if (parts.length >= 3) {
    // Check if the third part contains a state and zip code
    const stateZip = parts[2].split(' ').filter(p => p.trim());
    if (stateZip.length >= 1) {
      address.state = stateZip[0];
    }
    if (stateZip.length >= 2) {
      address.zipCode = stateZip[1];
    }
  }
  
  if (parts.length >= 4) {
    address.country = parts[3];
  }
  
  return address;
}

/**
 * Format a structured address object into a flat address string
 * @param {Object} address - Structured address object
 * @returns {string} Flat address string
 * 
 * Example:
 * Input: {
 *   street: "123 Main St",
 *   city: "San Francisco",
 *   state: "CA",
 *   zipCode: "94105",
 *   country: "USA"
 * }
 * Output: "123 Main St, San Francisco, CA 94105, USA"
 */
function formatAddress(address) {
  if (!address) {
    return '';
  }
  
  const parts = [];
  
  if (address.street) {
    parts.push(address.street);
  }
  
  if (address.city) {
    parts.push(address.city);
  }
  
  if (address.state || address.zipCode) {
    const stateZip = [address.state, address.zipCode].filter(Boolean).join(' ');
    if (stateZip) {
      parts.push(stateZip);
    }
  }
  
  if (address.country) {
    parts.push(address.country);
  }
  
  return parts.join(', ');
}

/**
 * Map AcmeCRM contact to internal contact format
 * @param {Object} acmeContact - Contact in AcmeCRM format
 * @returns {Object} Contact in internal format
 * 
 * Example:
 * Input: 
 * {
 *   "id": "123456",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Doe",
 *   "acme_email": "john.doe@example.com",
 *   "acme_address": "123 Main St, San Francisco, CA 94105, USA",
 *   "acme_status": "Active"
 * }
 * 
 * Output:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "address": {
 *     "street": "123 Main St",
 *     "city": "San Francisco",
 *     "state": "CA",
 *     "zipCode": "94105",
 *     "country": "USA"
 *   },
 *   "status": "active",
 *   "source": "acmecrm",
 *   "sourceId": "123456"
 * }
 */
function mapAcmeToInternal(acmeContact) {
  try {
    // Validate the AcmeCRM contact
    const { error } = acmeContactSchema.validateAcmeContact(acmeContact, { allowUnknown: true });
    if (error) {
      throw new AppError('Invalid AcmeCRM contact data', errorTypes.VALIDATION_ERROR, {
        code: errorCodes.INVALID_INPUT,
        details: error.details
      });
    }
    
    // Check if migration is needed
    if (acmeContactSchema.needsMigration(acmeContact)) {
      acmeContact = acmeContactSchema.migrateContact(acmeContact);
    }
    
    // Map the fields
    const internalContact = {
      // Generate a new UUID for our system
      id: uuidv4(),
      
      // Direct mappings
      firstName: acmeContact.acme_first_name,
      lastName: acmeContact.acme_last_name,
      email: acmeContact.acme_email,
      phone: acmeContact.acme_phone || '',
      company: acmeContact.acme_company || '',
      title: acmeContact.acme_title || '',
      notes: acmeContact.acme_notes || '',
      
      // Transform address from string to structured object
      address: parseAddress(acmeContact.acme_address),
      
      // Transform status to lowercase
      status: acmeContact.acme_status ? acmeContact.acme_status.toLowerCase() : 'active',
      
      // Direct array/object mappings
      tags: acmeContact.acme_tags || [],
      customFields: acmeContact.acme_custom_fields || {},
      
      // Source tracking
      source: 'acmecrm',
      sourceId: acmeContact.id,
      
      // Metadata
      createdAt: acmeContact.acme_created_at,
      updatedAt: acmeContact.acme_updated_at,
      version: internalContactSchema.CURRENT_VERSION
    };
    
    // Validate the mapped contact
    const { error: validationError, value } = internalContactSchema.validateInternalContact(internalContact);
    if (validationError) {
      throw new AppError('Error mapping to internal contact format', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.VALIDATION_ERROR,
        details: validationError.details
      });
    }
    
    return value;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to map AcmeCRM contact to internal format', errorTypes.INTERNAL_ERROR, {
      code: errorCodes.INTERNAL_SERVER_ERROR,
      details: error.message
    });
  }
}

/**
 * Map internal contact to AcmeCRM format
 * @param {Object} internalContact - Contact in internal format
 * @returns {Object} Contact in AcmeCRM format
 * 
 * Example:
 * Input:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com",
 *   "address": {
 *     "street": "123 Main St",
 *     "city": "San Francisco",
 *     "state": "CA",
 *     "zipCode": "94105",
 *     "country": "USA"
 *   },
 *   "status": "active",
 *   "source": "acmecrm",
 *   "sourceId": "123456"
 * }
 * 
 * Output:
 * {
 *   "id": "123456",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Doe",
 *   "acme_email": "john.doe@example.com",
 *   "acme_address": "123 Main St, San Francisco, CA 94105, USA",
 *   "acme_status": "Active"
 * }
 */
function mapInternalToAcme(internalContact) {
  try {
    // Validate the internal contact
    const { error } = internalContactSchema.validateInternalContact(internalContact, { allowUnknown: true });
    if (error) {
      throw new AppError('Invalid internal contact data', errorTypes.VALIDATION_ERROR, {
        code: errorCodes.INVALID_INPUT,
        details: error.details
      });
    }
    
    // Check if migration is needed
    if (internalContactSchema.needsMigration(internalContact)) {
      internalContact = internalContactSchema.migrateContact(internalContact);
    }
    
    // Map the fields
    const acmeContact = {
      // Use the sourceId as the AcmeCRM id
      id: internalContact.sourceId,
      
      // Direct mappings
      acme_first_name: internalContact.firstName,
      acme_last_name: internalContact.lastName,
      acme_email: internalContact.email,
      acme_phone: internalContact.phone || '',
      acme_company: internalContact.company || '',
      acme_title: internalContact.title || '',
      acme_notes: internalContact.notes || '',
      
      // Transform address from structured object to string
      acme_address: formatAddress(internalContact.address),
      
      // Transform status to proper case
      acme_status: internalContact.status ? 
        internalContact.status.charAt(0).toUpperCase() + internalContact.status.slice(1) : 
        'Active',
      
      // Direct array/object mappings
      acme_tags: internalContact.tags || [],
      acme_custom_fields: internalContact.customFields || {},
      
      // Metadata
      acme_created_at: internalContact.createdAt,
      acme_updated_at: internalContact.updatedAt,
      acme_version: acmeContactSchema.CURRENT_VERSION
    };
    
    // Validate the mapped contact
    const { error: validationError, value } = acmeContactSchema.validateAcmeContact(acmeContact);
    if (validationError) {
      throw new AppError('Error mapping to AcmeCRM contact format', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.VALIDATION_ERROR,
        details: validationError.details
      });
    }
    
    return value;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to map internal contact to AcmeCRM format', errorTypes.INTERNAL_ERROR, {
      code: errorCodes.INTERNAL_SERVER_ERROR,
      details: error.message
    });
  }
}

/**
 * Update an internal contact with AcmeCRM data
 * @param {Object} existingContact - Existing internal contact
 * @param {Object} acmeContact - New AcmeCRM contact data
 * @returns {Object} Updated internal contact
 * 
 * Example:
 * Input:
 * existingContact: {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john.doe@example.com"
 * }
 * acmeContact: {
 *   "id": "123456",
 *   "acme_first_name": "John",
 *   "acme_last_name": "Smith",
 *   "acme_email": "john.smith@example.com"
 * }
 * 
 * Output:
 * {
 *   "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
 *   "firstName": "John",
 *   "lastName": "Smith",
 *   "email": "john.smith@example.com",
 *   "updatedAt": "2025-05-18T10:15:30.123Z"
 * }
 */
function updateInternalFromAcme(existingContact, acmeContact) {
  try {
    // Map the AcmeCRM contact to internal format
    const mappedContact = mapAcmeToInternal(acmeContact);
    
    // Preserve the existing ID and creation date
    mappedContact.id = existingContact.id;
    mappedContact.createdAt = existingContact.createdAt;
    
    // Update the timestamp
    mappedContact.updatedAt = new Date().toISOString();
    
    return mappedContact;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update internal contact from AcmeCRM data', errorTypes.INTERNAL_ERROR, {
      code: errorCodes.INTERNAL_SERVER_ERROR,
      details: error.message
    });
  }
}

module.exports = {
  parseAddress,
  formatAddress,
  mapAcmeToInternal,
  mapInternalToAcme,
  updateInternalFromAcme
};
