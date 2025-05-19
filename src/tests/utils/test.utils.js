/**
 * Test Utilities
 * Provides utility functions for tests
 * 
 * This module includes helper functions for setting up and tearing down test environments,
 * generating test data, and measuring performance.
 */

const PostgresService = require('../../services/postgres.service');
const RedisService = require('../../services/redis.service');
const logger = require('../../utils/logger');
const testConfig = require('../config/test.config');

/**
 * Test utilities object
 */
const testUtils = {
  /**
   * Set up the test environment
   * @returns {Promise<void>}
   */
  async setupTestEnvironment() {
    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_TYPE = 'postgres';
    
    // Initialize PostgreSQL tables
    await PostgresService.initializeTables();
    
    logger.info('Test environment set up');
  },
  
  /**
   * Tear down the test environment
   * @returns {Promise<void>}
   */
  async teardownTestEnvironment() {
    // Close database connections
    await Promise.all([
      PostgresService.close(),
      RedisService.close()
    ]);
    
    logger.info('Test environment torn down');
  },
  
  /**
   * Clear test data
   * @returns {Promise<void>}
   */
  async clearTestData() {
    // Clear PostgreSQL test data
    // This is a simplified implementation - in a real application,
    // you would use a more sophisticated approach to clear test data
    try {
      const client = await PostgresService.getClient();
      await client.query('DELETE FROM acme_contacts WHERE id LIKE $1', ['test-%']);
      await client.query('DELETE FROM internal_contacts WHERE source_id LIKE $1', ['test-%']);
    } catch (error) {
      logger.error('Error clearing test data', error);
    }
    
    logger.info('Test data cleared');
  },
  
  /**
   * Measure performance of a function
   * @param {Function} fn - Function to measure
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} Performance metrics
   * 
   * Example:
   * Input: 
   *   fn: async () => await ContactModel.getContactById('123')
   *   iterations: 100
   * Output: {
   *   totalTime: 1234, // ms
   *   averageTime: 12.34, // ms
   *   minTime: 10, // ms
   *   maxTime: 20, // ms
   *   iterations: 100
   * }
   */
  async measurePerformance(fn, iterations = testConfig.performance.iterations) {
    const times = [];
    let totalTime = 0;
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      const timeInMs = Number(end - start) / 1_000_000;
      times.push(timeInMs);
      totalTime += timeInMs;
    }
    
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      totalTime,
      averageTime,
      minTime,
      maxTime,
      iterations
    };
  },
  
  /**
   * Compare performance of two functions
   * @param {Function} fn1 - First function to measure
   * @param {Function} fn2 - Second function to measure
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} Comparison metrics
   * 
   * Example:
   * Input:
   *   fn1: async () => await redisContactModel.getContactById('123')
   *   fn2: async () => await postgresContactModel.getContactById('123')
   *   iterations: 100
   * Output: {
   *   fn1: { totalTime: 1234, averageTime: 12.34, ... },
   *   fn2: { totalTime: 2345, averageTime: 23.45, ... },
   *   difference: { totalTime: 1111, averageTime: 11.11, ... },
   *   percentageDifference: { totalTime: 90.03, averageTime: 90.03, ... }
   * }
   */
  async comparePerformance(fn1, fn2, iterations = testConfig.performance.iterations) {
    const metrics1 = await this.measurePerformance(fn1, iterations);
    const metrics2 = await this.measurePerformance(fn2, iterations);
    
    const difference = {
      totalTime: Math.abs(metrics2.totalTime - metrics1.totalTime),
      averageTime: Math.abs(metrics2.averageTime - metrics1.averageTime),
      minTime: Math.abs(metrics2.minTime - metrics1.minTime),
      maxTime: Math.abs(metrics2.maxTime - metrics1.maxTime)
    };
    
    const percentageDifference = {
      totalTime: (difference.totalTime / metrics1.totalTime) * 100,
      averageTime: (difference.averageTime / metrics1.averageTime) * 100,
      minTime: (difference.minTime / metrics1.minTime) * 100,
      maxTime: (difference.maxTime / metrics1.maxTime) * 100
    };
    
    return {
      fn1: metrics1,
      fn2: metrics2,
      difference,
      percentageDifference
    };
  }
};

module.exports = testUtils;
