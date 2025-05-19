/**
 * Integration Test
 * Tests the integration between all components
 * 
 * This test:
 * 1. Initializes the PostgreSQL database
 * 2. Tests the contact model with PostgreSQL storage
 * 3. Tests the AcmeCRM integration flow
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
  acme_email: 'john.doe@example.com',
  acme_phone: '555-123-4567',
  acme_company: 'ACME Inc.',
  acme_title: 'Software Engineer',
  acme_notes: 'Test contact',
  acme_status: 'Active' // Changed from 'active' to 'Active' to match schema validation
};

/**
 * Run the integration test
 */
async function runIntegrationTest() {
  try {
    logger.info('Starting Integration Test');
    
    // Initialize PostgreSQL tables
    logger.info('\nStep 1: Initialize PostgreSQL tables');
    await PostgresService.initializeTables();
    logger.info('PostgreSQL tables initialized');
    
    // Create contact from AcmeCRM data
    logger.info('\nStep 2: Create contact from AcmeCRM data');
    const createdContact = await ContactModel.createFromAcmeData(testAcmeContact);
    logger.info('Created contact from AcmeCRM data:', createdContact);
    
    // Verify AcmeCRM data is stored in PostgreSQL
    logger.info('\nStep 3: Verify AcmeCRM data is stored in PostgreSQL');
    const acmeContact = await PostgresService.getAcmeContact(testAcmeContact.id);
    logger.info('AcmeCRM contact from PostgreSQL:', acmeContact);
    
    // Verify internal contact is stored in PostgreSQL
    logger.info('\nStep 4: Verify internal contact is stored in PostgreSQL');
    const internalContact = await PostgresService.getInternalContactBySourceId('acmecrm', testAcmeContact.id);
    logger.info('Internal contact from PostgreSQL:', internalContact);
    
    // Update contact
    logger.info('\nStep 5: Update contact');
    const updatedContact = await ContactModel.updateContact(createdContact.id, {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
      company: 'ACME Corporation'
    });
    logger.info('Updated contact:', updatedContact);
    
    // Verify update in PostgreSQL
    logger.info('\nStep 6: Verify update in PostgreSQL');
    const updatedInternalContact = await PostgresService.getInternalContact(createdContact.id);
    logger.info('Updated internal contact from PostgreSQL:', updatedInternalContact);
    
    // Delete contact
    logger.info('\nStep 7: Delete contact');
    const deleteResult = await ContactModel.deleteContact(createdContact.id);
    logger.info(`Deleted contact ${createdContact.id}: ${deleteResult}`);
    
    // Verify deletion in PostgreSQL
    logger.info('\nStep 8: Verify deletion in PostgreSQL');
    const deletedInternalContact = await PostgresService.getInternalContact(createdContact.id);
    logger.info(`Verify internal contact deletion: ${deletedInternalContact === null ? 'Success' : 'Failed'}`);
    
    const deletedAcmeContact = await PostgresService.getAcmeContact(testAcmeContact.id);
    logger.info(`Verify AcmeCRM contact deletion: ${deletedAcmeContact === null ? 'Success' : 'Failed'}`);
    
    logger.info('\nIntegration Test completed successfully');
  } catch (error) {
    logger.error('Error in Integration Test:', error);
  } finally {
    // Close PostgreSQL connection
    logger.info('Closing PostgreSQL connection pool...');
    await PostgresService.close();
    logger.info('PostgreSQL connection pool closed');
  }
}

// Run the integration test
runIntegrationTest();
