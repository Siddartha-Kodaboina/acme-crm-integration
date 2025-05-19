/**
 * Kafka Producer Service
 * 
 * This service provides methods for publishing messages to Kafka topics:
 * 1. Connects to Kafka brokers
 * 2. Creates topics if they don't exist
 * 3. Publishes messages to topics
 * 4. Handles connection errors and retries
 * 
 * Used for asynchronous processing of webhook events.
 */

const { Kafka } = require('kafkajs');
const config = require('../config/app.config');
const logger = require('../utils/logger');

/**
 * Kafka Producer Service
 */
class KafkaProducer {
  /**
   * Create a new Kafka producer
   */
  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers.split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });
    
    this.admin = this.kafka.admin();
    this.isConnected = false;
  }
  
  /**
   * Connect to Kafka
   * @returns {Promise<void>}
   * 
   * Example usage:
   * const producer = new KafkaProducer();
   * await producer.connect();
   */
  async connect() {
    if (!this.isConnected) {
      try {
        await this.producer.connect();
        await this.admin.connect();
        this.isConnected = true;
        logger.info('Connected to Kafka');
      } catch (error) {
        logger.error('Failed to connect to Kafka', error);
        throw error;
      }
    }
  }
  
  /**
   * Disconnect from Kafka
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await producer.disconnect();
   */
  async disconnect() {
    if (this.isConnected) {
      try {
        await this.producer.disconnect();
        await this.admin.disconnect();
        this.isConnected = false;
        logger.info('Disconnected from Kafka');
      } catch (error) {
        logger.error('Failed to disconnect from Kafka', error);
        throw error;
      }
    }
  }
  
  /**
   * Create a topic if it doesn't exist
   * @param {string} topic - Topic name
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await producer.createTopic('contact.created');
   */
  async createTopic(topic) {
    try {
      const topics = await this.admin.listTopics();
      
      if (!topics.includes(topic)) {
        await this.admin.createTopics({
          topics: [
            {
              topic,
              numPartitions: 1,
              replicationFactor: 1,
              configEntries: [
                { name: 'retention.ms', value: '604800000' } // 7 days
              ]
            }
          ]
        });
        
        logger.info(`Created Kafka topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Failed to create Kafka topic: ${topic}`, error);
      throw error;
    }
  }
  
  /**
   * Publish a message to a topic
   * @param {string} topic - Topic name
   * @param {Object} message - Message to publish
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await producer.publish('contact.created', {
   *   key: 'evt_123456789',
   *   value: JSON.stringify({ id: 'evt_123456789', ... }),
   *   headers: { 'event-id': 'evt_123456789' }
   * });
   */
  async publish(topic, message) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Create the topic if it doesn't exist
      await this.createTopic(topic);
      
      // Publish the message
      await this.producer.send({
        topic,
        messages: [message]
      });
      
      logger.info(`Published message to Kafka topic: ${topic}`, {
        key: message.key,
        topic
      });
    } catch (error) {
      logger.error(`Failed to publish message to Kafka topic: ${topic}`, error);
      throw error;
    }
  }
}

module.exports = KafkaProducer;
