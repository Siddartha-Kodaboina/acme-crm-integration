/**
 * Webhook Event Consumer
 * 
 * This consumer processes webhook events from Kafka:
 * 1. Consumes events from Kafka topics
 * 2. Processes events based on their type
 * 3. Updates the webhook event status in the database
 * 4. Handles errors and retries
 * 
 * Used for asynchronous processing of webhook events after they've been
 * received and acknowledged by the webhook endpoint.
 */

const { Kafka } = require('kafkajs');
const config = require('../config/app.config');
const logger = require('../utils/logger');
const WebhookModel = require('../models/webhook.model');
const ContactModel = require('../models/contact.model');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');

/**
 * Webhook Event Consumer
 */
class WebhookEventConsumer {
  /**
   * Create a new Kafka consumer
   */
  constructor() {
    this.kafka = new Kafka({
      clientId: `${config.kafka.clientId}-consumer`,
      brokers: config.kafka.brokers.split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    
    this.consumer = this.kafka.consumer({
      groupId: 'webhook-event-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    this.isConnected = false;
    this.topics = [
      'contact.created',
      'contact.updated',
      'contact.deleted'
    ];
  }
  
  /**
   * Connect to Kafka and subscribe to topics
   * @returns {Promise<void>}
   * 
   * Example usage:
   * const consumer = new WebhookEventConsumer();
   * await consumer.connect();
   */
  async connect() {
    if (!this.isConnected) {
      try {
        await this.consumer.connect();
        
        // Subscribe to all topics
        for (const topic of this.topics) {
          await this.consumer.subscribe({
            topic,
            fromBeginning: false
          });
        }
        
        this.isConnected = true;
        logger.info('Webhook event consumer connected to Kafka');
      } catch (error) {
        logger.error('Failed to connect webhook event consumer to Kafka', error);
        throw error;
      }
    }
  }
  
  /**
   * Disconnect from Kafka
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await consumer.disconnect();
   */
  async disconnect() {
    if (this.isConnected) {
      try {
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info('Webhook event consumer disconnected from Kafka');
      } catch (error) {
        logger.error('Failed to disconnect webhook event consumer from Kafka', error);
        throw error;
      }
    }
  }
  
  /**
   * Start consuming messages
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await consumer.start();
   */
  async start() {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            // Parse the message value
            const webhookEvent = JSON.parse(message.value.toString());
            const eventId = webhookEvent.id;
            
            logger.info(`Processing webhook event: ${eventId}`, {
              eventId,
              eventType: webhookEvent.event,
              topic
            });
            
            // Update the webhook event status to 'processing'
            await WebhookModel.updateWebhookStatus(eventId, 'processing');
            
            // Process the event based on its type
            switch (webhookEvent.event) {
              case 'contact.created':
                await this.processContactCreated(webhookEvent);
                break;
              case 'contact.updated':
                await this.processContactUpdated(webhookEvent);
                break;
              case 'contact.deleted':
                await this.processContactDeleted(webhookEvent);
                break;
              default:
                throw new Error(`Unknown event type: ${webhookEvent.event}`);
            }
            
            // Update the webhook event status to 'completed'
            await WebhookModel.updateWebhookStatus(eventId, 'completed');
            
            logger.info(`Webhook event processed successfully: ${eventId}`, {
              eventId,
              eventType: webhookEvent.event
            });
          } catch (error) {
            const webhookEvent = JSON.parse(message.value.toString());
            const eventId = webhookEvent.id;
            
            logger.error(`Error processing webhook event: ${eventId}`, error);
            
            // Update the webhook event status to 'failed'
            await WebhookModel.updateWebhookStatus(eventId, 'failed', error.message);
          }
        }
      });
      
      logger.info('Webhook event consumer started');
    } catch (error) {
      logger.error('Failed to start webhook event consumer', error);
      throw error;
    }
  }
  
  /**
   * Process a contact.created event
   * @param {Object} webhookEvent - Webhook event
   * @returns {Promise<void>}
   * 
   * Example input:
   * {
   *   "event": "contact.created",
   *   "timestamp": "2025-05-19T00:00:00.000Z",
   *   "id": "evt_123456789",
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Smith",
   *     "email": "john.smith@example.com",
   *     "phone": "555-987-6543",
   *     "company": "Acme Inc",
   *     "title": "Senior Engineer",
   *     "createdAt": "2025-05-19T00:00:00.000Z",
   *     "updatedAt": "2025-05-19T00:00:00.000Z"
   *   }
   * }
   */
  async processContactCreated(webhookEvent) {
    try {
      const contactData = webhookEvent.data;
      
      // Check if the contact already exists
      const existingContact = await ContactModel.getContactBySourceId('acmecrm', contactData.id);
      
      if (existingContact) {
        logger.info(`Contact already exists: ${contactData.id}`, {
          contactId: contactData.id,
          internalId: existingContact.id
        });
        
        return;
      }
      
      // Create a new contact
      const contact = await ContactModel.createContact({
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone || '',
        company: contactData.company || '',
        title: contactData.title || '',
        source: 'acmecrm',
        sourceId: contactData.id
      });
      
      logger.info(`Contact created: ${contactData.id}`, {
        contactId: contactData.id,
        internalId: contact.id
      });
    } catch (error) {
      logger.error(`Error processing contact.created event: ${webhookEvent.id}`, error);
      throw error;
    }
  }
  
  /**
   * Process a contact.updated event
   * @param {Object} webhookEvent - Webhook event
   * @returns {Promise<void>}
   * 
   * Example input:
   * {
   *   "event": "contact.updated",
   *   "timestamp": "2025-05-19T00:15:00.000Z",
   *   "id": "evt_123456789",
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Smith",
   *     "email": "john.smith@example.com",
   *     "phone": "555-987-6543",
   *     "company": "Updated Company",
   *     "title": "Senior Engineer",
   *     "createdAt": "2025-05-19T00:00:00.000Z",
   *     "updatedAt": "2025-05-19T00:15:00.000Z"
   *   }
   * }
   */
  async processContactUpdated(webhookEvent) {
    try {
      const contactData = webhookEvent.data;
      
      // Get the contact by source ID
      const existingContact = await ContactModel.getContactBySourceId('acmecrm', contactData.id);
      
      if (!existingContact) {
        // If the contact doesn't exist, create it
        logger.info(`Contact not found for update, creating: ${contactData.id}`);
        
        await this.processContactCreated(webhookEvent);
        return;
      }
      
      // Update the contact
      const updatedContact = await ContactModel.updateContact(existingContact.id, {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone || '',
        company: contactData.company || '',
        title: contactData.title || '',
        version: existingContact.version
      });
      
      logger.info(`Contact updated: ${contactData.id}`, {
        contactId: contactData.id,
        internalId: updatedContact.id
      });
    } catch (error) {
      logger.error(`Error processing contact.updated event: ${webhookEvent.id}`, error);
      throw error;
    }
  }
  
  /**
   * Process a contact.deleted event
   * @param {Object} webhookEvent - Webhook event
   * @returns {Promise<void>}
   * 
   * Example input:
   * {
   *   "event": "contact.deleted",
   *   "timestamp": "2025-05-19T00:30:00.000Z",
   *   "id": "evt_123456789",
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "deletedAt": "2025-05-19T00:30:00.000Z"
   *   }
   * }
   */
  async processContactDeleted(webhookEvent) {
    try {
      const contactData = webhookEvent.data;
      
      // Get the contact by source ID
      const existingContact = await ContactModel.getContactBySourceId('acmecrm', contactData.id);
      
      if (!existingContact) {
        logger.info(`Contact not found for deletion: ${contactData.id}`);
        return;
      }
      
      // Delete the contact
      await ContactModel.deleteContact(existingContact.id);
      
      logger.info(`Contact deleted: ${contactData.id}`, {
        contactId: contactData.id,
        internalId: existingContact.id
      });
    } catch (error) {
      logger.error(`Error processing contact.deleted event: ${webhookEvent.id}`, error);
      throw error;
    }
  }
}

module.exports = WebhookEventConsumer;
