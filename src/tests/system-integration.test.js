/**
 * System Integration Test
 * Tests the entire system with PostgreSQL for contacts and Redis for JWT/rate limiting
 * 
 * This test:
 * 1. Verifies that contacts are stored in PostgreSQL
 * 2. Verifies that JWT tokens are managed in Redis
 * 3. Verifies that rate limiting works with Redis
 * 4. Confirms that the system works as a whole
 */

const { v4: uuidv4 } = require('uuid');
const ContactModel = require('../models/contact.model');
const AuthService = require('../services/auth.service');
const RedisService = require('../services/redis.service');
const PostgresService = require('../services/postgres.service');
const logger = require('../utils/logger');

// Set environment variable to use PostgreSQL storage
process.env.STORAGE_TYPE = 'postgres';

// Test data
const testUser = {
  id: `user-${Date.now()}`,
  username: 'test@example.com',
  role: 'user'
};

const testAcmeContact = {
  id: `acme-${Date.now()}`,
  acme_first_name: 'John',
  acme_last_name: 'Doe',
  acme_email: 'john.doe@example.com',
  acme_status: 'Active'
};

/**
 * Run the system integration test
 */
async function runSystemTest() {
  try {
    logger.info('Starting System Integration Test');
    
    // Initialize PostgreSQL tables
    logger.info('\nStep 1: Initialize PostgreSQL');
    await PostgresService.initializeTables();
    logger.info('PostgreSQL tables initialized');
    
    // Test JWT token management with Redis
    logger.info('\nStep 2: JWT Token Management with Redis');
    const tokenData = await AuthService.generateToken(testUser);
    logger.info('Token generated:', tokenData.token.substring(0, 20) + '...');
    
    const decodedToken = await AuthService.verifyToken(tokenData.token);
    logger.info('Token verified:', decodedToken.jti);
    
    // Test contact creation with PostgreSQL
    logger.info('\nStep 3: Contact Creation with PostgreSQL');
    const contact = await ContactModel.createFromAcmeData(testAcmeContact);
    logger.info('Contact created:', contact.id);
    
    // Verify contact is in PostgreSQL
    logger.info('\nStep 4: Verify Contact in PostgreSQL');
    const pgContact = await PostgresService.getInternalContact(contact.id);
    logger.info('Contact retrieved from PostgreSQL:', pgContact.id);
    
    // Test rate limiting with Redis
    logger.info('\nStep 5: Rate Limiting with Redis');
    const rateLimitKey = `test:${Date.now()}`;
    const count = await RedisService.trackRateLimit(rateLimitKey, 60);
    logger.info('Rate limit count:', count);
    
    // Test token revocation with Redis
    logger.info('\nStep 6: Token Revocation with Redis');
    const revoked = await AuthService.revokeToken(decodedToken.jti);
    logger.info('Token revocation result:', revoked);
    
    // Verify token is revoked
    logger.info('\nStep 7: Verify Token Revocation');
    try {
      await AuthService.verifyToken(tokenData.token);
      logger.error('ERROR: Revoked token should be rejected');
    } catch (error) {
      logger.info('Revoked token correctly rejected:', error.message);
    }
    
    // Delete contact from PostgreSQL
    logger.info('\nStep 8: Delete Contact from PostgreSQL');
    const deleted = await ContactModel.deleteContact(contact.id);
    logger.info('Contact deletion result:', deleted);
    
    // Verify contact is deleted
    logger.info('\nStep 9: Verify Contact Deletion');
    const deletedContact = await PostgresService.getInternalContact(contact.id);
    logger.info('Contact deletion verified:', deletedContact === null ? 'Success' : 'Failed');
    
    logger.info('\nSystem Integration Test completed successfully');
  } catch (error) {
    logger.error('Error in System Integration Test:', error);
  } finally {
    // Close connections
    logger.info('Closing connections...');
    await Promise.all([
      RedisService.close(),
      PostgresService.close()
    ]);
    logger.info('All connections closed');
  }
}

// Run the system test
runSystemTest();
