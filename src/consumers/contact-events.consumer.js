/**
 * Contact Events Consumer
 * Processes contact events from Kafka
 * 
 * This consumer:
 * 1. Subscribes to the contact-events topic
 * 2. Processes different types of contact events
 * 3. Transforms data from AcmeCRM format to internal format
 * 4. Stores processed data in PostgreSQL
 * 5. Tracks event processing metrics
 * 6. Uses transactions for data consistency
 */

const KafkaService = require('../services/kafka.service');
const PostgresService = require('../services/postgres.service');
const kafkaConfig = require('../config/kafka.config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Event processing metrics
const metrics = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  byEventType: {
    'contact.created': 0,
    'contact.updated': 0,
    'contact.deleted': 0
  },
  errors: [],
  lastProcessedAt: null
};

/**
 * Map AcmeCRM contact to internal format
 * @param {Object} acmeContact - Contact in AcmeCRM format
 * @returns {Object} Contact in internal format
 * 
 * Example:
 * Input: { 
 *   acme_first_name: "John", 
 *   acme_last_name: "Doe",
 *   acme_email: "john.doe@example.com" 
 * }
 * Output: { 
 *   firstName: "John", 
 *   lastName: "Doe",
 *   email: "john.doe@example.com",
 *   source: "acmeCRM" 
 * }
 */
function mapToInternalFormat(acmeContact) {
  // Create a mapping of AcmeCRM fields to internal fields
  const fieldMapping = {
    acme_first_name: 'firstName',
    acme_last_name: 'lastName',
    acme_email: 'email',
    acme_phone: 'phone',
    acme_company: 'company',
    acme_title: 'title',
    acme_created_at: 'createdAt',
    acme_updated_at: 'updatedAt'
  };
  
  // Create the internal contact object
  const internalContact = {
    source: 'acmeCRM',
    sourceId: acmeContact.contact_id || null
  };
  
  // Map fields from AcmeCRM format to internal format
  for (const [acmeField, internalField] of Object.entries(fieldMapping)) {
    if (acmeContact[acmeField] !== undefined) {
      internalContact[internalField] = acmeContact[acmeField];
    }
  }
  
  return internalContact;
}

/**
 * Process contact created event
 * @param {Object} event - Contact created event
 * @returns {Promise<Object>} Processed contact
 * 
 * Example event:
 * {
 *   event_type: "contact.created",
 *   event_id: "evt_12345",
 *   timestamp: "2025-05-17T17:06:39-07:00",
 *   data: {
 *     contact_id: "1234",
 *     acme_first_name: "John",
 *     acme_last_name: "Doe",
 *     acme_email: "john.doe@example.com",
 *     acme_phone: "555-123-4567"
 *   }
 * }
 * 
 * Example output:
 * {
 *   id: "internal_1234",
 *   source: "acmeCRM",
 *   sourceId: "1234",
 *   firstName: "John",
 *   lastName: "Doe",
 *   email: "john.doe@example.com",
 *   phone: "555-123-4567",
 *   createdAt: "2025-05-17T17:06:39-07:00",
 *   updatedAt: "2025-05-17T17:06:39-07:00",
 *   version: 1
 * }
 */
