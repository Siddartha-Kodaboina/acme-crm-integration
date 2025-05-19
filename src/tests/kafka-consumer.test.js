/**
 * Kafka Consumer Integration Test
 * End-to-end test for Kafka consumer functionality
 * 
 * This test:
 * 1. Sets up a test environment with PostgreSQL and Kafka
 * 2. Produces test messages to Kafka topics
 * 3. Verifies that the consumer processes messages correctly
 * 4. Verifies that data is stored in PostgreSQL
 * 5. Cleans up test resources
 */

const { v4: uuidv4 } = require('uuid');
const KafkaService = require('../services/kafka.service');
const PostgresService = require('../services/postgres.service');
const contactEventsConsumer = require('../consumers/contact-events.consumer');
const kafkaConfig = require('../config/kafka.config');
const logger = require('../utils/logger');

// Test configuration
const testConfig = {
  consumerGroup: 'contact-events-group-test',
  topic: 'contact-events',
  waitTimeMs: 2000 // Time to wait for consumer to process messages
};

/**
 * Check if Kafka is available
 * @returns {Promise<boolean>}
 */
async function isKafkaAvailable() {
  try {
    logger.info('Checking Kafka availability');
    
    // Initialize Kafka client
    const { Kafka } = require('kafkajs');
    const kafka = new Kafka({
      clientId: kafkaConfig.connection.clientId,
      brokers: Array.isArray(kafkaConfig.connection.brokers) 
        ? kafkaConfig.connection.brokers 
        : kafkaConfig.connection.brokers.split(','),
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    });
    
    logger.info('Kafka client initialized');
    
    // Create admin client
    const admin = kafka.admin();
    await admin.connect();
    
    // List topics to check connectivity
    const topics = await admin.listTopics();
    await admin.disconnect();
    
    logger.info('Kafka is available');
    return true;
  } catch (error) {
    logger.error(`Kafka is not available: ${error.message}`);
    return false;
  }
}

/**
 * Initialize test environment
 * @returns {Promise<void>}
 */
async function initializeTestEnvironment() {
  // Initialize PostgreSQL tables
  await PostgresService.initializeTables();
  logger.info('Database tables initialized successfully');
  
  // Start the consumer
  await contactEventsConsumer.startConsumer();
  logger.info('Contact events consumer started');
}

/**
 * Clean up test environment
 * @returns {Promise<void>}
 */
async function cleanupTestEnvironment() {
  // Close PostgreSQL connection
  await PostgresService.closeConnection();
  logger.info('PostgreSQL connection closed');
}

/**
 * Create a test contact event
 * @param {string} contactId - Test contact ID
 * @returns {Object} - Test event
 */
function createContactEvent(contactId) {
  const eventId = `evt_${Date.now()}`;
  
  return {
    event_type: 'contact.created',
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: {
      contact_id: contactId,
      acme_first_name: 'Test',
      acme_last_name: 'User',
      acme_email: `test.user.${contactId}@example.com`,
      acme_phone: '555-123-4567',
      acme_company: 'Test Company',
      acme_title: 'Test Engineer'
    }
  };
}

/**
 * Create a test contact update event
 * @param {string} contactId - Test contact ID
 * @returns {Object} - Test event
 */
function createContactUpdateEvent(contactId) {
  const eventId = `evt_${Date.now()}`;
  
  return {
    event_type: 'contact.updated',
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: {
      contact_id: contactId,
      acme_first_name: 'Test',
      acme_last_name: 'Updated',
      acme_email: `test.updated.${contactId}@example.com`,
      acme_phone: '555-987-6543',
      acme_company: 'Updated Company',
      acme_title: 'Senior Engineer',
      changed_fields: ['acme_last_name', 'acme_email', 'acme_phone', 'acme_company', 'acme_title']
    }
  };
}

/**
 * Verify that a contact was created
 * @param {string} contactId - Contact ID to verify
 * @returns {Promise<boolean>} - True if contact was created
 */
async function verifyContactCreated(contactId) {
  try {
    // Check if contact exists in internal_contacts table
    const { rows: internalRows } = await PostgresService.query(
      'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2',
      ['acmeCRM', contactId]
    );
    
    if (internalRows.length === 0) {
      logger.warn(`Internal contact not found for ID ${contactId}`);
      return false;
    }
    
    // Check if contact exists in acme_contacts table
    const { rows: acmeRows } = await PostgresService.query(
      'SELECT * FROM acme_contacts WHERE id = $1',
      [contactId]
    );
    
    if (acmeRows.length === 0) {
      logger.warn(`AcmeCRM contact not found for ID ${contactId}`);
      return false;
    }
    
    // Check if event was processed
    const { rows: eventRows } = await PostgresService.query(
      "SELECT * FROM event_processing WHERE event_type = $1 AND details->>'contactId' = $2",
      ['contact.created', contactId]
    );
    
    if (eventRows.length === 0) {
      logger.warn(`Event processing record not found for contact ID ${contactId}`);
      return false;
    }
    
    logger.info(`Contact ${contactId} successfully created and verified`);
    return true;
  } catch (error) {
    logger.error(`Error verifying contact created: ${error.message}`, error);
    return false;
  }
}

