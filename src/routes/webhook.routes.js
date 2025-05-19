/**
 * Webhook Routes
 * 
 * This module defines the routes for handling webhook events from AcmeCRM:
 * 1. POST /api/webhooks - Receive webhook events
 * 2. GET /api/webhooks/:id - Get a specific webhook event
 * 3. GET /api/webhooks/pending - Get pending webhook events
 * 
 * The routes use the webhook signature verification middleware to ensure
 * that webhook requests are authentic and have not been tampered with.
 */

const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhook.controller');
const verifyWebhookSignature = require('../middleware/webhook-signature.middleware');
const { authenticate } = require('../middleware/auth.middleware');

// POST /api/webhooks - Receive webhook events
router.post('/', verifyWebhookSignature, function(req, res, next) {
  WebhookController.handleWebhook(req, res, next);
});

// GET /api/webhooks/pending - Get pending webhook events
router.get('/pending', authenticate, function(req, res, next) {
  WebhookController.getPendingWebhookEvents(req, res, next);
});

// GET /api/webhooks/:id - Get a specific webhook event
router.get('/:id', authenticate, function(req, res, next) {
  WebhookController.getWebhookEvent(req, res, next);
});

module.exports = router;
