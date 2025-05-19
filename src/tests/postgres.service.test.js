/**
 * Test file for PostgreSQL Service
 * Run with: node src/tests/postgres.service.test.js
 */

const { v4: uuidv4 } = require('uuid');
const PostgresService = require('../services/postgres.service');
const logger = require('../utils/logger');

/**
 * Test data for AcmeCRM contact
 */
const testAcmeContact = {
  id: "test-acme-" + Date.now(),
  acme_first_name: "John",
  acme_last_name: "Doe",
  acme_email: "john.doe@example.com",
  acme_phone: "+1-555-123-4567",
  acme_company: "Acme Inc",
  acme_title: "Software Engineer",
  acme_address: "123 Main St, San Francisco, CA 94105, USA",
  acme_notes: "Met at conference",
  acme_status: "Active",
  acme_tags: ["customer", "tech"],
  acme_custom_fields: {
    industry: "Technology",
    referral_source: "Website"
  },
  acme_created_at: new Date().toISOString(),
  acme_updated_at: new Date().toISOString(),
  acme_version: 1
};

/**
 * Test data for internal contact
 */
const testInternalContact = {
  id: uuidv4(),
  firstName: "Jane",
  lastName: "Smith",
  email: "jane.smith@example.com",
  phone: "+1-555-987-6543",
  company: "Smith Corp",
  title: "Product Manager",
  address: {
    street: "456 Market St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    country: "USA"
  },
  notes: "Potential partner",
  status: "active",
  tags: ["prospect", "enterprise"],
  customFields: {
    industry: "Finance",
    referralSource: "Conference"
  },
  source: "acmecrm",
  sourceId: "test-source-" + Date.now(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

/**
 * Simple test function to verify PostgreSQL Service
 */
async function testPostgresService() {
  try {
    logger.info('Starting PostgreSQL Service test');
    
    // Test 1: Connect to PostgreSQL
    logger.info('\nTest 1: Connect to PostgreSQL');
    const pool = PostgresService.getPool();
    logger.info('PostgreSQL connection established');
    
    // Test 2: Initialize tables (only if needed)
    logger.info('\nTest 2: Initialize tables');
    try {
      await PostgresService.initializeTables();
      logger.info('Tables initialized successfully');
    } catch (error) {
      // If tables already exist, this is fine
      if (error.message && error.message.includes('already exists')) {
        logger.info('Tables already exist, continuing with tests');
      } else {
        throw error;
      }
    }
    
    // Test 3: Store AcmeCRM contact
    logger.info('\nTest 3: Store AcmeCRM contact');
    const storedAcmeContact = await PostgresService.storeAcmeContact(testAcmeContact.id, testAcmeContact);
    
    logger.info('Stored AcmeCRM contact:', {
      id: storedAcmeContact.id,
      data: {
        acme_first_name: storedAcmeContact.data.acme_first_name,
        acme_last_name: storedAcmeContact.data.acme_last_name,
        acme_email: storedAcmeContact.data.acme_email
      }
    });
    
    // Test 4: Retrieve AcmeCRM contact
    logger.info('\nTest 4: Retrieve AcmeCRM contact');
    const retrievedAcmeContact = await PostgresService.getAcmeContact(testAcmeContact.id);
    
    if (!retrievedAcmeContact) {
      throw new Error(`AcmeCRM contact with ID ${testAcmeContact.id} not found`);
    }
    
    logger.info('Retrieved AcmeCRM contact:', {
      id: retrievedAcmeContact.id,
      acme_first_name: retrievedAcmeContact.acme_first_name,
      acme_last_name: retrievedAcmeContact.acme_last_name,
      acme_email: retrievedAcmeContact.acme_email
    });
    
    // Test 5: Store internal contact
    logger.info('\nTest 5: Store internal contact');
    const storedInternalContact = await PostgresService.storeInternalContact(testInternalContact.id, testInternalContact);
    
    logger.info('Stored internal contact:', {
      id: storedInternalContact.id,
      first_name: storedInternalContact.first_name,
      last_name: storedInternalContact.last_name,
      email: storedInternalContact.email,
      source: storedInternalContact.source,
      source_id: storedInternalContact.source_id
    });
    
    // Test 6: Retrieve internal contact by ID
    logger.info('\nTest 6: Retrieve internal contact by ID');
    const retrievedInternalContact = await PostgresService.getInternalContact(testInternalContact.id);
    
    if (!retrievedInternalContact) {
      throw new Error(`Internal contact with ID ${testInternalContact.id} not found`);
    }
    
    logger.info('Retrieved internal contact by ID:', {
      id: retrievedInternalContact.id,
      firstName: retrievedInternalContact.firstName,
      lastName: retrievedInternalContact.lastName,
      email: retrievedInternalContact.email
    });
    
    // Test 7: Retrieve internal contact by source ID
    logger.info('\nTest 7: Retrieve internal contact by source ID');
    const retrievedBySourceId = await PostgresService.getInternalContactBySourceId(
      testInternalContact.source,
      testInternalContact.sourceId
    );
    
    if (!retrievedBySourceId) {
      throw new Error(`Internal contact with source ${testInternalContact.source} and ID ${testInternalContact.sourceId} not found`);
    }
    
    logger.info('Retrieved internal contact by source ID:', {
      id: retrievedBySourceId.id,
      firstName: retrievedBySourceId.firstName,
      lastName: retrievedBySourceId.lastName,
      email: retrievedBySourceId.email
    });
    
    // Test 8: Update AcmeCRM contact
    logger.info('\nTest 8: Update AcmeCRM contact');
    const updatedAcmeContact = {
      ...testAcmeContact,
      acme_first_name: "John Updated",
      acme_updated_at: new Date().toISOString()
    };
    
    const storedUpdatedAcme = await PostgresService.storeAcmeContact(updatedAcmeContact.id, updatedAcmeContact);
    
    logger.info('Updated AcmeCRM contact:', {
      id: storedUpdatedAcme.id,
      data: {
        acme_first_name: storedUpdatedAcme.data.acme_first_name, // Should be "John Updated"
        acme_last_name: storedUpdatedAcme.data.acme_last_name,
        acme_email: storedUpdatedAcme.data.acme_email
      }
    });
    
    // Test 9: Update internal contact
    logger.info('\nTest 9: Update internal contact');
    const updatedInternalContact = {
      ...testInternalContact,
      firstName: "Jane Updated",
      updatedAt: new Date().toISOString()
    };
    
    const storedUpdatedInternal = await PostgresService.storeInternalContact(updatedInternalContact.id, updatedInternalContact);
    
    logger.info('Updated internal contact:', {
      id: storedUpdatedInternal.id,
      first_name: storedUpdatedInternal.first_name, // Should be "Jane Updated"
      last_name: storedUpdatedInternal.last_name,
      email: storedUpdatedInternal.email
    });
    
    // Test 10: Delete AcmeCRM contact
    logger.info('\nTest 10: Delete AcmeCRM contact');
    const deleteAcmeResult = await PostgresService.deleteAcmeContact(testAcmeContact.id);
    
    if (!deleteAcmeResult) {
      throw new Error(`Failed to delete AcmeCRM contact with ID ${testAcmeContact.id}`);
    }
    
    logger.info(`AcmeCRM contact deleted successfully: ${deleteAcmeResult}`);
    
    // Verify AcmeCRM deletion
    const deletedAcmeContact = await PostgresService.getAcmeContact(testAcmeContact.id);
    
    if (deletedAcmeContact) {
      throw new Error(`AcmeCRM contact with ID ${testAcmeContact.id} still exists after deletion`);
    }
    
    logger.info('AcmeCRM contact deletion verified');
    
    // Test 11: Delete internal contact
    logger.info('\nTest 11: Delete internal contact');
    const deleteInternalResult = await PostgresService.deleteInternalContact(testInternalContact.id);
    
    if (!deleteInternalResult) {
      throw new Error(`Failed to delete internal contact with ID ${testInternalContact.id}`);
    }
    
    logger.info(`Internal contact deleted successfully: ${deleteInternalResult}`);
    
    // Verify internal deletion
    const deletedInternalContact = await PostgresService.getInternalContact(testInternalContact.id);
    
    if (deletedInternalContact) {
      throw new Error(`Internal contact with ID ${testInternalContact.id} still exists after deletion`);
    }
    
    logger.info('Internal contact deletion verified');
    
    // Test 12: Transaction support
    logger.info('\nTest 12: Transaction support');
    const transactionResult = await PostgresService.transaction(async (client) => {
      // Insert a contact within the transaction
      const query = 'INSERT INTO internal_contacts(id, first_name, last_name, email, source, source_id) VALUES($1, $2, $3, $4, $5, $6) RETURNING id';
      const transactionId = uuidv4();
      const { rows } = await client.query(query, [transactionId, 'Transaction', 'Test', 'transaction@example.com', 'test', 'transaction-test']);
      
      // Return the ID for verification
      return rows[0].id;
    });
    
    logger.info(`Transaction completed successfully, created contact with ID: ${transactionResult}`);
    
    // Verify transaction result
    const transactionContact = await PostgresService.getInternalContact(transactionResult);
    
    if (!transactionContact) {
      throw new Error(`Contact created in transaction with ID ${transactionResult} not found`);
    }
    
    logger.info('Transaction contact verified:', {
      id: transactionContact.id,
      firstName: transactionContact.firstName,
      lastName: transactionContact.lastName
    });
    
    // Clean up transaction contact
    await PostgresService.deleteInternalContact(transactionResult);
    
    logger.info('\nPostgreSQL Service test completed successfully');
    
    // Close PostgreSQL connection pool
    logger.info('Closing PostgreSQL connection pool...');
    await PostgresService.close();
  } catch (error) {
    logger.error('PostgreSQL Service test failed', error);
    
    // Close PostgreSQL connection pool
    try {
      logger.info('Attempting to close PostgreSQL connection pool...');
      await PostgresService.close();
    } catch (closeError) {
      logger.warn('Error closing PostgreSQL connection pool', closeError);
    }
    
    process.exit(1);
  }
}

// Run the test
testPostgresService();
