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
  
  // Redis configuration (will be used in Task 1.2)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // JWT configuration (will be used in Task 1.4)
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key-for-development',
    expiresIn: parseInt(process.env.JWT_EXPIRATION || '3600', 10),
  },
  
  // Kafka configuration (will be used in Task 1.3)
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'acme-integration',
  },
};

// Validate critical configuration
if (config.server.env === 'production' && config.jwt.secret === 'default-secret-key-for-development') {
  console.warn('WARNING: Using default JWT secret in production environment!');
}

module.exports = config;
