/**
 * Main server file for AcmeCRM Integration Service
 * Sets up Express server with middleware and routes
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const config = require('./config/app.config');
const logger = require('./utils/logger');
const { requestIdMiddleware, notFoundHandler, methodNotAllowedHandler, errorHandler, asyncHandler } = require('./middleware/error.middleware');
const { rateLimiter, authRateLimiter, apiRateLimiter } = require('./middleware/rate-limit.middleware');
const { dynamicTimeout } = require('./middleware/timeout.middleware');

// Import routes
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contact.routes');
const webhookRoutes = require('./routes/webhook.routes');
const simulatorRoutes = require('./routes/simulator.routes');

// Initialize Express app
const app = express();

// Apply basic middleware
app.use(cors());
app.use(morgan('dev')); // HTTP request logging
app.use(requestIdMiddleware); // Generate unique request IDs
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Apply timeout middleware with dynamic timeouts based on route
app.use(dynamicTimeout(config.timeout.routes, config.timeout.default));

// Apply global rate limiting
app.use(rateLimiter(config.rateLimit.global));

// Apply routes with specific rate limits
app.use('/health', healthRoutes);

// Mock AcmeCRM routes with specific rate limits
app.use('/mock-acme/auth/login', rateLimiter(config.rateLimit.auth.login));
app.use('/mock-acme/auth/refresh', rateLimiter(config.rateLimit.auth.refresh));
app.use('/mock-acme/auth', authRoutes);

// Apply API rate limiting to all API routes
app.use('/api', apiRateLimiter(config.rateLimit.api));

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/simulator', simulatorRoutes);

// Apply error handling middleware
app.use(methodNotAllowedHandler);
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running in ${config.server.env} mode on port ${PORT}`);
  logger.info(`Rate limiting: ${config.rateLimit.global.limit} requests per ${config.rateLimit.global.windowSec} seconds`);
  logger.info(`Request timeout: ${config.timeout.default}ms default`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', err);
  // In a production environment, you might want to exit the process
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  // In a production environment, you should gracefully shut down
  // setTimeout(() => process.exit(1), 1000);
});

module.exports = app; // Export for testing
