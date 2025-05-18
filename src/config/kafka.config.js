/**
 * Kafka configuration
 * Provides configuration for Kafka connections and topics
 */

const config = require('./app.config');

/**
 * Kafka configuration object
 * Contains settings for connecting to Kafka and topic definitions
 */
const kafkaConfig = {
  // Connection settings
  connection: {
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    retry: {
      initialRetryTime: 100, // Initial backoff time in ms
      retries: 8 // Maximum number of retries (2^8 = 256 seconds max delay)
    }
  },
  
  // Consumer group settings
  consumerGroup: {
    contactEvents: 'contact-events-group'
  },
  
  // Topic definitions
  topics: {
    contactEvents: 'contact-events',
    contactEventsDLQ: 'contact-events-dlq' // Dead Letter Queue for failed events
  },
  
  // Event types
  eventTypes: {
    contactCreated: 'contact.created',
    contactUpdated: 'contact.updated',
    contactDeleted: 'contact.deleted'
  }
};

module.exports = kafkaConfig;
