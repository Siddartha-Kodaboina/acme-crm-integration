/**
 * Test file for Kafka service
 * Run with: node src/tests/kafka.test.js
 * 
 * Note: This test requires Kafka to be running locally.
 * If you're using Docker, you can start Kafka with:
 * docker run -p 2181:2181 -p 9092:9092 --env ADVERTISED_HOST=localhost --env ADVERTISED_PORT=9092 spotify/kafka
 */

const KafkaService = require('../services/kafka.service');
const RedisService = require('../services/redis.service');
const PostgresService = require('../services/postgres.service');
const contactEventsConsumer = require('../consumers/contact-events.consumer');
const logger = require('../utils/logger');
const kafkaConfig = require('../config/kafka.config');

/**
 * Simple test function to verify Kafka service is working
 */
async function testKafkaService() {
  try {
    logger.info('Starting Kafka service test');
    
    // Test contact created event
    const contactId = 'test123';
    const contact = {
      acme_first_name: 'John',
      acme_last_name: 'Doe',
      acme_email: 'john.doe@example.com',
      acme_phone: '555-123-4567'
    };
    
    // Publish contact created event
    logger.info('Publishing contact created event');
    await KafkaService.publishContactCreatedEvent(contact, contactId);
    
    // Simulate consumer processing the event
    logger.info('Simulating consumer processing');
    const event = {
      event_type: kafkaConfig.eventTypes.contactCreated,
      event_id: `evt_test${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        contact_id: contactId,
        ...contact
      }
    };
    
    await contactEventsConsumer.processContactCreatedEvent(event);
    
    // Verify the contact was stored in PostgreSQL
    logger.info('Verifying contact was stored in PostgreSQL');
    const { rows } = await PostgresService.query(
      'SELECT * FROM acme_contacts WHERE id = $1',
      [contactId]
    );
    logger.info('Retrieved integration contact from PostgreSQL', rows[0]);
    
    if (!rows || rows.length === 0) {
      throw new Error('Contact was not stored in PostgreSQL');
    }
    
    const storedContact = rows[0];
    if (storedContact.data.acme_first_name !== contact.acme_first_name) {
      throw new Error('Contact first name does not match');
    }
    
    if (storedContact.data.acme_last_name !== contact.acme_last_name) {
      throw new Error('Contact last name does not match');
    }
    
    if (storedContact.data.acme_email !== contact.acme_email) {
      throw new Error('Contact email does not match');
    }
    
    // Test contact updated event
    const updatedContact = {
      acme_first_name: 'John',
      acme_last_name: 'Smith', // Changed
      acme_email: 'john.smith@example.com', // Changed
      acme_phone: '555-123-4567'
    };
    
    // Publish contact updated event
    logger.info('Publishing contact updated event');
    await KafkaService.publishContactUpdatedEvent(
      updatedContact, 
      contactId,
      ['acme_last_name', 'acme_email']
    );
    
    // Simulate consumer processing the update event
    logger.info('Simulating consumer processing update');
    const updateEvent = {
      event_type: kafkaConfig.eventTypes.contactUpdated,
      event_id: `evt_test${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        contact_id: contactId,
        ...updatedContact,
        changed_fields: ['acme_last_name', 'acme_email']
      }
    };
    
    await contactEventsConsumer.processContactUpdatedEvent(updateEvent);
    
    // Verify the contact was updated in PostgreSQL
    logger.info('Verifying contact was updated in PostgreSQL');
    const { rows: updatedRows } = await PostgresService.query(
      'SELECT * FROM acme_contacts WHERE id = $1',
      [contactId]
    );
    logger.info('Retrieved updated integration contact from PostgreSQL', updatedRows[0]);
    
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error('Updated contact not found in PostgreSQL');
    }
    
    const updatedStoredContact = updatedRows[0];
    if (updatedStoredContact.data.acme_last_name !== 'Smith') {
      throw new Error('Contact last name was not updated');
    }
    
    if (updatedStoredContact.data.acme_email !== 'john.smith@example.com') {
      throw new Error('Contact email was not updated');
    }
    
    // Test contact deleted event
    logger.info('Publishing contact deleted event');
    await KafkaService.publishContactDeletedEvent(contactId);
    
    // Simulate consumer processing the delete event
    logger.info('Simulating consumer processing delete');
    const deleteEvent = {
      event_type: kafkaConfig.eventTypes.contactDeleted,
      event_id: `evt_test${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        contact_id: contactId
      }
    };
    
    await contactEventsConsumer.processContactDeletedEvent(deleteEvent);
    
    // Verify the contact was soft-deleted in PostgreSQL
    logger.info('Verifying contact was soft-deleted in PostgreSQL');
    const { rows: deletedRows } = await PostgresService.query(
      'SELECT * FROM acme_contacts WHERE id = $1',
      [contactId]
    );
    logger.info('Retrieved deleted integration contact from PostgreSQL', deletedRows);
    
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error('Contact not found in PostgreSQL');
    }
    
    const deletedContact = deletedRows[0];
    if (!deletedContact.data.deleted) {
      throw new Error('Contact was not marked as deleted in PostgreSQL');
    }
    
    logger.info('Kafka service test completed successfully');
    
    // Close connections
    await KafkaService.close();
    await RedisService.close();
    
    // Exit with success code
    process.exit(0);
  } catch (error) {
    logger.error('Kafka service test failed', error);
    
    // Close connections
    await KafkaService.close();
    await RedisService.close();
    
    process.exit(1);
  }
}

// Run the test
testKafkaService();
