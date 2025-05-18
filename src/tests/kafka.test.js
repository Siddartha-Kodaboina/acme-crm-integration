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
    
    // Verify the contact was stored in Redis
    logger.info('Verifying contact was stored in Redis');
    const storedContact = await RedisService.getIntegrationContact(contactId);
    logger.info('Retrieved integration contact', storedContact);
    
    if (!storedContact) {
      throw new Error('Contact was not stored in Redis');
    }
    
    if (storedContact.firstName !== contact.acme_first_name) {
      throw new Error('Contact first name does not match');
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
    
    // Verify the contact was updated in Redis
    logger.info('Verifying contact was updated in Redis');
    const updatedStoredContact = await RedisService.getIntegrationContact(contactId);
    logger.info('Retrieved updated integration contact', updatedStoredContact);
    
    if (updatedStoredContact.lastName !== 'Smith') {
      throw new Error('Contact last name was not updated');
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
    
    // Verify the contact was deleted from Redis
    logger.info('Verifying contact was deleted from Redis');
    const deletedContact = await RedisService.getIntegrationContact(contactId);
    logger.info('Retrieved deleted integration contact', deletedContact);
    
    if (deletedContact) {
      throw new Error('Contact was not deleted from Redis');
    }
    
    logger.info('Kafka service test completed successfully');
    
    // Close connections
    await KafkaService.close();
    await RedisService.close();
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
