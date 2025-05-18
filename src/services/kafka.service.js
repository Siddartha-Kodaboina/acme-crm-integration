/**
 * Kafka Service
 * Provides methods for interacting with Kafka
 * 
 * This service implements:
 * 1. Connection management with error handling
 * 2. Producer for publishing events
 * 3. Consumer framework for processing events
 * 4. Topic management
 */

const { Kafka } = require('kafkajs');
const kafkaConfig = require('../config/kafka.config');
const logger = require('../utils/logger');
const { AppError, errorTypes } = require('../utils/error-handler');

// Kafka client instance (singleton)
let kafkaClient = null;
// Kafka producer instance (singleton)
let producer = null;

/**
 * Kafka Service class
 * Provides methods for interacting with Kafka
 */
class KafkaService {
  /**
   * Initialize Kafka client
   * @returns {Kafka} Kafka client instance
   */
  static getClient() {
    if (!kafkaClient) {
      kafkaClient = new Kafka(kafkaConfig.connection);
      logger.info('Kafka client initialized');
    }
    
    return kafkaClient;
  }
  
  /**
   * Initialize Kafka producer
   * @returns {Promise<Producer>} Kafka producer instance
   */
  static async getProducer() {
    if (!producer) {
      const client = this.getClient();
      producer = client.producer();
      
      try {
        await producer.connect();
        logger.info('Kafka producer connected');
        
        // Set up event listeners
        producer.on('producer.disconnect', () => {
          logger.warn('Kafka producer disconnected');
        });
        
        producer.on('producer.network.request_timeout', (payload) => {
          logger.error('Kafka producer request timeout', payload);
        });
      } catch (error) {
        logger.error('Failed to connect Kafka producer', error);
        throw new AppError('Failed to connect to Kafka', errorTypes.SERVICE_UNAVAILABLE);
      }
    }
    
    return producer;
  }
  
  /**
   * Ensure a topic exists
   * @param {string} topic - Topic name
   * @returns {Promise<void>}
   */
  static async ensureTopic(topic) {
    const client = this.getClient();
    const admin = client.admin();
    
    try {
      await admin.connect();
      
      // Get existing topics
      const topics = await admin.listTopics();
      
      // Create topic if it doesn't exist
      if (!topics.includes(topic)) {
        await admin.createTopics({
          topics: [
            {
              topic,
              numPartitions: 1,
              replicationFactor: 1
            }
          ]
        });
        logger.info(`Kafka topic ${topic} created`);
      }
      
      await admin.disconnect();
    } catch (error) {
      logger.error(`Failed to ensure Kafka topic ${topic}`, error);
      throw new AppError('Failed to ensure Kafka topic', errorTypes.SERVICE_UNAVAILABLE);
    }
  }
  
