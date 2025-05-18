/**
 * Redis configuration
 * Provides configuration for Redis connections
 */

const config = require('./app.config');

/**
 * Redis configuration object
 * Contains settings for connecting to Redis
 */
const redisConfig = {
  // Connection settings
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  
  // Reconnection settings
  retryStrategy: (times) => {
    // Exponential backoff with max 30 seconds
    const delay = Math.min(times * 50, 30000);
    return delay;
  },
  
  // Connection timeout in ms
  connectTimeout: 10000,
  
  // Enable auto-reconnect
  autoReconnect: true,
  
  // Key prefixes for different data types
  keyPrefixes: {
    // AcmeCRM data
    acmeContact: 'acme:contact:',
    acmeAuth: 'acme:auth:',
    
    // Integration service data
    integrationContact: 'integration:contact:',
    integrationCache: 'integration:cache:',
    
    // System data
    rateLimit: 'system:rate-limit:',
    metrics: 'system:metrics:'
  },
  
  // Default TTL values in seconds
  ttl: {
    auth: 3600, // 1 hour
    cache: 300, // 5 minutes
    rateLimit: 60 // 1 minute
  }
};

module.exports = redisConfig;
