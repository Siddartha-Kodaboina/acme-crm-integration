/**
 * Contact Performance Test
 * Compares performance between PostgreSQL and Redis for contact operations
 * 
 * This test:
 * 1. Measures performance of contact operations with PostgreSQL
 * 2. Measures performance of contact operations with Redis
 * 3. Compares the results and provides performance insights
 */

const { v4: uuidv4 } = require('uuid');
const ContactModel = require('../../models/contact.model');
const PostgresService = require('../../services/postgres.service');
const RedisService = require('../../services/redis.service');
const testUtils = require('../utils/test.utils');
const testConfig = require('../config/test.config');
const logger = require('../../utils/logger');

// Number of iterations for each test
const ITERATIONS = 50;

// Test data
const testContacts = Array.from({ length: ITERATIONS }).map(() => ({
  id: `test-perf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  acme_first_name: 'Performance',
  acme_last_name: 'Test',
  acme_email: `perf.test.${Date.now()}@example.com`,
  acme_phone: '555-123-4567',
  acme_company: 'Performance Test Company',
  acme_title: 'Performance Tester',
  acme_status: 'Active'
}));

/**
 * Redis contact operations (legacy)
 * These functions simulate how contacts were stored in Redis before migration
 */
const redisContactOps = {
  /**
   * Store a contact in Redis
   * @param {Object} contact - Contact data
   * @returns {Promise<string>} - Contact ID
   * 
   * Example:
   * Input: {
   *   id: 'test-123',
   *   acme_first_name: 'John',
   *   acme_last_name: 'Doe'
   * }
   * Output: 'test-123'
   */
  async storeContact(contact) {
    const id = contact.id || uuidv4();
    const internalContact = {
      id,
      firstName: contact.acme_first_name,
      lastName: contact.acme_last_name,
      email: contact.acme_email,
      source: 'acmecrm',
      sourceId: contact.id
    };
    
    const key = `test:contact:${id}`;
    await RedisService.hmset(key, internalContact, 86400);
    
    // Also store by source ID for lookup
    const sourceKey = `test:contact:source:acmecrm:${contact.id}`;
    await RedisService.set(sourceKey, id, 86400);
    
    return id;
  },
  
  /**
   * Get a contact from Redis by ID
   * @param {string} id - Contact ID
   * @returns {Promise<Object>} - Contact data
   * 
   * Example:
   * Input: 'test-123'
   * Output: {
   *   id: 'test-123',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   ...
   * }
   */
  async getContactById(id) {
    const key = `test:contact:${id}`;
    return RedisService.hgetall(key);
  },
  
  /**
   * Get a contact from Redis by source ID
   * @param {string} source - Source name
   * @param {string} sourceId - Source ID
   * @returns {Promise<Object>} - Contact data
   * 
   * Example:
   * Input: 'acmecrm', 'acme-123'
   * Output: {
   *   id: 'test-123',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   ...
   * }
   */
  async getContactBySourceId(source, sourceId) {
    const sourceKey = `test:contact:source:${source}:${sourceId}`;
    const id = await RedisService.get(sourceKey);
    
    if (!id) {
      return null;
    }
    
    return this.getContactById(id);
  },
  
  /**
   * Update a contact in Redis
   * @param {string} id - Contact ID
   * @param {Object} data - Contact data to update
   * @returns {Promise<Object>} - Updated contact data
   * 
   * Example:
   * Input: 'test-123', { firstName: 'John Updated' }
   * Output: {
   *   id: 'test-123',
   *   firstName: 'John Updated',
   *   lastName: 'Doe',
   *   ...
   * }
   */
  async updateContact(id, data) {
    const key = `test:contact:${id}`;
    await RedisService.hmset(key, data, 86400);
    return this.getContactById(id);
  },
  
  /**
   * Delete a contact from Redis
   * @param {string} id - Contact ID
   * @returns {Promise<boolean>} - Success indicator
   * 
   * Example:
   * Input: 'test-123'
   * Output: true
   */
  async deleteContact(id) {
    const key = `test:contact:${id}`;
    const contact = await this.getContactById(id);
    
    if (!contact) {
      return false;
    }
    
    // Delete the contact
    await RedisService.del(key);
    
    // Delete the source reference if it exists
    if (contact.source && contact.sourceId) {
      const sourceKey = `test:contact:source:${contact.source}:${contact.sourceId}`;
      await RedisService.del(sourceKey);
    }
    
    return true;
  }
};

/**
 * Run performance tests
 */
async function runPerformanceTests() {
  try {
    logger.info('Starting Contact Performance Tests');
    
    // Set up test environment
    await testUtils.setupTestEnvironment();
    
    // Store the test contacts for later use
    const storedContactIds = {
      postgres: [],
      redis: []
    };
    
    // Test 1: Creation Performance
    logger.info('\nTest 1: Contact Creation Performance');
    
    // PostgreSQL creation performance
    logger.info('Measuring PostgreSQL contact creation performance...');
    process.env.STORAGE_TYPE = 'postgres';
    const postgresCreatePerf = await testUtils.measurePerformance(async () => {
      const contact = testContacts[Math.floor(Math.random() * testContacts.length)];
      const result = await ContactModel.createFromAcmeData({...contact, id: `${contact.id}-pg-${Date.now()}`});
      storedContactIds.postgres.push(result.id);
      return result;
    }, ITERATIONS);
    
    // Redis creation performance
    logger.info('Measuring Redis contact creation performance...');
    const redisCreatePerf = await testUtils.measurePerformance(async () => {
      const contact = testContacts[Math.floor(Math.random() * testContacts.length)];
      const result = await redisContactOps.storeContact({...contact, id: `${contact.id}-redis-${Date.now()}`});
      storedContactIds.redis.push(result);
      return result;
    }, ITERATIONS);
    
    // Compare creation performance
    logger.info('Creation Performance Comparison:');
    logger.info(`PostgreSQL: ${postgresCreatePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Redis: ${redisCreatePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Difference: ${(postgresCreatePerf.averageTime - redisCreatePerf.averageTime).toFixed(2)}ms`);
    logger.info(`PostgreSQL is ${((postgresCreatePerf.averageTime / redisCreatePerf.averageTime) * 100).toFixed(2)}% of Redis speed for creation`);
    
    // Test 2: Retrieval Performance
    logger.info('\nTest 2: Contact Retrieval Performance');
    
    // PostgreSQL retrieval performance
    logger.info('Measuring PostgreSQL contact retrieval performance...');
    process.env.STORAGE_TYPE = 'postgres';
    const postgresRetrievePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.postgres[Math.floor(Math.random() * storedContactIds.postgres.length)];
      return await ContactModel.getContactById(id);
    }, ITERATIONS);
    
    // Redis retrieval performance
    logger.info('Measuring Redis contact retrieval performance...');
    const redisRetrievePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.redis[Math.floor(Math.random() * storedContactIds.redis.length)];
      return await redisContactOps.getContactById(id);
    }, ITERATIONS);
    
    // Compare retrieval performance
    logger.info('Retrieval Performance Comparison:');
    logger.info(`PostgreSQL: ${postgresRetrievePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Redis: ${redisRetrievePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Difference: ${(postgresRetrievePerf.averageTime - redisRetrievePerf.averageTime).toFixed(2)}ms`);
    logger.info(`PostgreSQL is ${((postgresRetrievePerf.averageTime / redisRetrievePerf.averageTime) * 100).toFixed(2)}% of Redis speed for retrieval`);
    
    // Test 3: Update Performance
    logger.info('\nTest 3: Contact Update Performance');
    
    // PostgreSQL update performance
    logger.info('Measuring PostgreSQL contact update performance...');
    process.env.STORAGE_TYPE = 'postgres';
    const postgresUpdatePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.postgres[Math.floor(Math.random() * storedContactIds.postgres.length)];
      return await ContactModel.updateContact(id, {
        firstName: `Updated-${Date.now()}`,
        lastName: `Test-${Date.now()}`
      });
    }, ITERATIONS);
    
    // Redis update performance
    logger.info('Measuring Redis contact update performance...');
    const redisUpdatePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.redis[Math.floor(Math.random() * storedContactIds.redis.length)];
      return await redisContactOps.updateContact(id, {
        firstName: `Updated-${Date.now()}`,
        lastName: `Test-${Date.now()}`
      });
    }, ITERATIONS);
    
    // Compare update performance
    logger.info('Update Performance Comparison:');
    logger.info(`PostgreSQL: ${postgresUpdatePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Redis: ${redisUpdatePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Difference: ${(postgresUpdatePerf.averageTime - redisUpdatePerf.averageTime).toFixed(2)}ms`);
    logger.info(`PostgreSQL is ${((postgresUpdatePerf.averageTime / redisUpdatePerf.averageTime) * 100).toFixed(2)}% of Redis speed for updates`);
    
    // Test 4: Deletion Performance
    logger.info('\nTest 4: Contact Deletion Performance');
    
    // PostgreSQL deletion performance
    logger.info('Measuring PostgreSQL contact deletion performance...');
    process.env.STORAGE_TYPE = 'postgres';
    const postgresDeletePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.postgres.pop();
      if (!id) return false;
      return await ContactModel.deleteContact(id);
    }, Math.min(ITERATIONS, storedContactIds.postgres.length));
    
    // Redis deletion performance
    logger.info('Measuring Redis contact deletion performance...');
    const redisDeletePerf = await testUtils.measurePerformance(async () => {
      const id = storedContactIds.redis.pop();
      if (!id) return false;
      return await redisContactOps.deleteContact(id);
    }, Math.min(ITERATIONS, storedContactIds.redis.length));
    
    // Compare deletion performance
    logger.info('Deletion Performance Comparison:');
    logger.info(`PostgreSQL: ${postgresDeletePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Redis: ${redisDeletePerf.averageTime.toFixed(2)}ms per operation`);
    logger.info(`Difference: ${(postgresDeletePerf.averageTime - redisDeletePerf.averageTime).toFixed(2)}ms`);
    logger.info(`PostgreSQL is ${((postgresDeletePerf.averageTime / redisDeletePerf.averageTime) * 100).toFixed(2)}% of Redis speed for deletions`);
    
    // Overall performance summary
    logger.info('\nOverall Performance Summary:');
    logger.info('Operation\tPostgreSQL\tRedis\t\tRatio (PostgreSQL/Redis)');
    logger.info(`Creation\t${postgresCreatePerf.averageTime.toFixed(2)}ms\t${redisCreatePerf.averageTime.toFixed(2)}ms\t${((postgresCreatePerf.averageTime / redisCreatePerf.averageTime) * 100).toFixed(2)}%`);
    logger.info(`Retrieval\t${postgresRetrievePerf.averageTime.toFixed(2)}ms\t${redisRetrievePerf.averageTime.toFixed(2)}ms\t${((postgresRetrievePerf.averageTime / redisRetrievePerf.averageTime) * 100).toFixed(2)}%`);
    logger.info(`Update\t\t${postgresUpdatePerf.averageTime.toFixed(2)}ms\t${redisUpdatePerf.averageTime.toFixed(2)}ms\t${((postgresUpdatePerf.averageTime / redisUpdatePerf.averageTime) * 100).toFixed(2)}%`);
    logger.info(`Deletion\t${postgresDeletePerf.averageTime.toFixed(2)}ms\t${redisDeletePerf.averageTime.toFixed(2)}ms\t${((postgresDeletePerf.averageTime / redisDeletePerf.averageTime) * 100).toFixed(2)}%`);
    
    // Clean up remaining test data
    logger.info('\nCleaning up test data...');
    await testUtils.clearTestData();
    
    logger.info('\nContact Performance Tests completed successfully');
  } catch (error) {
    logger.error('Error in Contact Performance Tests:', error);
  } finally {
    // Tear down test environment
    await testUtils.teardownTestEnvironment();
  }
}

// Run the performance tests
runPerformanceTests();
