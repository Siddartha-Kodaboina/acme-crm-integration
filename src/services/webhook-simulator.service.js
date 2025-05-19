/**
 * Webhook Simulator Service
 * Provides functionality to simulate webhook events from AcmeCRM
 * 
 * This service:
 * 1. Generates webhook events with proper structure
 * 2. Signs webhooks using HMAC-SHA256 (same as AcmeCRM)
 * 3. Delivers webhooks to configured endpoints
 * 4. Tracks webhook delivery history and status
 * 5. Implements retry logic for failed deliveries
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const config = require('../config/app.config');
const logger = require('../utils/logger');
const PostgresService = require('./postgres.service');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');

/**
 * Webhook Simulator Service class
 * Provides methods for simulating webhook events
 */
class WebhookSimulatorService {
  /**
   * Generate a webhook event
   * @param {string} eventType - Type of event (e.g., "contact.created")
   * @param {Object} data - Event data
   * @returns {Object} Generated webhook event
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
   *   event: "contact.created",
   *   timestamp: "2025-05-19T00:00:00.000Z",
   *   id: "evt_123456789",
   *   data: {
   *     id: "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john.doe@example.com"
   *   }
   * }
   */
  static generateWebhookEvent(eventType, data) {
    // Validate event type
    const validEventTypes = ['contact.created', 'contact.updated', 'contact.deleted'];
    if (!validEventTypes.includes(eventType)) {
      throw new AppError(`Invalid event type: ${eventType}`, errorTypes.VALIDATION_ERROR, {
        code: errorCodes.INVALID_INPUT,
        details: `Event type must be one of: ${validEventTypes.join(', ')}`
      });
    }
    
    // Generate event ID with evt_ prefix (similar to AcmeCRM)
    const eventId = `evt_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Create webhook event object
    const webhookEvent = {
      event: eventType,
      timestamp: new Date().toISOString(),
      id: eventId,
      data
    };
    
    return webhookEvent;
  }
  
  /**
   * Sign a webhook payload
   * @param {Object|string} payload - Webhook payload (object or JSON string)
   * @returns {Object} Signature and timestamp
   * 
   * Example:
   * Input: 
   * {
   *   event: "contact.created",
   *   timestamp: "2025-05-19T00:00:00.000Z",
   *   id: "evt_123456789",
   *   data: {...}
   * }
   * 
   * Output:
   * {
   *   signature: "sha256=abc123...",
   *   timestamp: "2025-05-19T00:00:00.000Z"
   * }
   */
  static signWebhookPayload(payload) {
    // Convert payload to string if it's an object
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    // Get current timestamp
    const timestamp = new Date().toISOString();
    
    // Create signature string (payload + timestamp)
    const signatureString = `${payloadString}${timestamp}`;
    
    // Create HMAC signature
    const signature = crypto
      .createHmac('sha256', config.acme.webhookSecret)
      .update(signatureString)
      .digest('hex');
    
    return {
      signature: `sha256=${signature}`,
      timestamp
    };
  }
  
  /**
   * Deliver a webhook to a target URL
   * @param {string} targetUrl - URL to deliver the webhook to
   * @param {Object} webhookEvent - Webhook event to deliver
   * @returns {Promise<Object>} Delivery result
   * 
   * Example:
   * Input:
   *   targetUrl: "http://localhost:3000/api/webhooks"
   *   webhookEvent: {
   *     event: "contact.created",
   *     timestamp: "2025-05-19T00:00:00.000Z",
   *     id: "evt_123456789",
   *     data: {...}
   *   }
   * 
   * Output:
   * {
   *   id: 1,
   *   event_id: "evt_123456789",
   *   target_url: "http://localhost:3000/api/webhooks",
   *   status: "delivered",
   *   response: { statusCode: 200, body: {...} },
   *   created_at: "2025-05-19T00:01:00.000Z",
   *   delivered_at: "2025-05-19T00:01:00.000Z"
   * }
   */
  static async deliverWebhook(targetUrl, webhookEvent) {
    logger.info('WebhookSimulatorService: deliverWebhook called', { targetUrl, eventId: webhookEvent.id });
    
    // Store delivery attempt in database
    let deliveryId;
    try {
      deliveryId = await this.storeWebhookDelivery(webhookEvent.id, targetUrl);
      logger.info('WebhookSimulatorService: Webhook delivery stored', { deliveryId, eventId: webhookEvent.id });
    } catch (error) {
      logger.error('WebhookSimulatorService: Failed to store webhook delivery', error);
      throw new AppError('Failed to store webhook delivery', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
    
    try {
      // Sign the webhook payload
      logger.info('WebhookSimulatorService: Signing webhook payload');
      const { signature, timestamp } = this.signWebhookPayload(webhookEvent);
      
      // Set up headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Acme-Signature': signature,
        'X-Acme-Timestamp': timestamp
      };
      
      // Deliver webhook
      logger.info('WebhookSimulatorService: Delivering webhook to target URL', { targetUrl });
      const response = await axios.post(targetUrl, webhookEvent, { headers });
      
      // Update delivery status
      logger.info('WebhookSimulatorService: Updating delivery status to delivered', { deliveryId });
      try {
        await this.updateDeliveryStatus(deliveryId, 'delivered', {
          statusCode: response.status,
          body: response.data
        });
      } catch (updateError) {
        logger.error('WebhookSimulatorService: Failed to update delivery status', updateError);
        // Continue execution despite update error
      }
      
      logger.info(`WebhookSimulatorService: Webhook delivered successfully: ${webhookEvent.id}`, {
        eventId: webhookEvent.id,
        targetUrl,
        status: response.status
      });
      
      return await this.getWebhookDelivery(deliveryId);
    } catch (error) {
      // Handle delivery failure
      logger.error(`WebhookSimulatorService: Webhook delivery failed: ${webhookEvent.id}`, {
        eventId: webhookEvent.id,
        targetUrl,
        error: error.message
      });
      
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : null
      };
      
      try {
        await this.updateDeliveryStatus(deliveryId, 'failed', errorDetails);
      } catch (updateError) {
        logger.error('WebhookSimulatorService: Failed to update delivery status after failure', updateError);
        // Continue execution despite update error
      }
      
      // Schedule retry if appropriate
      if (this.shouldRetryDelivery(error)) {
        this.scheduleRetry(deliveryId, targetUrl, webhookEvent);
      }
      
      try {
        return await this.getWebhookDelivery(deliveryId);
      } catch (getError) {
        logger.error('WebhookSimulatorService: Failed to get webhook delivery after failure', getError);
        // Return a basic delivery object if we can't get the actual one
        return {
          id: deliveryId,
          event_id: webhookEvent.id,
          target_url: targetUrl,
          status: 'failed',
          details: errorDetails,
          created_at: new Date().toISOString()
        };
      }
    }
  }
  
  /**
   * Determine if delivery should be retried
   * @param {Error} error - Delivery error
   * @returns {boolean} Whether to retry delivery
   * 
   * @private
   */
  static shouldRetryDelivery(error) {
    // Retry on network errors or 5xx server errors
    if (!error.response) {
      return true; // Network error
    }
    
    const statusCode = error.response.status;
    return statusCode >= 500 && statusCode < 600;
  }
  
  /**
   * Schedule a retry for failed webhook delivery
   * @param {number} deliveryId - ID of the failed delivery
   * @param {string} targetUrl - URL to deliver the webhook to
   * @param {Object} webhookEvent - Webhook event to deliver
   * @returns {Promise<void>}
   * 
   * @private
   */
  static async scheduleRetry(deliveryId, targetUrl, webhookEvent) {
    try {
      // Get current retry count
      const delivery = await this.getWebhookDelivery(deliveryId);
      const retryCount = delivery.retry_count || 0;
      
      // Check if max retries reached
      if (retryCount >= config.acme.webhookMaxRetries) {
        logger.info(`Max retries reached for webhook: ${webhookEvent.id}`, {
          eventId: webhookEvent.id,
          deliveryId,
          retryCount
        });
        return;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        config.acme.webhookRetryInitialDelay * Math.pow(2, retryCount),
        config.acme.webhookRetryMaxDelay
      );
      
      // Update retry count
      await PostgresService.query(
        'UPDATE webhook_deliveries SET retry_count = $1 WHERE id = $2',
        [retryCount + 1, deliveryId]
      );
      
      // Schedule retry
      setTimeout(async () => {
        logger.info(`Retrying webhook delivery: ${webhookEvent.id} (Attempt ${retryCount + 1})`, {
          eventId: webhookEvent.id,
          deliveryId,
          retryCount: retryCount + 1
        });
        
        await this.deliverWebhook(targetUrl, webhookEvent);
      }, delayMs);
      
      logger.info(`Scheduled retry for webhook: ${webhookEvent.id} in ${delayMs}ms`, {
        eventId: webhookEvent.id,
        deliveryId,
        retryCount: retryCount + 1,
        delayMs
      });
    } catch (error) {
      logger.error(`Error scheduling retry for webhook: ${webhookEvent.id}`, error);
    }
  }
  
  /**
   * Store webhook delivery in database
   * @param {string} eventId - Webhook event ID
   * @param {string} targetUrl - URL the webhook is being delivered to
   * @returns {Promise<number>} Delivery ID
   * 
   * @private
   */
  static async storeWebhookDelivery(eventId, targetUrl) {
    try {
      const result = await PostgresService.query(
        `INSERT INTO webhook_deliveries 
         (event_id, target_url, status, created_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
         RETURNING id`,
        [eventId, targetUrl, 'pending']
      );
      
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error storing webhook delivery', error);
      throw new AppError('Failed to store webhook delivery', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Update webhook delivery status
   * @param {number} deliveryId - Delivery ID
   * @param {string} status - New status ('pending', 'delivered', 'failed')
   * @param {Object} [details] - Additional details (response or error)
   * @returns {Promise<void>}
   * 
   * @private
   */
  static async updateDeliveryStatus(deliveryId, status, details = null) {
    logger.info('WebhookSimulatorService: updateDeliveryStatus called', { deliveryId, status });
    
    try {
      // Validate parameters
      if (!deliveryId) {
        throw new Error('deliveryId is required');
      }
      
      if (!status) {
        throw new Error('status is required');
      }
      
      // Ensure details is properly formatted for JSON storage
      let formattedDetails = null;
      if (details) {
        try {
          formattedDetails = JSON.stringify(details);
        } catch (jsonError) {
          logger.warn('WebhookSimulatorService: Failed to stringify details', { error: jsonError.message, details });
          formattedDetails = JSON.stringify({ error: 'Failed to stringify details', message: jsonError.message });
        }
      }
      
      logger.info('WebhookSimulatorService: Executing update query', { deliveryId, status });
      
      // Execute the update query
      await PostgresService.query(
        `UPDATE webhook_deliveries 
         SET status = $1, 
             details = $2, 
             delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, formattedDetails, deliveryId]
      );
      
