/**
 * Base Kafka Consumer Service
 * Provides a foundation for all Kafka consumers with common functionality
 */

const { Kafka } = require('kafkajs');
const kafkaConfig = require('../../config/kafka.config');
const logger = require('../../utils/logger');

/**
 * Base class for Kafka consumers
 * Handles connection, subscription, and message processing
 */
class BaseConsumerService {
  /**
   * Create a new BaseConsumerService
   * @param {string} groupId - Consumer group ID
   * @param {Array<string>} topics - Topics to subscribe to
   * @param {Object} options - Additional options
   * 
   * Example:
   * const consumer = new BaseConsumerService(
   *   'contact-events-group',
   *   ['contact-events'],
   *   { autoCommit: true }
   * );
   */
  constructor(groupId, topics, options = {}) {
    this.groupId = groupId;
    this.topics = topics;
    this.options = {
      autoCommit: true,
      ...options
    };
    
    // Initialize Kafka client
    this.kafka = new Kafka(kafkaConfig.connection);
    
    // Initialize consumer
    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      // How often to commit offsets (default: 5 seconds)
      heartbeatInterval: 3000,
      // Maximum time between heartbeats (default: 30 seconds)
      sessionTimeout: 30000,
      // Rebalancing strategy (default: RangeAssignor)
      rebalanceTimeout: 60000,
      // Maximum number of bytes to accumulate before yielding
      maxBytes: 1048576, // 1MB
      // Maximum wait time for new messages (default: 1 second)
      maxWaitTimeInMs: 1000,
      // Whether to retry on failure (default: true)
      retry: {
        initialRetryTime: 300,
        retries: 10
      }
    });
    
    // Initialize metrics
    this.metrics = {
      messagesProcessed: 0,
      messagesSucceeded: 0,
      messagesFailed: 0,
      processingErrors: 0,
      lastProcessedTime: null,
      processingTimeMs: 0,
      eventTypeCount: {}
    };
    
    // Bind methods to ensure proper 'this' context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.handleProcessingError = this.handleProcessingError.bind(this);
  }
  
  /**
   * Connect to Kafka broker
   * @returns {Promise<void>}
   * 
   * Example:
   * await consumer.connect();
   */
  async connect() {
    try {
      logger.info(`Connecting to Kafka with consumer group: ${this.groupId}`);
      await this.consumer.connect();
      logger.info(`Connected to Kafka successfully`);
    } catch (error) {
      logger.error(`Failed to connect to Kafka: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Disconnect from Kafka broker
   * @returns {Promise<void>}
   * 
   * Example:
   * await consumer.disconnect();
   */
  async disconnect() {
    try {
      logger.info(`Disconnecting from Kafka`);
      await this.consumer.disconnect();
      logger.info(`Disconnected from Kafka successfully`);
    } catch (error) {
      logger.error(`Failed to disconnect from Kafka: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to Kafka topics and start consuming messages
   * @returns {Promise<void>}
   * 
   * Example:
   * await consumer.subscribe();
   */
  async subscribe() {
    try {
      // Subscribe to topics
      logger.info(`Subscribing to topics: ${this.topics.join(', ')}`);
      await this.consumer.subscribe({ topics: this.topics, fromBeginning: false });
      
      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const startTime = Date.now();
          this.metrics.messagesProcessed++;
          
          try {
            // Parse message value
            const value = message.value ? JSON.parse(message.value.toString()) : null;
            const key = message.key ? message.key.toString() : null;
            
            logger.debug(`Received message from topic ${topic}, partition ${partition}`, {
              key,
              offset: message.offset,
              timestamp: message.timestamp
            });
            
            // Process message
            await this.processMessage(topic, value, key, message.headers);
            
            // Update metrics
            this.metrics.messagesSucceeded++;
            this.metrics.lastProcessedTime = new Date();
            this.metrics.processingTimeMs = Date.now() - startTime;
            
            // Track event type counts
            if (value && value.event) {
              this.metrics.eventTypeCount[value.event] = (this.metrics.eventTypeCount[value.event] || 0) + 1;
            }
            
            logger.debug(`Successfully processed message from topic ${topic}`, {
              processingTimeMs: this.metrics.processingTimeMs
            });
          } catch (error) {
            this.metrics.messagesFailed++;
            this.metrics.processingErrors++;
            
            await this.handleProcessingError(topic, message, error);
          }
        }
      });
      
      logger.info(`Consumer started successfully for topics: ${this.topics.join(', ')}`);
    } catch (error) {
      logger.error(`Failed to subscribe to topics: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Process a Kafka message (to be implemented by subclasses)
   * @param {string} topic - Kafka topic
   * @param {Object} value - Message value
   * @param {string} key - Message key
   * @param {Object} headers - Message headers
   * @returns {Promise<void>}
   * 
   * Example implementation in subclass:
   * async processMessage(topic, value, key, headers) {
   *   // Process the message based on topic and value
   *   if (topic === 'contact-events' && value.event === 'contact.created') {
   *     await this.processContactCreated(value.data);
   *   }
   * }
   */
  async processMessage(topic, value, key, headers) {
    throw new Error('Method processMessage must be implemented by subclass');
  }
  
  /**
   * Handle processing errors
   * @param {string} topic - Kafka topic
   * @param {Object} message - Kafka message
   * @param {Error} error - Processing error
   * @returns {Promise<void>}
   * 
   * Example:
   * await consumer.handleProcessingError('contact-events', message, error);
   */
  async handleProcessingError(topic, message, error) {
    logger.error(`Error processing message from topic ${topic}: ${error.message}`, {
      error,
      topic,
      offset: message.offset,
      key: message.key ? message.key.toString() : null
    });
    
    // Implement retry or dead letter queue logic here
    // This is a placeholder for subclasses to implement
  }
  
  /**
   * Get consumer metrics
   * @returns {Object} Metrics object
   * 
   * Example:
   * const metrics = consumer.getMetrics();
   * console.log(`Processed ${metrics.messagesProcessed} messages`);
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.metrics.lastProcessedTime ? 
        (new Date() - this.metrics.lastProcessedTime) : 0
    };
  }
}

module.exports = BaseConsumerService;
