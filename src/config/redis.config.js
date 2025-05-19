/**
 * Redis Configuration
 * Provides configuration for Redis connections
 * 
 * This configuration is optimized for JWT token management and rate limiting.
 * Contact storage has been moved to PostgreSQL.
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
    // Authentication data
    acmeAuth: 'auth:token:',
    
    // Rate limiting data
    rateLimit: 'rate:limit:',
    rateLimitViolations: 'rate:violations:',
    
    // System data
    metrics: 'system:metrics:',
    cache: 'system:cache:',
    
    // Legacy prefixes (deprecated)
    acmeContact: 'legacy:acme:contact:',
    integrationContact: 'legacy:integration:contact:',
    integrationCache: 'legacy:integration:cache:'
  },
  
  // Default TTL values in seconds
  ttl: {
    auth: 3600, // 1 hour for JWT tokens
    cache: 300, // 5 minutes for cached data
    rateLimit: 60, // 1 minute for rate limiting
    rateLimitViolations: 86400 // 24 hours for tracking violations
  },
  
  // Memory optimization settings
  optimization: {
    // Maximum memory usage in MB
    maxmemory: '128mb',
    
    // Eviction policy: volatile-lru (remove least recently used keys with TTL)
    maxmemoryPolicy: 'volatile-lru',
    
    // Only keep N samples when checking keys for eviction
    maxmemorySamples: 5
  }
};

module.exports = redisConfig;