async function processContactCreatedEvent(event) {
  try {
    logger.info(`Processing contact created event: ${event.event_id}`);
    
    const contactId = event.data.contact_id;
    if (!contactId) {
      throw new Error('Contact ID is missing from event data');
    }
    
    // Map to internal format
    const internalContact = mapToInternalFormat(event.data);
    
    // Store in PostgreSQL using a transaction
    const result = await PostgresService.transaction(async (client) => {
      // First, store the original AcmeCRM contact data
      await client.query(
        'INSERT INTO acme_contacts(id, data, created_at, updated_at, version) VALUES($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $4, version = $5',
        [contactId, event.data, new Date(event.timestamp), new Date(event.timestamp), 1]
      );
      
      // Generate a UUID for the new contact
      const contactUuid = uuidv4();
      
      // Then, store the mapped internal contact
      const { rows } = await client.query(
        `INSERT INTO internal_contacts(
          id, source, source_id, first_name, last_name, email, phone, company, title, created_at, updated_at, version
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (source, source_id) DO UPDATE 
        SET first_name = $4, last_name = $5, email = $6, phone = $7, company = $8, title = $9, updated_at = $11, version = internal_contacts.version + 1
        RETURNING *`,
        [
          contactUuid,
          internalContact.source,
          internalContact.sourceId,
          internalContact.firstName,
          internalContact.lastName,
          internalContact.email,
          internalContact.phone,
          internalContact.company,
          internalContact.title,
          new Date(event.timestamp),
          new Date(event.timestamp),
          1
        ]
      );
      
      // Update event processing status
      await client.query(
        'INSERT INTO event_processing(event_id, event_type, status, processed_at, details) VALUES($1, $2, $3, $4, $5)',
        [event.event_id, 'contact.created', 'success', new Date(), JSON.stringify({ contactId })]
      );
      
      return rows[0];
    });
    
    // Update metrics
    metrics.processed++;
    metrics.succeeded++;
    metrics.byEventType['contact.created']++;
    metrics.lastProcessedAt = new Date();
    
    logger.info(`Contact created and processed: ${contactId}`);
    
    return result;
  } catch (error) {
    // Update error metrics
    metrics.processed++;
    metrics.failed++;
    metrics.errors.push({
      eventId: event.event_id,
      eventType: 'contact.created',
      error: error.message,
      timestamp: new Date()
    });
    
    logger.error(`Error processing contact created event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Process contact updated event
 * @param {Object} event - Contact updated event
 * @returns {Promise<Object>} Processed contact
 * 
 * Example event:
 * {
 *   event_type: "contact.updated",
 *   event_id: "evt_12346",
 *   timestamp: "2025-05-17T17:10:00-07:00",
 *   data: {
 *     contact_id: "1234",
 *     acme_first_name: "John",
 *     acme_last_name: "Smith",
 *     acme_email: "john.smith@example.com",
 *     acme_phone: "555-123-4567",
 *     changed_fields: ["acme_last_name", "acme_email"]
 *   }
 * }
 * 
 * Example output:
 * {
 *   id: "internal_1234",
 *   source: "acmeCRM",
 *   sourceId: "1234",
 *   firstName: "John",
 *   lastName: "Smith",
 *   email: "john.smith@example.com",
 *   phone: "555-123-4567",
 *   createdAt: "2025-05-17T17:06:39-07:00",
 *   updatedAt: "2025-05-17T17:10:00-07:00",
 *   version: 2
 * }
 */
async function processContactUpdatedEvent(event) {
  try {
    logger.info(`Processing contact updated event: ${event.event_id}`);
    
    const contactId = event.data.contact_id;
    if (!contactId) {
      throw new Error('Contact ID is missing from event data');
    }
    
    // Check if contact exists in PostgreSQL
    const { rows } = await PostgresService.query(
      'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2',
      ['acmeCRM', contactId]
    );
    
    if (rows.length === 0) {
      logger.warn(`Contact ${contactId} not found, creating new contact from update event`);
      return await processContactCreatedEvent(event);
    }
    
    // Map to internal format
    const updatedContact = mapToInternalFormat(event.data);
    
    // Store in PostgreSQL using a transaction
    const result = await PostgresService.transaction(async (client) => {
      // First, update the original AcmeCRM contact data
      await client.query(
        'UPDATE acme_contacts SET data = $1, updated_at = $2, version = version + 1 WHERE id = $3',
        [event.data, new Date(event.timestamp), contactId]
      );
      
      // Then, update the mapped internal contact
      const { rows } = await client.query(
        `UPDATE internal_contacts 
        SET first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            email = COALESCE($3, email),
            phone = COALESCE($4, phone),
            company = COALESCE($5, company),
            title = COALESCE($6, title),
            updated_at = $7,
            version = internal_contacts.version + 1
        WHERE source = $8 AND source_id = $9
        RETURNING *`,
        [
          updatedContact.firstName,
          updatedContact.lastName,
          updatedContact.email,
          updatedContact.phone,
          updatedContact.company,
          updatedContact.title,
          new Date(event.timestamp),
          'acmeCRM',
          contactId
        ]
      );
      
      // Update event processing status
      await client.query(
        'INSERT INTO event_processing(event_id, event_type, status, processed_at, details) VALUES($1, $2, $3, $4, $5)',
        [event.event_id, 'contact.updated', 'success', new Date(), JSON.stringify({ 
          contactId,
          changedFields: event.data.changed_fields || []
        })]
      );
      
      return rows[0];
    });
    
    // Update metrics
    metrics.processed++;
    metrics.succeeded++;
    metrics.byEventType['contact.updated']++;
    metrics.lastProcessedAt = new Date();
    
    logger.info(`Contact updated and processed: ${contactId}`);
    
    return result;
  } catch (error) {
    // Update error metrics
    metrics.processed++;
    metrics.failed++;
    metrics.errors.push({
      eventId: event.event_id,
      eventType: 'contact.updated',
      error: error.message,
      timestamp: new Date()
    });
    
    logger.error(`Error processing contact updated event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Process contact deleted event
 * @param {Object} event - Contact deleted event
 * @returns {Promise<Object>} Processed contact
 * 
 * Example event:
 * {
 *   event_type: "contact.deleted",
 *   event_id: "evt_12347",
 *   timestamp: "2025-05-17T17:15:00-07:00",
 *   data: {
 *     contact_id: "1234"
 *   }
 * }
 * 
 * Example output:
 * {
 *   id: "internal_1234",
 *   source: "acmeCRM",
 *   sourceId: "1234",
 *   firstName: "John",
 *   lastName: "Smith",
 *   email: "john.smith@example.com",
 *   deleted: true,
 *   deletedAt: "2025-05-17T17:15:00-07:00",
 *   version: 3
 * }
 */
async function processContactDeletedEvent(event) {
  try {
    logger.info(`Processing contact deleted event: ${event.event_id}`);
    
    const contactId = event.data.contact_id;
    if (!contactId) {
      throw new Error('Contact ID is missing from event data');
    }
    
    // Check if contact exists in PostgreSQL
    const { rows } = await PostgresService.query(
      'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2',
      ['acmeCRM', contactId]
    );
    
    if (rows.length === 0) {
      logger.warn(`Contact ${contactId} not found for deletion, ignoring event`);
      return null;
    }
    
    // Store in PostgreSQL using a transaction (soft delete)
    const result = await PostgresService.transaction(async (client) => {
      // First, update the original AcmeCRM contact data to mark as deleted
      await client.query(
        "UPDATE acme_contacts SET data = jsonb_set(data, '{deleted}', 'true'), updated_at = $1, version = version + 1 WHERE id = $2",
        [new Date(event.timestamp), contactId]
      );
      
      // Then, soft delete the internal contact
      const { rows } = await client.query(
        `UPDATE internal_contacts 
        SET status = 'deleted',
            updated_at = $1,
            version = internal_contacts.version + 1
        WHERE source = $2 AND source_id = $3
        RETURNING *`,
        [new Date(event.timestamp), 'acmeCRM', contactId]
      );
      
      // Update event processing status
      await client.query(
        'INSERT INTO event_processing(event_id, event_type, status, processed_at, details) VALUES($1, $2, $3, $4, $5)',
        [event.event_id, 'contact.deleted', 'success', new Date(), JSON.stringify({ contactId })]
      );
      
      return rows[0];
    });
    
    // Update metrics
    metrics.processed++;
    metrics.succeeded++;
    metrics.byEventType['contact.deleted']++;
    metrics.lastProcessedAt = new Date();
    
    logger.info(`Contact deleted and processed: ${contactId}`);
    
    return result;
  } catch (error) {
    // Update error metrics
    metrics.processed++;
    metrics.failed++;
    metrics.errors.push({
      eventId: event.event_id,
      eventType: 'contact.deleted',
      error: error.message,
      timestamp: new Date()
    });
    
    logger.error(`Error processing contact deleted event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Message handler for contact events
 * @param {KafkaMessage} message - Kafka message
 * @returns {Promise<void>}
 * 
 * Example message:
 * {
 *   topic: 'contact-events',
 *   partition: 0,
 *   offset: 1,
 *   key: 'evt_12345',
 *   value: '{"event_type":"contact.created","event_id":"evt_12345","timestamp":"2025-05-17T17:06:39-07:00","data":{"contact_id":"1234","acme_first_name":"John","acme_last_name":"Doe","acme_email":"john.doe@example.com","acme_phone":"555-123-4567"}}'
 * }
 */
async function handleContactEvent(message) {
  let event;
  
  try {
    // Check if message and message.value are defined
    if (!message || !message.value) {
      logger.error('Received invalid Kafka message: message or message.value is undefined', {
        message: message ? 'defined' : 'undefined',
        messageValue: message && message.value ? 'defined' : 'undefined'
      });
      return;
    }
    
    // Parse message value
    event = JSON.parse(message.value.toString());
    
    logger.info(`Processing event: ${event.event_id} of type ${event.event_type}`);
    
    // Process based on event type
    switch (event.event_type) {
      case kafkaConfig.eventTypes.contactCreated:
        await processContactCreatedEvent(event);
        break;
      case kafkaConfig.eventTypes.contactUpdated:
        await processContactUpdatedEvent(event);
        break;
      case kafkaConfig.eventTypes.contactDeleted:
        await processContactDeletedEvent(event);
        break;
      default:
        logger.warn(`Unknown event type: ${event.event_type}`);
        // Update metrics for unknown event type
        metrics.processed++;
        metrics.failed++;
        metrics.errors.push({
          eventId: event.event_id || 'unknown',
          eventType: event.event_type || 'unknown',
          error: 'Unknown event type',
          timestamp: new Date()
        });
    }
    
    // Log processing completion
    logger.info(`Successfully processed event: ${event.event_id}`);
    
  } catch (error) {
    // Update error metrics
    metrics.processed++;
    metrics.failed++;
    
    if (event) {
      metrics.errors.push({
        eventId: event.event_id || 'unknown',
        eventType: event.event_type || 'unknown',
        error: error.message,
        timestamp: new Date()
      });
    } else {
      metrics.errors.push({
        eventId: 'unknown',
        eventType: 'unknown',
        error: `Failed to parse message: ${error.message}`,
        timestamp: new Date()
      });
    }
    
    logger.error(`Error handling contact event: ${error.message}`, {
      error,
      messageKey: message.key ? message.key.toString() : null,
      messageTopic: message.topic,
      messagePartition: message.partition,
      messageOffset: message.offset
    });
  }
}

/**
 * Start the contact events consumer
 * @returns {Promise<void>}
 * 
 * Example usage:
 * await startConsumer();
 */
async function startConsumer() {
  try {
    // Initialize event processing table
    await initializeEventProcessingTable();
    
    // Create Kafka client directly
    const { Kafka } = require('kafkajs');
    const kafka = new Kafka({
      clientId: kafkaConfig.connection.clientId,
      brokers: Array.isArray(kafkaConfig.connection.brokers) 
        ? kafkaConfig.connection.brokers 
        : kafkaConfig.connection.brokers.split(','),
      retry: kafkaConfig.connection.retry
    });
    
    // Create consumer
    const consumer = kafka.consumer({
      groupId: kafkaConfig.consumerGroup.contactEvents,
      heartbeatInterval: 3000,
      sessionTimeout: 30000,
      maxWaitTimeInMs: 1000
    });
    
    // Connect to Kafka
    logger.info('Connecting to Kafka');
    await consumer.connect();
    logger.info('Connected to Kafka successfully');
    
    // Subscribe to contact events topic
    logger.info(`Subscribing to topic: ${kafkaConfig.topics.contactEvents}`);
    await consumer.subscribe({
      topic: kafkaConfig.topics.contactEvents,
      fromBeginning: false
    });
    
    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          // Check if message and message.value are defined
          if (!message || !message.value) {
            logger.error('Received invalid Kafka message: message or message.value is undefined', {
              topic,
              partition,
              message: message ? 'defined' : 'undefined',
              messageValue: message && message.value ? 'defined' : 'undefined'
            });
            return;
          }
          
          // Parse message value
          const messageValue = message.value.toString();
          logger.debug(`Received message from topic ${topic}`, {
            key: message.key ? message.key.toString() : null,
            partition,
            offset: message.offset,
            value: messageValue.substring(0, 100) + (messageValue.length > 100 ? '...' : '')
          });
          
          // Process the message
          await handleContactEvent(message);
        } catch (error) {
          logger.error(`Error processing message from topic ${topic}`, {
            error: error.message,
            topic,
            partition,
            offset: message.offset
          });
        }
      }
    });
    
    // Log startup metrics
    logger.info(`Contact events consumer started successfully`, {
      consumerGroup: kafkaConfig.consumerGroup.contactEvents,
      topics: [kafkaConfig.topics.contactEvents]
    });
    
    // Set up periodic metrics logging
    setInterval(() => {
      logger.info('Contact events consumer metrics', getMetrics());
    }, 60000); // Log metrics every minute
    
    return consumer;
  } catch (error) {
    logger.error(`Failed to start contact events consumer: ${error.message}`, error);
    throw error;
  }
}

/**
 * Initialize event processing table in PostgreSQL
 * @returns {Promise<void>}
 */
async function initializeEventProcessingTable() {
  try {
    logger.info('Initializing event_processing table in PostgreSQL');
    
    await PostgresService.query(`
      CREATE TABLE IF NOT EXISTS event_processing (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for event_processing table
    await PostgresService.query(`
      CREATE INDEX IF NOT EXISTS idx_event_processing_event_id ON event_processing(event_id)
    `);
    
    await PostgresService.query(`
      CREATE INDEX IF NOT EXISTS idx_event_processing_event_type ON event_processing(event_type)
    `);
    
    await PostgresService.query(`
      CREATE INDEX IF NOT EXISTS idx_event_processing_status ON event_processing(status)
    `);
    
    await PostgresService.query(`
      CREATE INDEX IF NOT EXISTS idx_event_processing_processed_at ON event_processing(processed_at)
    `);
    
    logger.info('Event processing table initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize event_processing table: ${error.message}`, error);
    throw error;
  }
}

/**
 * Get event processing metrics
 * @returns {Object} Event processing metrics
 */
function getMetrics() {
  return {
    ...metrics,
    timestamp: new Date()
  };
}

module.exports = {
  startConsumer,
  handleContactEvent,
  processContactCreatedEvent,
  processContactUpdatedEvent,
  processContactDeletedEvent,
  mapToInternalFormat,
  getMetrics
};
