/**
 * Main Application
 * Entry point for the AcmeCRM Integration Service
 * 
 * This module:
 * 1. Sets up the Express application
 * 2. Configures middleware
 * 3. Registers routes
 * 4. Sets up error handling
 * 5. Initializes database connections
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { AppError, errorTypes, errorCodes } = require('./utils/error-handler');
const config = require('./config/app.config');
const logger = require('./utils/logger');
const PostgresService = require('./services/postgres.service');

// Import routes
const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contact.routes');
const webhookRoutes = require('./routes/webhook.routes');
const simulatorRoutes = require('./routes/simulator.routes');

// Create Express app
const app = express();

// Initialize databases
async function initializeDatabases() {
  try {
    // Initialize PostgreSQL tables
    await PostgresService.initializeTables();
    logger.info('PostgreSQL tables initialized');
  } catch (error) {
    logger.error('Error initializing databases', error);
    process.exit(1);
  }
}

// Configure middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Request logging

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/simulator', simulatorRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: config.version,
    timestamp: new Date().toISOString()
  });
});

// Test route for debugging
app.get('/test', (req, res) => {
  logger.info('Test route accessed');
  res.status(200).json({
    message: 'Test route working',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, errorTypes.NOT_FOUND, {
    code: errorCodes.ROUTE_NOT_FOUND
  });
  next(error);
});

// Error handling middleware
app.use((error, req, res, next) => {
  // Default to 500 server error
  const status = error.status || 500;
  const errorResponse = error instanceof AppError
    ? error.toResponse()
    : {
        error: {
          message: error.message || 'Internal server error',
          type: errorTypes.INTERNAL_ERROR,
          status: 500,
          timestamp: new Date().toISOString(),
          code: errorCodes.INTERNAL_SERVER_ERROR
        }
      };
  
  // Log error
  if (status >= 500) {
    logger.error(`Error: ${error.message}`, error);
  } else {
    logger.warn(`Error: ${error.message}`, error);
  }
  
  // Send error response
  res.status(status).json(errorResponse);
});

// Start server
const PORT = config.port || 3000;

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  await initializeDatabases();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', error);
  process.exit(1);
});

module.exports = app;
