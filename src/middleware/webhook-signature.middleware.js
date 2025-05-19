/**
 * Webhook Signature Verification Middleware
 * 
 * This middleware verifies the authenticity of incoming webhook requests by:
 * 1. Checking for the presence of required headers (X-Acme-Signature, X-Acme-Timestamp)
 * 2. Verifying the signature using HMAC-SHA256
 * 3. Checking that the timestamp is recent (within 5 minutes) to prevent replay attacks
 * 
 * If verification fails, the request is rejected with an appropriate error response.
 */

const crypto = require('crypto');
const config = require('../config/app.config');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');
const logger = require('../utils/logger');

/**
 * Verify webhook signature
 * 
 * Example headers:
 * {
 *   'x-acme-signature': 'sha256=abc123...',
 *   'x-acme-timestamp': '2025-05-19T00:00:00.000Z'
 * }
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Get the signature and timestamp from headers
    const signature = req.headers['x-acme-signature'];
    const timestamp = req.headers['x-acme-timestamp'];
    
    // Check if signature and timestamp are present
    if (!signature || !timestamp) {
      throw new AppError(
        'Missing webhook signature or timestamp',
        errorTypes.UNAUTHORIZED,
        {
          code: errorCodes.INVALID_SIGNATURE,
          details: {
            missingHeaders: !signature ? 'x-acme-signature' : (!timestamp ? 'x-acme-timestamp' : null)
          }
        }
      );
    }
    
    // Parse the signature (format: 'sha256=abc123...')
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      throw new AppError(
        'Invalid signature format',
        errorTypes.UNAUTHORIZED,
        {
          code: errorCodes.INVALID_SIGNATURE,
          details: { signature }
        }
      );
    }
    
    // Get the signature value
    const signatureValue = signatureParts[1];
    
    // Check if timestamp is recent (within 5 minutes)
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (isNaN(timestampDate.getTime()) || timestampDate < fiveMinutesAgo) {
      throw new AppError(
        'Webhook timestamp is too old or invalid',
        errorTypes.UNAUTHORIZED,
        {
          code: errorCodes.INVALID_TIMESTAMP,
          details: { timestamp }
        }
      );
    }
    
    // Get the request body as a string
    const requestBody = JSON.stringify(req.body);
    
    // Create the string to sign: timestamp + requestBody
    const stringToSign = timestamp + requestBody;
    
    // Compute the expected signature
    const expectedSignature = crypto
      .createHmac('sha256', config.acme.webhookSecret)
      .update(stringToSign)
      .digest('hex');
    
    // Compare the expected signature with the provided signature
    if (signatureValue !== expectedSignature) {
      throw new AppError(
        'Invalid webhook signature',
        errorTypes.UNAUTHORIZED,
        {
          code: errorCodes.INVALID_SIGNATURE,
          details: { signature }
        }
      );
    }
    
    // If we get here, the signature is valid
    logger.info('Webhook signature verified successfully');
    next();
  } catch (error) {
    logger.error('Webhook signature verification failed', error);
    
    // If the error is already an AppError, pass it through
    if (error instanceof AppError) {
      next(error);
    } else {
      // Otherwise, create a new AppError
      next(new AppError(
        'Webhook signature verification failed',
        errorTypes.UNAUTHORIZED,
        {
          code: errorCodes.INVALID_SIGNATURE,
          details: error.message
        }
      ));
    }
  }
};

module.exports = verifyWebhookSignature;
