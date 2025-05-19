/**
 * Webhook Simulator Routes
 * Defines API endpoints for simulating webhook events
 * 
 * This module:
 * 1. Defines routes for manually triggering webhook events
 * 2. Provides endpoints for viewing webhook delivery history
 * 3. Secures routes with authentication middleware
 */

const express = require('express');
const router = express.Router();
const WebhookSimulatorController = require('../controllers/webhook-simulator.controller');
const { authenticate } = require('../middleware/auth.middleware');

// POST /api/simulator/webhooks - Simulate a webhook event
router.post('/webhooks', function(req, res, next) {
  WebhookSimulatorController.simulateWebhook(req, res, next);
});

// GET /api/simulator/webhooks/history - Get webhook delivery history
router.get('/webhooks/history', function(req, res, next) {
  WebhookSimulatorController.getWebhookDeliveryHistory(req, res, next);
});

// GET /api/simulator/webhooks/history/:id - Get webhook delivery details
router.get('/webhooks/history/:id', function(req, res, next) {
  WebhookSimulatorController.getWebhookDeliveryDetails(req, res, next);
});

module.exports = router;
