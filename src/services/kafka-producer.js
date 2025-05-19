/**
 * Kafka Producer Service
 * Provides methods for producing messages to Kafka topics
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
 * Kafka Producer Service class
 * Provides methods for producing messages to Kafka topics
 */
class KafkaProducerService {
  /**
   * Initialize Kafka client
   * @returns {Kafka} Kafka client instance
   */
  static getClient() {
    if (!kafkaClient) {
      kafkaClient = new Kafka({
        clientId: kafkaConfig.connection.clientId,
        brokers: Array.isArray(kafkaConfig.connection.brokers) 
          ? kafkaConfig.connection.brokers 
          : kafkaConfig.connection.brokers.split(','),
        retry: kafkaConfig.connection.retry
      });
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
      } catch (error) {
        logger.error('Failed to connect Kafka producer', error);
        throw new AppError('Failed to connect Kafka producer', errorTypes.SERVICE_UNAVAILABLE);
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
    try {
      const client = this.getClient();
      const admin = client.admin();
      
      await admin.connect();
      
      // Get existing topics
      const existingTopics = await admin.listTopics();
      
      // Create topic if it doesn't exist
      if (!existingTopics.includes(topic)) {
        await admin.createTopics({
          topics: [
            {
              topic,
              numPartitions: 1,
              replicationFactor: 1
            }
          ]
        });
        logger.info(`Kafka topic created: ${topic}`);
      }
      
      await admin.disconnect();
    } catch (error) {
      logger.warn(`Failed to ensure topic ${topic} exists: ${error.message}`);
      // Continue anyway, as the broker might auto-create the topic
    }
  }
  
  /**
   * Produce a message to a Kafka topic
   * @param {string} topic - Kafka topic
   * @param {string} key - Message key
   * @param {string} value - Message value (must be a string)
   * @param {Object} [headers] - Optional message headers
   * @returns {Promise<RecordMetadata>} Record metadata
   * 
   * Example:
   * Input:
   *   topic: 'contact-events'
   *   key: 'evt_12345'
   *   value: '{\"event_type\":\"contact.created\",\"event_id\":\"evt_12345\",\"timestamp\":\"2025-05-17T17:06:39-07:00\",\"data\":{\"contact_id\":\"1234\",\"acme_first_name\":\"John\",\"acme_last_name\":\"Doe\",\"acme_email\":\"john.doe@example.com\",\"acme_phone\":\"555-123-4567\"}}'
   * Output: { partition: 0, offset: '1' }
   */
  static async produceMessage(topic, key, value, headers = {}) {
    try {
      // Ensure topic exists
      await this.ensureTopic(topic);
      
      // Get producer
      const producer = await this.getProducer();
      
      // Send message
      logger.debug(`Producing message to topic ${topic}`, { key });
      const result = await producer.send({
        topic,
        messages: [
          {
            key,
            value,
            headers
          }
        ]
      });
      
      logger.info(`Message produced to topic ${topic}`, {
        key,
        partition: result[0].partition,
        offset: result[0].offset
      });
      
      return result[0];
    } catch (error) {
      logger.error(`Failed to produce message to topic ${topic}`, {
        error: error.message,
        topic,
        key
      });
      throw new AppError(`Failed to produce message to topic ${topic}`, errorTypes.SERVICE_UNAVAILABLE, {
        details: error.message
      });
    }
  }
}

module.exports = KafkaProducerService;
