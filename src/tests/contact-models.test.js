/**
 * Test file for Contact Data Models
 * Run with: node src/tests/contact-models.test.js
 */

const acmeContactSchema = require('../models/schemas/acme-contact.schema');
const internalContactSchema = require('../models/schemas/internal-contact.schema');
const contactMapperService = require('../services/contact-mapper.service');
const ContactModel = require('../models/contact.model');
const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');

/**
 * Test data for AcmeCRM contact
 */
const testAcmeContact = {
  id: "123456",
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
 * Simple test function to verify Contact Data Models
 */
async function testContactModels() {
  try {
    logger.info('Starting Contact Data Models test');
    
    // Test 1: Validate AcmeCRM contact schema
    logger.info('\nTest 1: Validate AcmeCRM contact schema');
    const acmeValidation = acmeContactSchema.validateAcmeContact(testAcmeContact);
    
    if (acmeValidation.error) {
      logger.error('AcmeCRM validation failed:', acmeValidation.error);
      throw new Error('AcmeCRM validation failed');
    }
    
    logger.info('AcmeCRM contact validation successful');
    
    // Test 2: Map AcmeCRM contact to internal format
    logger.info('\nTest 2: Map AcmeCRM contact to internal format');
    const internalContact = contactMapperService.mapAcmeToInternal(testAcmeContact);
    
    logger.info('Mapped to internal format:', {
      id: internalContact.id,
      firstName: internalContact.firstName,
      lastName: internalContact.lastName,
      email: internalContact.email,
      source: internalContact.source,
      sourceId: internalContact.sourceId
    });
    
    // Test 3: Validate internal contact schema
    logger.info('\nTest 3: Validate internal contact schema');
    const internalValidation = internalContactSchema.validateInternalContact(internalContact);
    
    if (internalValidation.error) {
      logger.error('Internal validation failed:', internalValidation.error);
      throw new Error('Internal validation failed');
    }
    
    logger.info('Internal contact validation successful');
    
    // Test 4: Map internal contact back to AcmeCRM format
    logger.info('\nTest 4: Map internal contact back to AcmeCRM format');
    const mappedBackAcmeContact = contactMapperService.mapInternalToAcme(internalContact);
    
    logger.info('Mapped back to AcmeCRM format:', {
      id: mappedBackAcmeContact.id,
      acme_first_name: mappedBackAcmeContact.acme_first_name,
      acme_last_name: mappedBackAcmeContact.acme_last_name,
      acme_email: mappedBackAcmeContact.acme_email
    });
    
    // Test 5: Address parsing and formatting
    logger.info('\nTest 5: Address parsing and formatting');
    const addressString = "123 Main St, San Francisco, CA 94105, USA";
    const parsedAddress = contactMapperService.parseAddress(addressString);
    
    logger.info('Parsed address:', parsedAddress);
    
    const formattedAddress = contactMapperService.formatAddress(parsedAddress);
    logger.info(`Formatted address: ${formattedAddress}`);
    
    // Test 6: Create contact from AcmeCRM data
    logger.info('\nTest 6: Create contact from AcmeCRM data');
    
    // Get Redis client (this automatically connects)
    logger.info('Getting Redis client...');
    const redisClient = RedisService.getClient();
    logger.info('Redis client obtained');
    
    const createdContact = await ContactModel.createFromAcmeData(testAcmeContact);
    
    logger.info('Created contact from AcmeCRM data:', {
      id: createdContact.id,
      firstName: createdContact.firstName,
      lastName: createdContact.lastName,
      email: createdContact.email,
      source: createdContact.source,
      sourceId: createdContact.sourceId
    });
    
    // Test 7: Get contact by ID
    logger.info('\nTest 7: Get contact by ID');
    const retrievedContact = await ContactModel.getContactById(createdContact.id);
    
    if (!retrievedContact) {
      throw new Error(`Contact with ID ${createdContact.id} not found`);
    }
    
    logger.info('Retrieved contact by ID:', {
      id: retrievedContact.id,
      firstName: retrievedContact.firstName,
      lastName: retrievedContact.lastName,
      email: retrievedContact.email
    });
    
    // Test 8: Update contact
    logger.info('\nTest 8: Update contact');
    const updateData = {
      firstName: "Jane",
      company: "Updated Company"
    };
    
    const updatedContact = await ContactModel.updateContact(createdContact.id, updateData);
    
    logger.info('Updated contact:', {
      id: updatedContact.id,
      firstName: updatedContact.firstName, // Should be "Jane"
      lastName: updatedContact.lastName,
      company: updatedContact.company // Should be "Updated Company"
    });
    
    // Test 9: Delete contact
    logger.info('\nTest 9: Delete contact');
    const deleteResult = await ContactModel.deleteContact(createdContact.id);
    
    if (!deleteResult) {
      throw new Error(`Failed to delete contact with ID ${createdContact.id}`);
    }
    
    logger.info(`Contact deleted successfully: ${deleteResult}`);
    
    // Verify deletion
    const deletedContact = await ContactModel.getContactById(createdContact.id);
    
    if (deletedContact) {
      throw new Error(`Contact with ID ${createdContact.id} still exists after deletion`);
    }
    
    logger.info('Contact deletion verified');
    
    logger.info('\nContact Data Models test completed successfully');
    
    // Close Redis connection
    logger.info('Closing Redis connection...');
    await RedisService.close();
  } catch (error) {
    logger.error('Contact Data Models test failed', error);
    
    // Close Redis connection
    try {
      logger.info('Attempting to close Redis connection...');
      await RedisService.close();
    } catch (closeError) {
      logger.warn('Error closing Redis connection', closeError);
    }
    
    process.exit(1);
  }
}

// Run the test
testContactModels();