  /**
   * Publish an event to a Kafka topic
   * @param {string} topic - Topic name
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @param {string} [key] - Optional message key
   * @returns {Promise<RecordMetadata>} Record metadata
   * 
   * Example:
   * Input: 
   *   topic: "contact-events"
   *   eventType: "contact.created"
   *   data: { 
   *     contact_id: "123", 
   *     acme_first_name: "John", 
   *     acme_last_name: "Doe" 
   *   }
   *   key: "123"
   * Output: { partition: 0, offset: "1" }
   */
  static async publishEvent(topic, eventType, data, key = null) {
    try {
      // Ensure topic exists
      await this.ensureTopic(topic);
      
      // Get producer
      const kafkaProducer = await this.getProducer();
      
      // Create event payload
      const event = {
        event_type: eventType,
        event_id: `evt_${Date.now()}${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Publish event
      const result = await kafkaProducer.send({
        topic,
        messages: [
          {
            key: key ? key.toString() : null,
            value: JSON.stringify(event)
          }
        ]
      });
      
      logger.info(`Published event to ${topic}`, { eventType, eventId: event.event_id });
      return result;
    } catch (error) {
      logger.error(`Failed to publish event to ${topic}`, error);
      throw new AppError('Failed to publish event to Kafka', errorTypes.SERVICE_UNAVAILABLE);
    }
  }
  
  /**
   * Create a consumer for processing events
   * @param {string} groupId - Consumer group ID
   * @param {Object} topicHandlers - Map of topics to handler functions
   * @returns {Promise<Consumer>} Kafka consumer instance
   * 
   * Example:
   * Input: 
   *   groupId: "contact-events-group"
   *   topicHandlers: { 
   *     "contact-events": async (message) => {
   *       const event = JSON.parse(message.value.toString());
   *       // Process event
   *     }
   *   }
   * Output: Kafka Consumer instance
   */
  static async createConsumer(groupId, topicHandlers) {
    const client = this.getClient();
    const consumer = client.consumer({ groupId });
    
    try {
      await consumer.connect();
      logger.info(`Kafka consumer connected (${groupId})`);
      
      // Subscribe to topics
      const topics = Object.keys(topicHandlers);
      for (const topic of topics) {
        await this.ensureTopic(topic);
        await consumer.subscribe({ topic, fromBeginning: false });
        logger.info(`Kafka consumer subscribed to ${topic}`);
      }
      
      // Set up message handler
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const handler = topicHandlers[topic];
            if (handler) {
              await handler(message, topic, partition);
            } else {
              logger.warn(`No handler for topic ${topic}`);
            }
          } catch (error) {
            logger.error(`Error processing message from ${topic}`, error);
            // In a production system, you would:
            // 1. Send to a dead letter queue
            // 2. Implement retry logic
            // 3. Track failed messages
          }
        }
      });
      
      // Set up event listeners
      consumer.on('consumer.crash', (event) => {
        logger.error('Kafka consumer crashed', event);
      });
      
      consumer.on('consumer.disconnect', () => {
        logger.warn('Kafka consumer disconnected');
      });
      
      return consumer;
    } catch (error) {
      logger.error(`Failed to create Kafka consumer (${groupId})`, error);
      throw new AppError('Failed to create Kafka consumer', errorTypes.SERVICE_UNAVAILABLE);
    }
  }
  
  /**
   * Publish a contact created event
   * @param {Object} contact - Contact data in AcmeCRM format
   * @param {string} contactId - Contact ID
   * @returns {Promise<RecordMetadata>} Record metadata
   * 
   * Example:
   * Input: 
   *   contact: { 
   *     acme_first_name: "John", 
   *     acme_last_name: "Doe",
   *     acme_email: "john.doe@example.com" 
   *   }
   *   contactId: "123"
   * Output: { partition: 0, offset: "1" }
   */
  static async publishContactCreatedEvent(contact, contactId) {
    return await this.publishEvent(
      kafkaConfig.topics.contactEvents,
      kafkaConfig.eventTypes.contactCreated,
      {
        contact_id: contactId,
        ...contact
      },
      contactId
    );
  }
  
  /**
   * Publish a contact updated event
   * @param {Object} contact - Updated contact data in AcmeCRM format
   * @param {string} contactId - Contact ID
   * @param {Array<string>} [changedFields] - List of fields that changed
   * @returns {Promise<RecordMetadata>} Record metadata
   * 
   * Example:
   * Input: 
   *   contact: { 
   *     acme_first_name: "John", 
   *     acme_last_name: "Smith",
   *     acme_email: "john.smith@example.com" 
   *   }
   *   contactId: "123"
   *   changedFields: ["acme_last_name", "acme_email"]
   * Output: { partition: 0, offset: "2" }
   */
  static async publishContactUpdatedEvent(contact, contactId, changedFields = []) {
    return await this.publishEvent(
      kafkaConfig.topics.contactEvents,
      kafkaConfig.eventTypes.contactUpdated,
      {
        contact_id: contactId,
        ...contact,
        changed_fields: changedFields
      },
      contactId
    );
  }
  
  /**
   * Publish a contact deleted event
   * @param {string} contactId - Contact ID
   * @returns {Promise<RecordMetadata>} Record metadata
   * 
   * Example:
   * Input: contactId: "123"
   * Output: { partition: 0, offset: "3" }
   */
  static async publishContactDeletedEvent(contactId) {
    return await this.publishEvent(
      kafkaConfig.topics.contactEvents,
      kafkaConfig.eventTypes.contactDeleted,
      {
        contact_id: contactId
      },
      contactId
    );
  }
  
  /**
   * Close Kafka connections
   * Should be called when shutting down the application
   */
  static async close() {
    if (producer) {
      logger.info('Disconnecting Kafka producer');
      await producer.disconnect();
      producer = null;
    }
    
    logger.info('Kafka connections closed');
  }
}

module.exports = KafkaService;
