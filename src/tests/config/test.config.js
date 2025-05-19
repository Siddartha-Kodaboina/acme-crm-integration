/**
 * Test Configuration
 * Provides configuration for tests
 * 
 * This module centralizes test settings to ensure consistency across all tests.
 * It includes settings for both PostgreSQL and Redis test environments.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Test configuration object
 */
const testConfig = {
  // Test environment
  env: process.env.NODE_ENV || 'test',
  
  // PostgreSQL test settings
  postgres: {
    // Use a test-specific schema to isolate test data
    schema: `test_${Date.now()}`,
    
    // Test data generators
    generateAcmeContact: () => ({
      id: `test-acme-${Date.now()}`,
      acme_first_name: 'Test',
      acme_last_name: 'User',
      acme_email: `test.${Date.now()}@example.com`,
      acme_phone: '555-123-4567',
      acme_company: 'Test Company',
      acme_title: 'Test Title',
      acme_status: 'Active',
      acme_notes: 'Test notes',
      acme_tags: ['test', 'verification']
    }),
    
    generateInternalContact: () => ({
      id: uuidv4(),
      firstName: 'Test',
      lastName: 'User',
      email: `test.${Date.now()}@example.com`,
      phone: '555-123-4567',
      company: 'Test Company',
      title: 'Test Title',
      status: 'active',
      notes: 'Test notes',
      tags: ['test', 'verification'],
      source: 'acmecrm',
      sourceId: `test-source-${Date.now()}`
    })
  },
  
  // Redis test settings
  redis: {
    // Use test-specific key prefixes to isolate test data
    keyPrefix: `test:${Date.now()}:`,
    
    // Test data generators
    generateToken: (userId = 'test-user') => ({
      userId,
      issuedAt: Math.floor(Date.now() / 1000).toString(),
      expiresAt: (Math.floor(Date.now() / 1000) + 3600).toString(),
      revoked: 'false'
    }),
    
    generateUser: () => ({
      id: `user-${Date.now()}`,
      username: `test.${Date.now()}@example.com`,
      role: 'user'
    })
  },
  
  // Performance test settings
  performance: {
    // Number of operations to perform for each test
    iterations: 100,
    
    // Timeout for performance tests in milliseconds
    timeout: 30000,
    
    // Threshold for acceptable performance degradation (%)
    threshold: 20
  }
};

module.exports = testConfig;
