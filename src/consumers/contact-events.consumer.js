/**
 * Contact Events Consumer
 * Processes contact events from Kafka
 * 
 * This consumer:
 * 1. Subscribes to the contact-events topic
 * 2. Processes different types of contact events
 * 3. Transforms data from AcmeCRM format to internal format
 * 4. Stores processed data in Redis
 */

const KafkaService = require('../services/kafka.service');
const RedisService = require('../services/redis.service');
const kafkaConfig = require('../config/kafka.config');
const logger = require('../utils/logger');

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
 * @returns {Promise<void>}
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
    
    // Store in Redis
    await RedisService.storeIntegrationContact(contactId, internalContact);
    
    // Update metrics (in a real system, you might increment counters, etc.)
    logger.info(`Contact created and processed: ${contactId}`);
    
    return internalContact;
  } catch (error) {
    logger.error(`Error processing contact created event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Process contact updated event
 * @param {Object} event - Contact updated event
 * @returns {Promise<void>}
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
 */
async function processContactUpdatedEvent(event) {
  try {
    logger.info(`Processing contact updated event: ${event.event_id}`);
    
    const contactId = event.data.contact_id;
    if (!contactId) {
      throw new Error('Contact ID is missing from event data');
    }
    
    // Check if contact exists
    const existingContact = await RedisService.getIntegrationContact(contactId);
    if (!existingContact) {
      logger.warn(`Contact ${contactId} not found, creating new contact from update event`);
      return await processContactCreatedEvent(event);
    }
    
    // Map to internal format
    const updatedContact = mapToInternalFormat(event.data);
    
    // Merge with existing contact (only update changed fields)
    const mergedContact = { ...existingContact, ...updatedContact };
    
    // Store in Redis
    await RedisService.storeIntegrationContact(contactId, mergedContact);
    
    // Invalidate cache
    await RedisService.invalidateCache(`contact:${contactId}`);
    
    logger.info(`Contact updated and processed: ${contactId}`);
    
    return mergedContact;
  } catch (error) {
    logger.error(`Error processing contact updated event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Process contact deleted event
 * @param {Object} event - Contact deleted event
 * @returns {Promise<void>}
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
 */
async function processContactDeletedEvent(event) {
  try {
    logger.info(`Processing contact deleted event: ${event.event_id}`);
    
    const contactId = event.data.contact_id;
    if (!contactId) {
      throw new Error('Contact ID is missing from event data');
    }
    
    // Delete from Redis
    await RedisService.deleteIntegrationContact(contactId);
    
    // Invalidate cache
    await RedisService.invalidateCache(`contact:${contactId}`);
    
    logger.info(`Contact deleted and processed: ${contactId}`);
    
    return { id: contactId, deleted: true };
  } catch (error) {
    logger.error(`Error processing contact deleted event: ${error.message}`, error);
    throw error;
  }
}

/**
 * Message handler for contact events
 * @param {KafkaMessage} message - Kafka message
 * @returns {Promise<void>}
 */
async function handleContactEvent(message) {
  try {
    // Parse message value
    const event = JSON.parse(message.value.toString());
    
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
    }
  } catch (error) {
    logger.error('Error handling contact event', error);
    // In a production system, you would:
    // 1. Send to a dead letter queue
    // 2. Implement retry logic
    // 3. Track failed messages
    throw error;
  }
}

/**
 * Start the contact events consumer
 * @returns {Promise<void>}
 */
async function startConsumer() {
  try {
    // Create topic handlers map
    const topicHandlers = {
      [kafkaConfig.topics.contactEvents]: handleContactEvent
    };
    
    // Create consumer
    await KafkaService.createConsumer(
      kafkaConfig.consumerGroup.contactEvents,
      topicHandlers
    );
    
    logger.info('Contact events consumer started');
  } catch (error) {
    logger.error('Failed to start contact events consumer', error);
    throw error;
  }
}

module.exports = {
  startConsumer,
  handleContactEvent,
  processContactCreatedEvent,
  processContactUpdatedEvent,
  processContactDeletedEvent,
  mapToInternalFormat
};
