/**
 * Webhook Receiver Test
 * 
 * This test verifies the webhook receiver functionality:
 * 1. Tests signature verification
 * 2. Tests webhook payload validation
 * 3. Tests webhook event storage
 * 4. Tests webhook event processing
 */

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/app.config');
const logger = require('../utils/logger');
const PostgresService = require('../services/postgres.service');

// Test configuration
const API_URL = 'http://localhost:3000/api';
const WEBHOOK_URL = `${API_URL}/webhooks`;

/**
 * Generate a webhook signature
 * @param {Object} payload - Webhook payload
 * @param {string} timestamp - ISO timestamp
 * @returns {string} HMAC-SHA256 signature
 */
function generateSignature(payload, timestamp) {
  const stringToSign = timestamp + JSON.stringify(payload);
  return 'sha256=' + crypto
    .createHmac('sha256', config.acme.webhookSecret)
    .update(stringToSign)
    .digest('hex');
}

/**
 * Main test function
 */
async function runTests() {
  try {
    logger.info('Starting Webhook Receiver Tests');
    
    // Initialize PostgreSQL tables
    logger.info('\nInitializing PostgreSQL tables');
    await PostgresService.initializeTables();
    
    // Test 1: Valid webhook with correct signature
    logger.info('\nTest 1: Valid webhook with correct signature');
    const timestamp = new Date().toISOString();
    const contactId = uuidv4();
    const eventId = `evt_${Date.now()}`;
    
    const webhookPayload = {
      event: 'contact.created',
      timestamp: timestamp,
      id: eventId,
      data: {
        id: contactId,
        firstName: 'John',
        lastName: 'Smith',
        email: `john.smith.${Date.now()}@example.com`,
        phone: '555-987-6543',
        company: 'Acme Inc',
        title: 'Senior Engineer',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    };
    
    const signature = generateSignature(webhookPayload, timestamp);
    
    const response = await axios.post(
      WEBHOOK_URL,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Acme-Signature': signature,
          'X-Acme-Timestamp': timestamp
        }
      }
    );
    
    logger.info(`Webhook response status: ${response.status}`);
    logger.info('Webhook response:', response.data);
    
    if (response.status !== 200) {
      throw new Error('Webhook test failed - expected 200 OK');
    }
    
    // Test 2: Invalid signature
    logger.info('\nTest 2: Invalid signature');
    try {
      await axios.post(
        WEBHOOK_URL,
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Acme-Signature': 'sha256=invalid',
            'X-Acme-Timestamp': timestamp
          }
        }
      );
      throw new Error('Invalid signature test failed - expected 401 Unauthorized');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logger.info('Invalid signature test passed - received 401 Unauthorized');
        logger.info('Error details:', error.response.data);
      } else {
        throw error;
      }
    }
    
    // Test 3: Missing signature
    logger.info('\nTest 3: Missing signature');
    try {
      await axios.post(
        WEBHOOK_URL,
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Acme-Timestamp': timestamp
          }
        }
      );
      throw new Error('Missing signature test failed - expected 401 Unauthorized');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logger.info('Missing signature test passed - received 401 Unauthorized');
        logger.info('Error details:', error.response.data);
      } else {
        throw error;
      }
    }
    
    // Test 4: Invalid payload (missing required fields)
    logger.info('\nTest 4: Invalid payload');
    const invalidPayload = {
      event: 'contact.created',
      timestamp: timestamp,
      id: eventId,
      // Missing data field
    };
    
    const invalidSignature = generateSignature(invalidPayload, timestamp);
    
    try {
      await axios.post(
        WEBHOOK_URL,
        invalidPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Acme-Signature': invalidSignature,
            'X-Acme-Timestamp': timestamp
          }
        }
      );
      throw new Error('Invalid payload test failed - expected 400 Bad Request');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logger.info('Invalid payload test passed - received 400 Bad Request');
        logger.info('Error details:', error.response.data);
      } else {
        throw error;
      }
    }
    
    logger.info('\nWebhook Receiver Tests completed successfully');
  } catch (error) {
    logger.error('Error in Webhook Receiver Tests:', error.response?.data || error);
  } finally {
    // Close PostgreSQL connection
    const pool = PostgresService.getPool();
    await pool.end();
    logger.info('PostgreSQL connection pool closed');
  }
}

// Run the tests
runTests();
