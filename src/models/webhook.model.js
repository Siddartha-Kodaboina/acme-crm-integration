/**
 * Webhook Model
 * Provides methods for working with webhook events
 * 
 * This model:
 * 1. Validates webhook payloads against schemas
 * 2. Stores webhook events in PostgreSQL
 * 3. Provides methods for retrieving and updating webhook events
 * 4. Handles webhook event processing status
 */

const { v4: uuidv4 } = require('uuid');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const StorageFactory = require('../services/storage/storage-factory');
const logger = require('../utils/logger');
const webhookSchema = require('./schemas/webhook.schema');

/**
 * Webhook Model class
 * Provides methods for working with webhook events
 */
class WebhookModel {
  /**
   * Get the storage adapter
   * @returns {Object} Storage adapter instance
   * 
   * @private
   */
  static _getStorageAdapter() {
    const PostgresService = require('../services/postgres.service');
    return PostgresService;
  }

  /**
   * Store a webhook event
   * @param {Object} webhookData - Webhook event data
   * @returns {Promise<Object>} Stored webhook event
   * 
   * Example:
   * Input: 
   * {
   *   "event": "contact.created",
   *   "timestamp": "2025-05-19T00:00:00.000Z",
   *   "id": "evt_123456789",
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Smith",
   *     "email": "john.smith@example.com"
   *   }
   * }
   * 
   * Output:
   * {
   *   "id": 1,
   *   "event_id": "evt_123456789",
   *   "event_type": "contact.created",
   *   "payload": {
   *     "event": "contact.created",
   *     "timestamp": "2025-05-19T00:00:00.000Z",
   *     "id": "evt_123456789",
   *     "data": {
   *       "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *       "firstName": "John",
   *       "lastName": "Smith",
   *       "email": "john.smith@example.com"
   *     }
   *   },
   *   "status": "pending",
   *   "created_at": "2025-05-19T00:00:00.000Z"
   * }
   */
  static async storeWebhookEvent(webhookData) {
    try {
      // Validate webhook data
      const { error, value } = webhookSchema.validate(webhookData);
      if (error) {
        throw new AppError('Invalid webhook data', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
      }

      const storage = this._getStorageAdapter();
      
      // Store the webhook event using the storage adapter's query method
      const result = await storage.query(
        `INSERT INTO webhook_events 
         (event_id, event_type, payload, status) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [
          webhookData.id,
          webhookData.event,
          JSON.stringify(webhookData),
          'pending'
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error storing webhook event', error);
      throw new AppError('Failed to store webhook event', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }

  /**
   * Update webhook event status
   * @param {string} eventId - Webhook event ID
   * @param {string} status - New status ('pending', 'processing', 'completed', 'failed')
   * @param {string} [error] - Error message if status is 'failed'
   * @returns {Promise<Object>} Updated webhook event
   * 
   * Example:
   * Input: 
   *   eventId: "evt_123456789"
   *   status: "completed"
   * 
   * Output:
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
  static async updateWebhookStatus(eventId, status, error = null) {
    try {
      const storage = this._getStorageAdapter();
      
      // Update the webhook event status using the storage adapter's query method
      const result = await storage.query(
        `UPDATE webhook_events 
         SET status = $1, 
             processed_at = CASE WHEN $1 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END,
             error = $2
         WHERE event_id = $3
         RETURNING *`,
        [status, error, eventId]
      );

      if (result.rowCount === 0) {
        throw new AppError(`Webhook event with ID ${eventId} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating webhook status', error);
      throw new AppError('Failed to update webhook status', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }

  /**
   * Get webhook event by ID
   * @param {string} eventId - Webhook event ID
   * @returns {Promise<Object>} Webhook event
   * 
   * Example:
   * Input: eventId: "evt_123456789"
   * 
   * Output:
   * {
   *   "id": 1,
   *   "event_id": "evt_123456789",
   *   "event_type": "contact.created",
   *   "payload": {...},
   *   "status": "pending",
   *   "created_at": "2025-05-19T00:00:00.000Z"
   * }
   */
  static async getWebhookEvent(eventId) {
    try {
      const storage = this._getStorageAdapter();
      const result = await storage.query(
        'SELECT * FROM webhook_events WHERE event_id = $1',
        [eventId]
      );

      if (result.rows.length === 0) {
        throw new AppError(`Webhook event with ID ${eventId} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error retrieving webhook event', error);
      throw new AppError('Failed to retrieve webhook event', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }

  /**
   * Get pending webhook events
   * @param {number} limit - Maximum number of events to retrieve
   * @returns {Promise<Array>} List of pending webhook events
   * 
   * Example:
   * Input: limit: 10
   * 
   * Output:
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
  static async getPendingWebhookEvents(limit = 10) {
    try {
      const storage = this._getStorageAdapter();
      const result = await storage.query(
        'SELECT * FROM webhook_events WHERE status = $1 ORDER BY created_at ASC LIMIT $2',
        ['pending', limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error retrieving pending webhook events', error);
      throw new AppError('Failed to retrieve pending webhook events', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
}

module.exports = WebhookModel;