/**
 * Verify that a contact was updated
 * @param {string} contactId - Contact ID to verify
 * @returns {Promise<boolean>} - True if contact was updated
 */
async function verifyContactUpdated(contactId) {
  try {
    // Check if contact exists in internal_contacts table
    const { rows: internalRows } = await PostgresService.query(
      'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2',
      ['acmeCRM', contactId]
    );
    
    if (internalRows.length === 0) {
      logger.warn(`Internal contact not found for ID ${contactId}`);
      return false;
    }
    
    const internalContact = internalRows[0];
    if (internalContact.last_name !== 'Updated' || 
        !internalContact.email.includes('updated')) {
      logger.warn(`Internal contact not properly updated for ID ${contactId}`);
      return false;
    }
    
    // Check if event was processed
    const { rows: eventRows } = await PostgresService.query(
      "SELECT * FROM event_processing WHERE event_type = $1 AND details->>'contactId' = $2",
      ['contact.updated', contactId]
    );
    
    if (eventRows.length === 0) {
      logger.warn(`Event processing record not found for contact update ID ${contactId}`);
      return false;
    }
    
    logger.info(`Contact ${contactId} successfully updated and verified`);
    return true;
  } catch (error) {
    logger.error(`Error verifying contact updated: ${error.message}`, error);
    return false;
  }
}

/**
 * Produce a message to Kafka
 * @param {string} topic - Topic to produce to
 * @param {string} key - Message key
 * @param {Object} value - Message value
 * @returns {Promise<void>}
 */
async function produceMessage(topic, key, value) {
  // Create a Kafka producer
  const { Kafka } = require('kafkajs');
  const kafka = new Kafka({
    clientId: kafkaConfig.connection.clientId,
    brokers: Array.isArray(kafkaConfig.connection.brokers) 
      ? kafkaConfig.connection.brokers 
      : kafkaConfig.connection.brokers.split(','),
    retry: kafkaConfig.connection.retry
  });
  
  const producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');
  
  // Produce message
  logger.debug(`Producing message to topic ${topic}`, { key });
  const result = await producer.send({
    topic,
    messages: [
      { 
        key, 
        value: JSON.stringify(value)
      }
    ]
  });
  
  logger.info(`Message produced to topic ${topic}`, { 
    key,
    partition: result[0].partition,
    offset: result[0].offset
  });
  
  await producer.disconnect();
}

/**
 * Run the Kafka consumer integration test
 * @returns {Promise<void>}
 */
async function runTest() {
  try {
    // Generate a unique contact ID for this test run
    const contactId = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    logger.info(`Using test contact ID: ${contactId}`);
    
    logger.info('\nTest 1: Creating contact');
    // Create a contact
    const createEvent = createContactEvent(contactId);
    await produceMessage(testConfig.topic, createEvent.event_id, createEvent);
    
    // Wait for consumer to process message
    logger.info('Waiting for create event to be processed');
    await new Promise(resolve => setTimeout(resolve, testConfig.waitTimeMs));
    
    // Verify contact was created
    const contactCreated = await verifyContactCreated(contactId);
    if (!contactCreated) {
      throw new Error('Failed to verify contact creation');
    }
    
    logger.info('\nTest 2: Updating contact');
    // Update the contact
    const updateEvent = createContactUpdateEvent(contactId);
    await produceMessage(testConfig.topic, updateEvent.event_id, updateEvent);
    
    // Wait for consumer to process message
    logger.info('Waiting for update event to be processed');
    await new Promise(resolve => setTimeout(resolve, testConfig.waitTimeMs));
    
    // Verify contact was updated
    const contactUpdated = await verifyContactUpdated(contactId);
    if (!contactUpdated) {
      throw new Error('Failed to verify contact update');
    }
    
    logger.info('\nTest 3: Deleting contact');
    // Delete the contact
    const deleteEvent = {
      event_type: 'contact.deleted',
      event_id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        contact_id: contactId
      }
    };
    
    await produceMessage(testConfig.topic, deleteEvent.event_id, deleteEvent);
    
    // Wait for consumer to process message
    logger.info('Waiting for delete event to be processed');
    await new Promise(resolve => setTimeout(resolve, testConfig.waitTimeMs));
    
    // Verify contact was deleted (soft delete)
    const { rows } = await PostgresService.query(
      'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2 AND status = $3',
      ['acmeCRM', contactId, 'deleted']
    );
    
    if (rows.length === 0) {
      throw new Error('Failed to verify contact deletion');
    }
    
    logger.info(`Contact ${contactId} successfully deleted and verified`);
    logger.info('\nAll tests passed successfully!');
    
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, error);
  }
}

/**
 * Main function
 */
async function main() {
  logger.info('Starting Kafka consumer integration test');
  
  try {
    // Check if Kafka is available
    const kafkaAvailable = await isKafkaAvailable();
    if (!kafkaAvailable) {
      logger.error('Kafka is not available, skipping test');
      return;
    }
    
    // Initialize test environment
    await initializeTestEnvironment();
    
    // Run the test
    await runTest();
    
  } catch (error) {
    logger.error(`Test failed with error: ${error.message}`, error);
  } finally {
    // Clean up
    await cleanupTestEnvironment();
  }
}

// Run the test
main();