      logger.info('WebhookSimulatorService: Webhook delivery status updated successfully', { deliveryId, status });
    } catch (error) {
      logger.error('WebhookSimulatorService: Error updating webhook delivery status', {
        error: error.message,
        stack: error.stack,
        deliveryId,
        status
      });
      throw new AppError('Failed to update webhook delivery status', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Get webhook delivery by ID
   * @param {number} deliveryId - Delivery ID
   * @returns {Promise<Object>} Webhook delivery
   * 
   * @private
   */
  static async getWebhookDelivery(deliveryId) {
    try {
      const result = await PostgresService.query(
        'SELECT * FROM webhook_deliveries WHERE id = $1',
        [deliveryId]
      );
      
      if (result.rows.length === 0) {
        throw new AppError(`Webhook delivery with ID ${deliveryId} not found`, errorTypes.NOT_FOUND, {
          code: errorCodes.RESOURCE_NOT_FOUND
        });
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error retrieving webhook delivery', error);
      throw new AppError('Failed to retrieve webhook delivery', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Get webhook delivery history
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=10] - Maximum number of records to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @param {string} [options.status] - Filter by status
   * @param {string} [options.eventId] - Filter by event ID
   * @returns {Promise<Array>} Webhook delivery history
   * 
   * Example:
   * Input: { limit: 5, status: 'delivered' }
   * 
   * Output:
   * [
   *   {
   *     id: 1,
   *     event_id: "evt_123456789",
   *     target_url: "http://localhost:3000/api/webhooks",
   *     status: "delivered",
   *     details: { statusCode: 200, body: {...} },
   *     created_at: "2025-05-19T00:01:00.000Z",
   *     delivered_at: "2025-05-19T00:01:00.000Z"
   *   },
   *   ...
   * ]
   */
  static async getWebhookDeliveryHistory(options = {}) {
    try {
      logger.info('WebhookSimulatorService: getWebhookDeliveryHistory called', { options });
      
      const { limit = 10, offset = 0, status, eventId } = options;
      
      let query = 'SELECT * FROM webhook_deliveries';
      const params = [];
      const conditions = [];
      
      // Add filters
      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }
      
      if (eventId) {
        conditions.push(`event_id = $${params.length + 1}`);
        params.push(eventId);
      }
      
      // Add WHERE clause if conditions exist
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add ORDER BY and LIMIT/OFFSET
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      logger.info('WebhookSimulatorService: Executing query', { query, params });
      const result = await PostgresService.query(query, params);
      
      logger.info('WebhookSimulatorService: Query executed successfully', { rowCount: result.rowCount });
      return result.rows;
    } catch (error) {
      logger.error('WebhookSimulatorService: Error retrieving webhook delivery history', error);
      throw new AppError('Failed to retrieve webhook delivery history', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Simulate a webhook event and deliver it
   * @param {string} eventType - Type of event (e.g., "contact.created")
   * @param {Object} data - Event data
   * @param {string} targetUrl - URL to deliver the webhook to
   * @returns {Promise<Object>} Simulation result
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
   *   targetUrl: "http://localhost:3000/api/webhooks"
   * 
   * Output:
   * {
   *   event: {
   *     event: "contact.created",
   *     timestamp: "2025-05-19T00:00:00.000Z",
   *     id: "evt_123456789",
   *     data: {...}
   *   },
   *   delivery: {
   *     id: 1,
   *     event_id: "evt_123456789",
   *     target_url: "http://localhost:3000/api/webhooks",
   *     status: "delivered",
   *     ...
   *   }
   * }
   */
  static async simulateWebhook(eventType, data, targetUrl) {
    try {
      logger.info('WebhookSimulatorService: simulateWebhook called', { eventType, targetUrl });
      
      // Generate webhook event
      logger.info('WebhookSimulatorService: Generating webhook event');
      const webhookEvent = this.generateWebhookEvent(eventType, data);
      
      // Deliver webhook
      logger.info('WebhookSimulatorService: Delivering webhook', { eventId: webhookEvent.id });
      const delivery = await this.deliverWebhook(targetUrl, webhookEvent);
      
      logger.info('WebhookSimulatorService: Webhook simulated successfully', { eventId: webhookEvent.id, deliveryId: delivery.id });
      return {
        event: webhookEvent,
        delivery
      };
    } catch (error) {
      logger.error(`WebhookSimulatorService: Error simulating webhook: ${eventType}`, error);
      throw new AppError('Failed to simulate webhook', errorTypes.INTERNAL_ERROR, {
        code: errorCodes.INTERNAL_ERROR,
        details: error.message
      });
    }
  }
}

module.exports = WebhookSimulatorService;
