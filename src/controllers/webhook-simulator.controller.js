/**
 * Webhook Simulator Controller
 * Handles requests for simulating webhook events
 * 
 * This controller:
 * 1. Processes requests to manually trigger webhook events
 * 2. Retrieves webhook delivery history
 * 3. Provides details about specific webhook deliveries
 */

const { v4: uuidv4 } = require('uuid');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');
const WebhookSimulatorService = require('../services/webhook-simulator.service');
const config = require('../config/app.config');

/**
 * Webhook Simulator Controller
 */
class WebhookSimulatorController {
  /**
   * Simulate a webhook event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example request body:
   * {
   *   "eventType": "contact.created",
   *   "data": {
   *     "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
   *     "firstName": "John",
   *     "lastName": "Doe",
   *     "email": "john.doe@example.com"
   *   },
   *   "targetUrl": "http://localhost:3000/api/webhooks"
   * }
   * 
   * Example response:
   * {
   *   "message": "Webhook simulated successfully",
   *   "event": {
   *     "event": "contact.created",
   *     "timestamp": "2025-05-19T00:00:00.000Z",
   *     "id": "evt_123456789",
   *     "data": {...}
   *   },
   *   "delivery": {
   *     "id": 1,
   *     "event_id": "evt_123456789",
   *     "target_url": "http://localhost:3000/api/webhooks",
   *     "status": "delivered",
   *     ...
   *   }
   * }
   */
  static async simulateWebhook(req, res, next) {
    try {
      logger.info('Webhook simulator controller: simulateWebhook called', { body: req.body });
      
      const { eventType, data, targetUrl } = req.body;
      
      // Validate required fields
      if (!eventType || !data || !targetUrl) {
        logger.warn('Webhook simulator controller: Missing required fields', { body: req.body });
        throw new AppError('Missing required fields', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: 'eventType, data, and targetUrl are required'
        });
      }
      
      logger.info('Webhook simulator controller: Calling WebhookSimulatorService.simulateWebhook');
      // Simulate webhook
      const result = await WebhookSimulatorService.simulateWebhook(eventType, data, targetUrl);
      
      logger.info('Webhook simulator controller: Webhook simulated successfully', { result });
      // Return response
      res.status(200).json({
        message: 'Webhook simulated successfully',
        event: result.event,
        delivery: result.delivery
      });
    } catch (error) {
      logger.error('Webhook simulator controller: Error simulating webhook', error);
      next(error);
    }
  }
  
  /**
   * Get webhook delivery history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example query parameters:
   * ?limit=10&offset=0&status=delivered&eventId=evt_123456789
   * 
   * Example response:
   * {
   *   "message": "Webhook delivery history retrieved successfully",
   *   "deliveries": [
   *     {
   *       "id": 1,
   *       "event_id": "evt_123456789",
   *       "target_url": "http://localhost:3000/api/webhooks",
   *       "status": "delivered",
   *       ...
   *     },
   *     ...
   *   ],
   *   "pagination": {
   *     "limit": 10,
   *     "offset": 0,
   *     "total": 25
   *   }
   * }
   */
  static async getWebhookDeliveryHistory(req, res, next) {
    try {
      logger.info('Webhook simulator controller: getWebhookDeliveryHistory called', { query: req.query });
      
      const { limit, offset, status, eventId } = req.query;
      
      // Convert limit and offset to numbers
      const options = {
        limit: limit ? parseInt(limit, 10) : 10,
        offset: offset ? parseInt(offset, 10) : 0,
        status,
        eventId
      };
      
      logger.info('Webhook simulator controller: Calling WebhookSimulatorService.getWebhookDeliveryHistory', { options });
      // Get webhook delivery history
      const deliveries = await WebhookSimulatorService.getWebhookDeliveryHistory(options);
      
      logger.info('Webhook simulator controller: Webhook delivery history retrieved successfully', { count: deliveries.length });
      // Return response
      res.status(200).json({
        message: 'Webhook delivery history retrieved successfully',
        deliveries,
        pagination: {
          limit: options.limit,
          offset: options.offset
        }
      });
    } catch (error) {
      logger.error('Webhook simulator controller: Error retrieving webhook delivery history', error);
      next(error);
    }
  }
  
  /**
   * Get webhook delivery details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {Promise<void>}
   * 
   * Example response:
   * {
   *   "message": "Webhook delivery details retrieved successfully",
   *   "delivery": {
   *     "id": 1,
   *     "event_id": "evt_123456789",
   *     "target_url": "http://localhost:3000/api/webhooks",
   *     "status": "delivered",
   *     "details": { statusCode: 200, body: {...} },
   *     "created_at": "2025-05-19T00:01:00.000Z",
   *     "delivered_at": "2025-05-19T00:01:00.000Z"
   *   }
   * }
   */
  static async getWebhookDeliveryDetails(req, res, next) {
    try {
      const { id } = req.params;
      
      // Validate ID
      if (!id || isNaN(parseInt(id, 10))) {
        throw new AppError('Invalid delivery ID', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: 'Delivery ID must be a number'
        });
      }
      
      // Get webhook delivery details
      const delivery = await WebhookSimulatorService.getWebhookDelivery(parseInt(id, 10));
      
      // Return response
      res.status(200).json({
        message: 'Webhook delivery details retrieved successfully',
        delivery
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = WebhookSimulatorController;
