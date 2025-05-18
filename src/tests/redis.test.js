/**
 * Test file for Redis service
 * Run with: node src/tests/redis.test.js
 */

const RedisService = require('../services/redis.service');
const logger = require('../utils/logger');

/**
 * Simple test function to verify Redis service is working
 */
async function testRedisService() {
  try {
    logger.info('Starting Redis service test');
    
    // Test AcmeCRM contact operations
    const acmeContactId = 'test123';
    const acmeContact = {
      acme_first_name: 'John',
      acme_last_name: 'Doe',
      acme_email: 'john.doe@example.com',
      acme_phone: '555-123-4567'
    };
    
    // Store AcmeCRM contact
    logger.info('Storing AcmeCRM contact');
    await RedisService.storeAcmeContact(acmeContactId, acmeContact);
    
    // Retrieve AcmeCRM contact
    logger.info('Retrieving AcmeCRM contact');
    const retrievedAcmeContact = await RedisService.getAcmeContact(acmeContactId);
    logger.info('Retrieved AcmeCRM contact', retrievedAcmeContact);
    
    // Test integration contact operations
    const integrationContactId = 'test123';
    const integrationContact = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      source: 'acmeCRM',
      sourceId: acmeContactId
    };
    
    // Store integration contact
    logger.info('Storing integration contact');
    await RedisService.storeIntegrationContact(integrationContactId, integrationContact);
    
    // Retrieve integration contact
    logger.info('Retrieving integration contact');
    const retrievedIntegrationContact = await RedisService.getIntegrationContact(integrationContactId);
    logger.info('Retrieved integration contact', retrievedIntegrationContact);
    
    // Test caching
    const cacheKey = 'test:cache';
    const cacheData = { test: 'data', timestamp: Date.now() };
    
    // Store cache
    logger.info('Storing cache data');
    await RedisService.cache(cacheKey, cacheData, 60); // 60 seconds TTL
    
    // Retrieve cache
    logger.info('Retrieving cache data');
    const retrievedCache = await RedisService.getCached(cacheKey);
    logger.info('Retrieved cache data', retrievedCache);
    
    // Delete test data
    logger.info('Cleaning up test data');
    await RedisService.deleteAcmeContact(acmeContactId);
    await RedisService.deleteIntegrationContact(integrationContactId);
    await RedisService.invalidateCache(cacheKey);
    
    logger.info('Redis service test completed successfully');
    
    // Close Redis connection
    await RedisService.close();
  } catch (error) {
    logger.error('Redis service test failed', error);
    process.exit(1);
  }
}

// Run the test
testRedisService();
