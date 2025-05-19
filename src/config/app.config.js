/**
 * Application configuration
 * Loads environment variables and provides configuration for the application
 */

require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // PostgreSQL configuration
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'acme_integration',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true',
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10', 10), // Max number of clients in the pool
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10), // How long a client is allowed to remain idle before being closed
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key-for-development',
    expiresIn: parseInt(process.env.JWT_EXPIRATION || '3600', 10),
  },
  
  // Kafka configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    clientId: process.env.KAFKA_CLIENT_ID || 'acme-integration',
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL === 'true' ? {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || ''
    } : null,
    topics: {
      contacts: process.env.KAFKA_TOPIC_CONTACTS || 'contacts',
      auth: process.env.KAFKA_TOPIC_AUTH || 'auth',
      default: process.env.KAFKA_TOPIC_DEFAULT || 'events',
      // Webhook event topics
      'contact.created': 'contact.created',
      'contact.updated': 'contact.updated',
      'contact.deleted': 'contact.deleted'
    }
  },
  
  // AcmeCRM configuration
  acme: {
    apiKey: process.env.ACME_API_KEY || 'test-api-key',
    apiUrl: process.env.ACME_API_URL || 'https://api.acmecrm.com',
    webhookSecret: process.env.ACME_WEBHOOK_SECRET || 'test-webhook-secret',
    // Maximum age of webhook signatures in milliseconds (5 minutes)
    webhookMaxAge: parseInt(process.env.ACME_WEBHOOK_MAX_AGE || '300000', 10),
    // Webhook simulator configuration
    webhookSimulator: {
      // Default target URL for simulated webhooks
      targetUrl: process.env.WEBHOOK_SIMULATOR_TARGET_URL || 'http://localhost:3000/api/webhooks',
      // Whether to automatically trigger webhooks after CRUD operations
      autoTrigger: process.env.WEBHOOK_SIMULATOR_AUTO_TRIGGER === 'true' || true,
      // Retry configuration for failed webhook deliveries
      webhookMaxRetries: parseInt(process.env.WEBHOOK_SIMULATOR_MAX_RETRIES || '3', 10),
      webhookRetryInitialDelay: parseInt(process.env.WEBHOOK_SIMULATOR_RETRY_INITIAL_DELAY || '1000', 10), // 1 second
      webhookRetryMaxDelay: parseInt(process.env.WEBHOOK_SIMULATOR_RETRY_MAX_DELAY || '60000', 10) // 1 minute
    }
  },
  
  // Error handling configuration
  errors: {
    // Whether to include stack traces in error responses
    includeStack: process.env.INCLUDE_ERROR_STACK === 'true' || false,
    // Whether to include detailed error information in responses
    includeDetails: process.env.NODE_ENV !== 'production',
  },
  
  // Rate limiting configuration
  rateLimit: {
    // Global rate limits (applies to all routes unless overridden)
    global: {
      limit: parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10),
      windowSec: parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '60', 10),
    },
    // Authentication rate limits
    auth: {
      login: {
        limit: parseInt(process.env.RATE_LIMIT_LOGIN || '5', 10),
        windowSec: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_SEC || '60', 10),
      },
      refresh: {
        limit: parseInt(process.env.RATE_LIMIT_REFRESH || '20', 10),
        windowSec: parseInt(process.env.RATE_LIMIT_REFRESH_WINDOW_SEC || '60', 10),
      },
    },
    // API rate limits
    api: {
      limit: parseInt(process.env.RATE_LIMIT_API || '30', 10),
      windowSec: parseInt(process.env.RATE_LIMIT_API_WINDOW_SEC || '60', 10),
    },
    // Backoff configuration
    backoff: {
      baseTimeSec: parseInt(process.env.RATE_LIMIT_BACKOFF_BASE || '5', 10),
      maxTimeSec: parseInt(process.env.RATE_LIMIT_BACKOFF_MAX || '3600', 10),
    },
  },
  
  // Request timeout configuration
  timeout: {
    // Default timeout for all requests (30 seconds)
    default: parseInt(process.env.REQUEST_TIMEOUT_DEFAULT || '30000', 10),
    // Specific timeouts for different route types
    routes: {
      '/health': parseInt(process.env.REQUEST_TIMEOUT_HEALTH || '5000', 10),
      '/mock-acme/auth/*': parseInt(process.env.REQUEST_TIMEOUT_AUTH || '10000', 10),
      '/mock-acme/webhooks/*': parseInt(process.env.REQUEST_TIMEOUT_WEBHOOKS || '60000', 10),
    },
  },
};

// Validate critical configuration
if (config.server.env === 'production') {
  if (config.jwt.secret === 'default-secret-key-for-development') {
    console.warn('WARNING: Using default JWT secret in production environment!');
  }
  
  if (config.errors.includeDetails) {
    console.warn('WARNING: Detailed error information is enabled in production environment!');
  }
}

module.exports = config;
