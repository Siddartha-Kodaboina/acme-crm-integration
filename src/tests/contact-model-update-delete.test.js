/**
 * Contact Model Update and Delete Tests
 * Tests the contact model update and delete functionality
 * 
 * This test:
 * 1. Tests contact model update method
 * 2. Tests contact model partial update
 * 3. Tests optimistic concurrency control
 * 4. Tests contact model delete method
 */

const { v4: uuidv4 } = require('uuid');
const ContactModel = require('../models/contact.model');
const PostgresService = require('../services/postgres.service');
const logger = require('../utils/logger');

// Store created contacts for cleanup
const createdContacts = [];

/**
 * Run the tests
 */
async function runTests() {
  try {
    logger.info('Starting Contact Model Update and Delete Tests');
    
    // Initialize PostgreSQL tables
    logger.info('\nInitializing PostgreSQL tables');
    await PostgresService.initializeTables();
    
    // Test 1: Create contact for testing
    logger.info('\nTest 1: Create contact for testing');
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
    
    const createdContact = await ContactModel.createContact(testContact);
    logger.info('Created contact:', createdContact);
    createdContacts.push(createdContact);
    
    // Test 2: Update contact
    logger.info('\nTest 2: Update contact');
    const updateData = {
      firstName: 'John',
      lastName: 'Smith',
      email: `john.smith.${Date.now()}@example.com`,
      phone: '555-987-6543',
      company: 'Updated Company',
      title: 'Senior Engineer',
      version: createdContact.version
    };
    
    const updatedContact = await ContactModel.updateContact(createdContact.id, updateData);
    logger.info('Updated contact:', updatedContact);
    
    // Verify update
    if (updatedContact.lastName !== 'Smith' || 
        updatedContact.company !== 'Updated Company') {
      throw new Error('Update verification failed');
    }
    logger.info('Update verification passed');
    
    // Test 3: Partial update
    logger.info('\nTest 3: Partial update');
    const patchData = {
      title: 'Engineering Manager',
      version: updatedContact.version
    };
    
    const patchedContact = await ContactModel.updateContact(createdContact.id, patchData);
    logger.info('Patched contact:', patchedContact);
    
    // Verify patch
    if (patchedContact.title !== 'Engineering Manager' || 
        patchedContact.lastName !== 'Smith') {
      throw new Error('Patch verification failed');
    }
    logger.info('Patch verification passed');
    
    // Test 4: Optimistic concurrency control
    logger.info('\nTest 4: Optimistic concurrency control');
    const outdatedData = {
      firstName: 'Jane',
      lastName: 'Doe',
      version: updatedContact.version // This is now outdated
    };
    
    try {
      await ContactModel.updateContact(createdContact.id, outdatedData);
      throw new Error('Optimistic concurrency control test failed - update should have been rejected');
    } catch (error) {
      if (error.type === 'CONFLICT' && error.details && error.details.currentVersion) {
        logger.info('Optimistic concurrency control test passed - update was correctly rejected');
        logger.info('Error details:', error.details);
      } else {
        throw error;
      }
    }
    
    // Test 5: Delete contact
    logger.info('\nTest 5: Delete contact');
    const deleteResult = await ContactModel.deleteContact(createdContact.id);
    logger.info('Delete result:', deleteResult);
    
    // Verify deletion
    const deletedContact = await ContactModel.getContactById(createdContact.id);
    if (deletedContact) {
      throw new Error('Delete verification failed - contact still exists');
    }
    logger.info('Delete verification passed - contact no longer exists');
    
    // Remove from cleanup list since it's already deleted
    createdContacts.pop();
    
    // Test 6: Delete non-existent contact
    logger.info('\nTest 6: Delete non-existent contact');
    const nonExistentId = uuidv4();
    
    const nonExistentDeleteResult = await ContactModel.deleteContact(nonExistentId);
    if (nonExistentDeleteResult !== false) {
      throw new Error('Non-existent contact delete test failed - should return false');
    }
    logger.info('Non-existent contact delete test passed - returned false');
    
    logger.info('\nContact Model Update and Delete Tests completed successfully');
  } catch (error) {
    logger.error('Error in Contact Model Update and Delete Tests:', error);
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
