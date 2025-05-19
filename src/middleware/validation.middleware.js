/**
 * Validation Middleware
 * Provides middleware for validating request data
 * 
 * This module:
 * 1. Validates request bodies against schemas
 * 2. Validates query parameters against schemas
 * 3. Handles validation errors and returns appropriate responses
 */

const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');

/**
 * Validation middleware functions
 */
const validationMiddleware = {
  /**
   * Validate request body against a schema
   * @param {Object} schema - Joi schema to validate against
   * @returns {Function} Express middleware function
   * 
   * Example usage:
   * router.post('/contacts', validateBody(contactSchemas.createContactSchema), contactController.createContact);
   * 
   * Example request body:
   * {
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john.doe@example.com"
   * }
   * 
   * If validation fails, returns error response:
   * {
   *   "error": {
   *     "message": "Validation error",
   *     "type": "VALIDATION_ERROR",
   *     "status": 400,
   *     "code": "INVALID_INPUT",
   *     "details": [
   *       {
   *         "message": "\"email\" must be a valid email",
   *         "path": ["email"],
   *         "type": "string.email"
   *       }
   *     ]
   *   }
   * }
   */
  validateBody: (schema) => {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const validationError = new AppError('Validation error', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
        
        return res.status(validationError.status).json(validationError.toResponse());
      }
      
      // Replace req.body with validated value
      req.body = value;
      next();
    };
  },
  
  /**
   * Validate request query parameters against a schema
   * @param {Object} schema - Joi schema to validate against
   * @returns {Function} Express middleware function
   * 
   * Example usage:
   * router.get('/contacts', validateQuery(contactSchemas.paginationSchema), contactController.getContacts);
   * 
   * Example query parameters:
   * ?page=2&limit=20&sort=lastName&order=asc
   * 
   * If validation fails, returns error response:
   * {
   *   "error": {
   *     "message": "Validation error",
   *     "type": "VALIDATION_ERROR",
   *     "status": 400,
   *     "code": "INVALID_INPUT",
   *     "details": [
   *       {
   *         "message": "\"page\" must be a positive number",
   *         "path": ["page"],
   *         "type": "number.positive"
   *       }
   *     ]
   *   }
   * }
   */
  validateQuery: (schema) => {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const validationError = new AppError('Validation error', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
        
        return res.status(validationError.status).json(validationError.toResponse());
      }
      
      // Replace req.query with validated value
      req.query = value;
      next();
    };
  },
  
  /**
   * Validate request parameters against a schema
   * @param {Object} schema - Joi schema to validate against
   * @returns {Function} Express middleware function
   * 
   * Example usage:
   * router.get('/contacts/:id', validateParams(contactSchemas.idSchema), contactController.getContactById);
   * 
   * Example parameters:
   * /contacts/123e4567-e89b-12d3-a456-426614174000
   * 
   * If validation fails, returns error response:
   * {
   *   "error": {
   *     "message": "Validation error",
   *     "type": "VALIDATION_ERROR",
   *     "status": 400,
   *     "code": "INVALID_INPUT",
   *     "details": [
   *       {
   *         "message": "\"id\" must be a valid UUID",
   *         "path": ["id"],
   *         "type": "string.guid"
   *       }
   *     ]
   *   }
   * }
   */
  validateParams: (schema) => {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const validationError = new AppError('Validation error', errorTypes.VALIDATION_ERROR, {
          code: errorCodes.INVALID_INPUT,
          details: error.details
        });
        
        return res.status(validationError.status).json(validationError.toResponse());
      }
      
      // Replace req.params with validated value
      req.params = value;
      next();
    };
  }
};

module.exports = validationMiddleware;
