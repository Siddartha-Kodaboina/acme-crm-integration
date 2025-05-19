/**
 * Contact Model with PostgreSQL Test
 * Tests the contact model with PostgreSQL storage adapter
 * 
 * This test:
 * 1. Verifies that the contact model works with PostgreSQL storage
 * 2. Tests CRUD operations for contacts
 * 3. Tests mapping between AcmeCRM and internal formats
 */

const { v4: uuidv4 } = require('uuid');
const ContactModel = require('../models/contact.model');
const PostgresService = require('../services/postgres.service');
const logger = require('../utils/logger');

// Set environment variable to use PostgreSQL storage
process.env.STORAGE_TYPE = 'postgres';

// Test data
const testAcmeContact = {
  id: `test-acme-${Date.now()}`,
  acme_first_name: 'John',
  acme_last_name: 'Doe',
  acme_email: 'john.doe@example.com'
};

const testInternalContact = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  source: 'acmecrm',
  sourceId: `test-source-${Date.now()}`
};

/**
 * Run the tests
 */
async function runTests() {
  try {
    logger.info('Starting Contact Model with PostgreSQL test');
    
    // Initialize PostgreSQL tables
    logger.info('\nTest 1: Initialize PostgreSQL tables');
    await PostgresService.initializeTables();
    logger.info('PostgreSQL tables initialized');
    
    // Create contact from AcmeCRM data
    logger.info('\nTest 2: Create contact from AcmeCRM data');
    const createdFromAcme = await ContactModel.createFromAcmeData(testAcmeContact);
    logger.info('Created contact from AcmeCRM data:', createdFromAcme);
    
    // Get contact by ID
    logger.info('\nTest 3: Get contact by ID');
    const retrievedById = await ContactModel.getContactById(createdFromAcme.id);
    logger.info('Retrieved contact by ID:', retrievedById);
    
    // Get contact by source ID
    logger.info('\nTest 4: Get contact by source ID');
    const retrievedBySourceId = await ContactModel.getContactBySourceId('acmecrm', testAcmeContact.id);
    logger.info('Retrieved contact by source ID:', retrievedBySourceId);
    
    // Create internal contact
    logger.info('\nTest 5: Create internal contact');
    const createdInternal = await ContactModel.createContact(testInternalContact);
    logger.info('Created internal contact:', createdInternal);
    
    // Update contact
    logger.info('\nTest 6: Update contact');
    const updatedContact = await ContactModel.updateContact(createdFromAcme.id, {
      firstName: 'John Updated',
      lastName: 'Doe Updated'
    });
    logger.info('Updated contact:', updatedContact);
    
    // Delete contacts
    logger.info('\nTest 7: Delete contacts');
    const deleteResult1 = await ContactModel.deleteContact(createdFromAcme.id);
    logger.info(`Deleted contact ${createdFromAcme.id}: ${deleteResult1}`);
    
    const deleteResult2 = await ContactModel.deleteContact(createdInternal.id);
    logger.info(`Deleted contact ${createdInternal.id}: ${deleteResult2}`);
    
    // Verify deletion
    const verifyDelete1 = await ContactModel.getContactById(createdFromAcme.id);
    logger.info(`Verify deletion of ${createdFromAcme.id}: ${verifyDelete1 === null ? 'Success' : 'Failed'}`);
    
    const verifyDelete2 = await ContactModel.getContactById(createdInternal.id);
    logger.info(`Verify deletion of ${createdInternal.id}: ${verifyDelete2 === null ? 'Success' : 'Failed'}`);
    
    logger.info('\nContact Model with PostgreSQL test completed successfully');
  } catch (error) {
    logger.error('Error in Contact Model with PostgreSQL test:', error);
  } finally {
    // Close PostgreSQL connection
    logger.info('Closing PostgreSQL connection pool...');
    await PostgresService.close();
    logger.info('PostgreSQL connection pool closed');
  }
}

// Run the tests
runTests();
