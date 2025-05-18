/**
 * Authentication Routes
 * Defines routes for authentication
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * POST /mock-acme/auth/login
 * Login a user and get a JWT token
 * 
 * Request body:
 * {
 *   "username": "admin@acmecrm.com",
 *   "password": "admin123"
 * }
 */
router.post('/login', authController.login);

/**
 * POST /mock-acme/auth/refresh
 * Refresh a JWT token
 * 
 * Headers:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
router.post('/refresh', authController.refreshToken);

/**
 * POST /mock-acme/auth/logout
 * Logout a user (revoke token)
 * 
 * Headers:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
router.post('/logout', authenticate, authController.logout);

module.exports = router;
