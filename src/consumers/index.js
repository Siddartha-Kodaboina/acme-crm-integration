/**
 * Kafka Consumers Index
 * 
 * This file provides a central entry point for starting all Kafka consumers.
 * It handles graceful startup and shutdown of consumers.
 */

const contactEventsConsumer = require('./contact-events.consumer');
const logger = require('../utils/logger');

// Array to track active consumers for graceful shutdown
const activeConsumers = [];

/**
 * Start all Kafka consumers
 * @returns {Promise<void>}
 */
async function startAllConsumers() {
  try {
    logger.info('Starting all Kafka consumers');
    
    // Start contact events consumer
    const contactConsumer = await contactEventsConsumer.startConsumer();
    activeConsumers.push(contactConsumer);
    
    logger.info('All Kafka consumers started successfully');
  } catch (error) {
    logger.error(`Failed to start Kafka consumers: ${error.message}`, error);
    throw error;
  }
}

/**
 * Gracefully shut down all Kafka consumers
 * @returns {Promise<void>}
 */
async function shutdownAllConsumers() {
  try {
    logger.info('Shutting down all Kafka consumers');
    
    // Disconnect all active consumers
    const disconnectPromises = activeConsumers.map(consumer => {
      try {
        return consumer.disconnect();
      } catch (error) {
        logger.error(`Error disconnecting consumer: ${error.message}`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.all(disconnectPromises);
    logger.info('All Kafka consumers shut down successfully');
  } catch (error) {
    logger.error(`Error shutting down Kafka consumers: ${error.message}`, error);
  }
}

// Handle process termination signals for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await shutdownAllConsumers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await shutdownAllConsumers();
  process.exit(0);
});

// If this file is executed directly, start all consumers
if (require.main === module) {
  startAllConsumers().catch(error => {
    logger.error(`Failed to start consumers: ${error.message}`, error);
    process.exit(1);
  });
}

module.exports = {
  startAllConsumers,
  shutdownAllConsumers
};
