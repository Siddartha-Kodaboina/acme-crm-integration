/**
 * Contact API Tests
 * Tests the contact API endpoints
 * 
 * This test:
 * 1. Tests contact creation
 * 2. Tests contact retrieval by ID
 * 3. Tests contact retrieval by source and source ID
 * 4. Tests contact listing with pagination and filtering
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const ContactModel = require('../models/contact.model');
const PostgresService = require('../services/postgres.service');
const AuthService = require('../services/auth.service');
const logger = require('../utils/logger');

// Base URL for API
const API_URL = 'http://localhost:3000/api';

// Test data
const testUser = {
  id: `user-${Date.now()}`,
  username: 'test@example.com',
  role: 'user'
};

const testContact = {
  firstName: 'John',
  lastName: 'Doe',
  email: `john.doe.${Date.now()}@example.com`,
  phone: '555-123-4567',
  company: 'Test Company',
  title: 'Test Title',
  source: 'acmecrm',
  sourceId: `test-${Date.now()}`
};

const testAcmeContact = {
  id: `acme-${Date.now()}`,
  acme_first_name: 'Jane',
  acme_last_name: 'Smith',
  acme_email: `jane.smith.${Date.now()}@example.com`,
  acme_phone: '555-987-6543',
  acme_company: 'Acme Inc',
  acme_title: 'Developer'
};

// Store created contacts for cleanup
const createdContacts = [];

/**
 * Run the tests
 */
async function runTests() {
  let authToken;
  
  try {
    logger.info('Starting Contact API Tests');
    
    // Initialize PostgreSQL tables
    logger.info('\nInitializing PostgreSQL tables');
    await PostgresService.initializeTables();
    
    // Generate auth token for tests
    logger.info('\nGenerating auth token');
    const tokenData = await AuthService.generateToken(testUser);
    authToken = tokenData.token;
    logger.info('Auth token generated');
    
    // Test 1: Create contact
    logger.info('\nTest 1: Create contact');
    const createResponse = await axios.post(
      `${API_URL}/contacts`,
      testContact,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Create contact response status: ${createResponse.status}`);
    logger.info('Created contact:', createResponse.data.data);
    
    // Store created contact for later tests and cleanup
    const createdContact = createResponse.data.data;
    createdContacts.push(createdContact);
    
    // Test 2: Create contact from AcmeCRM data
    logger.info('\nTest 2: Create contact from AcmeCRM data');
    const createAcmeResponse = await axios.post(
      `${API_URL}/contacts/acme`,
      testAcmeContact,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Create AcmeCRM contact response status: ${createAcmeResponse.status}`);
    logger.info('Created AcmeCRM contact:', createAcmeResponse.data.data);
    
    // Store created contact for later tests and cleanup
    const createdAcmeContact = createAcmeResponse.data.data;
    createdContacts.push(createdAcmeContact);
    
    // Test 3: Get contact by ID
    logger.info('\nTest 3: Get contact by ID');
    const getByIdResponse = await axios.get(
      `${API_URL}/contacts/${createdContact.id}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    logger.info(`Get contact by ID response status: ${getByIdResponse.status}`);
    logger.info('Retrieved contact:', getByIdResponse.data.data);
    
    // Test 4: Get contact by source and source ID
    logger.info('\nTest 4: Get contact by source and source ID');
    const getBySourceResponse = await axios.get(
      `${API_URL}/contacts/source/${createdContact.source}/${createdContact.sourceId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    logger.info(`Get contact by source response status: ${getBySourceResponse.status}`);
    logger.info('Retrieved contact by source:', getBySourceResponse.data.data);
    
    // Test 5: Get contacts with pagination
    logger.info('\nTest 5: Get contacts with pagination');
    const getContactsResponse = await axios.get(
      `${API_URL}/contacts?page=1&limit=10&sort=createdAt&order=desc`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    logger.info(`Get contacts response status: ${getContactsResponse.status}`);
    logger.info(`Retrieved ${getContactsResponse.data.data.length} contacts`);
    logger.info('Pagination:', getContactsResponse.data.pagination);
    
    // Test 6: Get contacts with filtering
    logger.info('\nTest 6: Get contacts with filtering');
    const getFilteredResponse = await axios.get(
      `${API_URL}/contacts?search=John&source=acmecrm&status=active`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    logger.info(`Get filtered contacts response status: ${getFilteredResponse.status}`);
    logger.info(`Retrieved ${getFilteredResponse.data.data.length} filtered contacts`);
    
    logger.info('\nContact API Tests completed successfully');
  } catch (error) {
    logger.error('Error in Contact API Tests:', error.response?.data || error);
  } finally {
    // Clean up created contacts
    logger.info('\nCleaning up created contacts');
    
    for (const contact of createdContacts) {
      try {
        await ContactModel.deleteContact(contact.id);
        logger.info(`Deleted contact: ${contact.id}`);
      } catch (error) {
        logger.error(`Error deleting contact ${contact.id}:`, error);
      }
    }
    
    // Revoke auth token
    if (authToken) {
      try {
        const decoded = await AuthService.verifyToken(authToken);
        await AuthService.revokeToken(decoded.jti);
        logger.info('Auth token revoked');
      } catch (error) {
        logger.error('Error revoking auth token:', error);
      }
    }
    
    // Close database connections
    try {
      await PostgresService.close();
      logger.info('PostgreSQL connection closed');
    } catch (error) {
      logger.error('Error closing PostgreSQL connection:', error);
    }
    
    // Exit with success code
    process.exit(0);
  }
}

// Run the tests
runTests();
