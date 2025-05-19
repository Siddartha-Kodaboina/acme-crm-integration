/**
 * Webhook Controller
 * 
 * This controller handles incoming webhook requests from AcmeCRM:
 * 1. Validates the webhook payload
 * 2. Stores the webhook event in the database
 * 3. Publishes the event to Kafka for asynchronous processing
 * 4. Returns an immediate acknowledgment response
 * 
 * The actual processing of the webhook event is handled asynchronously
 * by Kafka consumers to ensure quick response times and reliability.
 */

const WebhookModel = require('../models/webhook.model');
const KafkaProducer = require('../services/kafka-producer.service');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');

/**
 * Webhook Controller
 */
class WebhookController {
  /**
   * Handle incoming webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * 
   * Example request body:
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
   * 
   * Example response:
   * {
   *   "message": "Webhook received successfully",
   *   "eventId": "evt_123456789",
   *   "timestamp": "2025-05-19T00:00:01.000Z"
   * }
   */
  static async handleWebhook(req, res, next) {
    try {
      const webhookData = req.body;
      
      // Log the incoming webhook
      logger.info(`Received webhook: ${webhookData.event}`, {
        eventId: webhookData.id,
        eventType: webhookData.event
      });
      
      // Store the webhook event in the database
      const storedEvent = await WebhookModel.storeWebhookEvent(webhookData);
      
      // Publish the event to Kafka for asynchronous processing
      const kafkaProducer = new KafkaProducer();
      await kafkaProducer.connect();
      
      // Use the event type as the Kafka topic
      const topic = webhookData.event;
      
      // Publish the event to Kafka
      await kafkaProducer.publish(topic, {
        key: webhookData.id,
        value: JSON.stringify(webhookData),
        headers: {
          'event-id': webhookData.id,
          'event-type': webhookData.event,
          'timestamp': webhookData.timestamp
        }
      });
      
      // Disconnect from Kafka
      await kafkaProducer.disconnect();
      
      // Return an immediate acknowledgment response
      res.status(200).json({
        message: 'Webhook received successfully',
        eventId: webhookData.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling webhook', error);
      
      // If the error is already an AppError, pass it through
      if (error instanceof AppError) {
        next(error);
      } else {
        // Otherwise, create a new AppError
        next(new AppError(
          'Failed to process webhook',
          errorTypes.INTERNAL_ERROR,
          {
            code: errorCodes.INTERNAL_ERROR,
            details: error.message
          }
        ));
      }
    }
  }
  
  /**
   * Get webhook event by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * 
   * Example response:
   * {
   *   "id": 1,
   *   "event_id": "evt_123456789",
   *   "event_type": "contact.created",
   *   "payload": {...},
   *   "status": "completed",
   *   "processed_at": "2025-05-19T00:01:00.000Z",
   *   "created_at": "2025-05-19T00:00:00.000Z"
   * }
   */
  static async getWebhookEvent(req, res, next) {
    try {
      const eventId = req.params.id;
      
      // Get the webhook event from the database
      const event = await WebhookModel.getWebhookEvent(eventId);
      
      // Return the webhook event
      res.status(200).json(event);
    } catch (error) {
      logger.error('Error getting webhook event', error);
      
      // If the error is already an AppError, pass it through
      if (error instanceof AppError) {
        next(error);
      } else {
        // Otherwise, create a new AppError
        next(new AppError(
          'Failed to get webhook event',
          errorTypes.INTERNAL_ERROR,
          {
            code: errorCodes.INTERNAL_ERROR,
            details: error.message
          }
        ));
      }
    }
  }
  
  /**
   * Get pending webhook events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * 
   * Example response:
   * [
   *   {
   *     "id": 1,
   *     "event_id": "evt_123456789",
   *     "event_type": "contact.created",
   *     "payload": {...},
   *     "status": "pending",
   *     "created_at": "2025-05-19T00:00:00.000Z"
   *   },
   *   ...
   * ]
   */
  static async getPendingWebhookEvents(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      
      // Get pending webhook events from the database
      const events = await WebhookModel.getPendingWebhookEvents(limit);
      
      // Return the pending webhook events
      res.status(200).json(events);
    } catch (error) {
      logger.error('Error getting pending webhook events', error);
      
      // If the error is already an AppError, pass it through
      if (error instanceof AppError) {
        next(error);
      } else {
        // Otherwise, create a new AppError
        next(new AppError(
          'Failed to get pending webhook events',
          errorTypes.INTERNAL_ERROR,
          {
            code: errorCodes.INTERNAL_ERROR,
            details: error.message
          }
        ));
      }
    }
  }
}

module.exports = WebhookController;
