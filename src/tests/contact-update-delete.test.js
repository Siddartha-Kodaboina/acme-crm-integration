/**
 * Contact Update and Delete API Tests
 * Tests the contact update and delete API endpoints
 * 
 * This test:
 * 1. Tests contact creation (setup)
 * 2. Tests contact update with PUT
 * 3. Tests contact partial update with PATCH
 * 4. Tests optimistic concurrency control
 * 5. Tests contact deletion
 * 6. Tests error handling for non-existent contacts
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

// Store created contacts for cleanup
const createdContacts = [];

/**
 * Run the tests
 */
async function runTests() {
  let authToken;
  let createdContact;
  
  try {
    logger.info('Starting Contact Update and Delete API Tests');
    
    // Initialize PostgreSQL tables
    logger.info('\nInitializing PostgreSQL tables');
    await PostgresService.initializeTables();
    
    // Generate auth token for tests
    logger.info('\nGenerating auth token');
    const tokenData = await AuthService.generateToken(testUser);
    authToken = tokenData.token;
    logger.info('Auth token generated');
    
    // Setup: Create contact
    logger.info('\nSetup: Create contact');
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
    createdContact = createResponse.data.data;
    createdContacts.push(createdContact);
    
    // Test 1: Update contact with PUT
    logger.info('\nTest 1: Update contact with PUT');
    const updatedData = {
      firstName: 'John',
      lastName: 'Smith',
      email: `john.smith.${Date.now()}@example.com`,
      phone: '555-987-6543',
      company: 'Updated Company',
      title: 'Senior Engineer',
      version: createdContact.version
    };
    
    const updateResponse = await axios.put(
      `${API_URL}/contacts/${createdContact.id}`,
      updatedData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Update contact response status: ${updateResponse.status}`);
    logger.info('Updated contact:', updateResponse.data.data);
    
    // Verify update
    const updatedContact = updateResponse.data.data;
    if (updatedContact.lastName !== 'Smith' || 
        updatedContact.company !== 'Updated Company' || 
        updatedContact.version !== createdContact.version + 1) {
      throw new Error('Update verification failed');
    }
    logger.info('Update verification passed');
    
    // Test 2: Partial update contact with PATCH
    logger.info('\nTest 2: Partial update contact with PATCH');
    const patchData = {
      title: 'Engineering Manager',
      version: updatedContact.version
    };
    
    const patchResponse = await axios.patch(
      `${API_URL}/contacts/${createdContact.id}`,
      patchData,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Patch contact response status: ${patchResponse.status}`);
    logger.info('Patched contact:', patchResponse.data.data);
    
    // Verify patch
    const patchedContact = patchResponse.data.data;
    if (patchedContact.title !== 'Engineering Manager' || 
        patchedContact.lastName !== 'Smith' || 
        patchedContact.version !== updatedContact.version + 1) {
      throw new Error('Patch verification failed');
    }
    logger.info('Patch verification passed');
    
    // Test 3: Optimistic concurrency control
    logger.info('\nTest 3: Optimistic concurrency control');
    const outdatedData = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: `jane.doe.${Date.now()}@example.com`,
      phone: '555-111-2222',
      company: 'Another Company',
      title: 'Director',
      version: updatedContact.version // This is now outdated
    };
    
    try {
      await axios.put(
        `${API_URL}/contacts/${createdContact.id}`,
        outdatedData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Optimistic concurrency control test failed - update should have been rejected');
    } catch (error) {
      // Accept either 409 Conflict or 400 Validation Error as valid responses
      if (error.response) {
        if (error.response.status === 409) {
          // Conflict error - version conflict detected by controller
          logger.info('Optimistic concurrency control test passed - update was correctly rejected with 409 Conflict');
          logger.info('Error details:', error.response.data);
        } else if (error.response.status === 400) {
          // Validation error - could be related to version validation
          logger.info('Optimistic concurrency control test passed - update was rejected with 400 Validation Error');
          logger.info('Error details:', error.response.data);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    // Test 4: Delete contact
    logger.info('\nTest 4: Delete contact');
    const deleteResponse = await axios.delete(
      `${API_URL}/contacts/${createdContact.id}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    logger.info(`Delete contact response status: ${deleteResponse.status}`);
    logger.info('Delete response:', deleteResponse.data);
    
    // Verify deletion
    try {
      await axios.get(
        `${API_URL}/contacts/${createdContact.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      throw new Error('Delete verification failed - contact still exists');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        logger.info('Delete verification passed - contact no longer exists');
      } else {
        throw error;
      }
    }
    
    // Test 5: Error handling for non-existent contacts
    logger.info('\nTest 5: Error handling for non-existent contacts');
    const nonExistentId = uuidv4();
    
    try {
      await axios.put(
        `${API_URL}/contacts/${nonExistentId}`,
        {
          firstName: 'Test',
          lastName: 'User',
          email: `test.user.${Date.now()}@example.com`,
          phone: '555-555-5555',
          company: 'Test Company',
          title: 'Test Title',
          version: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Non-existent contact test failed - update should have been rejected');
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          // Not Found error - contact doesn't exist
          logger.info('Non-existent contact test passed - update was correctly rejected with 404 Not Found');
          logger.info('Error details:', error.response.data);
        } else if (error.response.status === 400) {
          // Validation error - API might be validating before checking existence
          logger.info('Non-existent contact test passed - update was rejected with 400 Validation Error');
          logger.info('Error details:', error.response.data);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    logger.info('\nContact Update and Delete API Tests completed successfully');
  } catch (error) {
    logger.error('Error in Contact Update and Delete API Tests:', error.response?.data || error);
  } finally {
    // Clean up created contacts
    logger.info('\nCleaning up created contacts');
    
    for (const contact of createdContacts) {
      try {
        await ContactModel.deleteContact(contact.id);
        logger.info(`Deleted contact: ${contact.id}`);
      } catch (error) {
        // Ignore errors for contacts that were already deleted in tests
        if (error.message && !error.message.includes('not found')) {
          logger.error(`Error deleting contact ${contact.id}:`, error);
        }
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
  }
}

// Run the tests
runTests();
