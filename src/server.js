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
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

// Import routes
const healthRoutes = require('./routes/health.routes');

// Initialize Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(morgan('dev')); // HTTP request logging
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Apply routes
app.use('/health', healthRoutes);
app.use('/details', healthRoutes);

// Apply error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running in ${config.server.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', err);
  // In a production environment, you might want to exit the process
  // process.exit(1);
});

module.exports = app; // Export for testing
