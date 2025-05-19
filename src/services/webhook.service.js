/**
 * Webhook Service
 * Handles webhook event generation and processing
 * 
 * This service:
 * 1. Generates webhook events for contact operations
 * 2. Publishes events to Kafka topics
 * 3. Handles webhook delivery with retries
 */

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/app.config');
const logger = require('../utils/logger');

// Kafka client (singleton)
let kafka = null;
let producer = null;

/**
 * Webhook Service class
 * Handles webhook event generation and processing
 */
class WebhookService {
  /**
   * Initialize Kafka client and producer
   * @returns {Promise<void>}
   * 
   * @private
   */
  static async _initKafka() {
    if (!kafka) {
      kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        ssl: config.kafka.ssl,
        sasl: config.kafka.sasl ? {
          mechanism: config.kafka.sasl.mechanism,
          username: config.kafka.sasl.username,
          password: config.kafka.sasl.password
        } : undefined
      });
      
      producer = kafka.producer();
      await producer.connect();
      
      logger.info('Kafka producer connected');
    }
  }
  
  /**
   * Trigger a webhook event
   * @param {string} eventType - Type of event (e.g., "contact.created")
   * @param {Object} data - Event data
   * @returns {Promise<Object>} Event details
   * 
   * Example:
   * Input: 
   *   eventType: "contact.created"
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com"
   *   }
   * 
   * Output:
   * {
   *   id: "550e8400-e29b-41d4-a716-446655440000",
   *   type: "contact.created",
   *   timestamp: "2025-05-18T23:45:00.000Z",
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com"
   *   }
   * }
   */
  static async triggerEvent(eventType, data) {
    try {
      // Initialize Kafka if not already initialized
      await this._initKafka();
      
      // Create event object
      const event = {
        id: uuidv4(),
        type: eventType,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Determine Kafka topic based on event type
      const topic = this._getTopicForEventType(eventType);
      
      // Publish event to Kafka
      await producer.send({
        topic,
        messages: [
          { 
            key: event.id,
            value: JSON.stringify(event)
          }
        ]
      });
      
      logger.info(`Webhook event triggered: ${eventType}`, { eventId: event.id });
      
      return event;
    } catch (error) {
      logger.error(`Error triggering webhook event: ${eventType}`, error);
      // Don't throw error - webhook failures shouldn't break the main flow
      return null;
    }
  }
  
  /**
   * Get Kafka topic for event type
   * @param {string} eventType - Type of event
   * @returns {string} Kafka topic name
   * 
   * @private
   */
  static _getTopicForEventType(eventType) {
    const eventCategory = eventType.split('.')[0];
    
    switch (eventCategory) {
      case 'contact':
        return config.kafka.topics.contacts;
      case 'auth':
        return config.kafka.topics.auth;
      default:
        return config.kafka.topics.default;
    }
  }
  
  /**
   * Trigger a contact created event
   * @param {Object} contact - Created contact
   * @returns {Promise<Object>} Event details
   * 
   * Example:
   * Input:
   * {
   *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   firstName: "John",
   *   lastName: "Doe",
   *   email: "john.doe@example.com",
   *   ...
   * }
   * 
   * Output:
   * {
   *   id: "550e8400-e29b-41d4-a716-446655440000",
   *   type: "contact.created",
   *   timestamp: "2025-05-18T23:45:00.000Z",
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com",
   *     ...
   *   }
   * }
   */
  static async contactCreated(contact) {
    return this.triggerEvent('contact.created', contact);
  }
  
  /**
   * Trigger a contact updated event
   * @param {Object} contact - Updated contact
   * @returns {Promise<Object>} Event details
   * 
   * Example:
   * Input:
   * {
   *   id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *   firstName: "John",
   *   lastName: "Smith", // Updated
   *   email: "john.doe@example.com",
   *   ...
   * }
   * 
   * Output:
   * {
   *   id: "550e8400-e29b-41d4-a716-446655440000",
   *   type: "contact.updated",
   *   timestamp: "2025-05-18T23:45:00.000Z",
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Smith",
   *     email: "john.doe@example.com",
   *     ...
   *   }
   * }
   */
  static async contactUpdated(contact) {
    return this.triggerEvent('contact.updated', contact);
  }
  
  /**
   * Trigger a contact deleted event
   * @param {string} contactId - ID of the deleted contact
   * @returns {Promise<Object>} Event details
   * 
   * Example:
   * Input: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   * 
   * Output:
   * {
   *   id: "550e8400-e29b-41d4-a716-446655440000",
   *   type: "contact.deleted",
   *   timestamp: "2025-05-18T23:45:00.000Z",
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c"
   *   }
   * }
   */
  static async contactDeleted(contactId) {
    return this.triggerEvent('contact.deleted', { id: contactId });
  }
  
  /**
   * Close Kafka producer connection
   * @returns {Promise<void>}
   */
  static async close() {
    if (producer) {
      await producer.disconnect();
      producer = null;
      kafka = null;
      logger.info('Kafka producer disconnected');
    }
  }
}

module.exports = WebhookService;
