/**
 * PostgreSQL Service
 * Provides methods for interacting with PostgreSQL database
 * 
 * This service implements:
 * 1. Connection pool management with error handling
 * 2. Basic query execution with prepared statements
 * 3. Transaction support for data integrity
 * 4. Specialized methods for contact data operations
 */

const { Pool } = require('pg');
const config = require('../config/app.config');
const logger = require('../utils/logger');
const { AppError, errorTypes, errorCodes } = require('../utils/error-handler');

// PostgreSQL connection pool (singleton)
let pool = null;

/**
 * PostgreSQL Service class
 * Provides methods for interacting with PostgreSQL database
 */
class PostgresService {
  /**
   * Initialize PostgreSQL connection pool
   * @returns {Pool} PostgreSQL connection pool
   * 
   * Example usage:
   * const pool = PostgresService.getPool();
   * const result = await pool.query('SELECT NOW()');
   */
  static getPool() {
    if (!pool) {
      pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
        max: config.postgres.max,
        idleTimeoutMillis: config.postgres.idleTimeoutMillis,
      });
      
      // Set up event listeners
      pool.on('connect', (client) => {
        logger.info('Connected to PostgreSQL');
      });
      
      pool.on('error', (err, client) => {
        logger.error('PostgreSQL error', err);
      });
    }
    
    return pool;
  }
  
  /**
   * Close the PostgreSQL connection pool
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await PostgresService.closeConnection();
   */
  static async closeConnection() {
    if (pool) {
      await pool.end();
      pool = null;
      logger.info('PostgreSQL connection pool closed');
    }
  }
  
  /**
   * Initialize database tables
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await PostgresService.initializeTables();
   */
  static async initializeTables() {
    const client = await this.getPool().connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Create AcmeCRM contacts table first
      await client.query(`
        CREATE TABLE IF NOT EXISTS acme_contacts (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          version INTEGER DEFAULT 1
        )
      `);
      
      // Create internal contacts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS internal_contacts (
          id UUID PRIMARY KEY,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          company VARCHAR(200),
          title VARCHAR(200),
          address JSONB,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'active',
          tags JSONB,
          custom_fields JSONB,
          source VARCHAR(50) NOT NULL,
          source_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          version INTEGER DEFAULT 1,
          UNIQUE(source, source_id)
        )
      `);
      
      // Now create all indexes after tables are created
      // Indexes for AcmeCRM contacts
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_acme_contacts_created_at ON acme_contacts(created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_acme_contacts_updated_at ON acme_contacts(updated_at)
      `);
      
      // Indexes for internal contacts
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_internal_contacts_email ON internal_contacts(email)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_internal_contacts_source_source_id 
        ON internal_contacts(source, source_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_internal_contacts_created_at 
        ON internal_contacts(created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_internal_contacts_updated_at 
        ON internal_contacts(updated_at)
      `);
      
      // Create webhook_events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          error TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP WITH TIME ZONE
        )
      `);
      
      // Create indexes for webhook_events table
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
      `);
      
      // Create webhook_deliveries table for the simulator
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) NOT NULL,
          target_url TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          details JSONB,
          retry_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          delivered_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for webhook_deliveries table
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at)
      `);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      logger.info('Database tables initialized successfully');
    } catch (error) {
      // Rollback the transaction in case of error
      await client.query('ROLLBACK');
      logger.error('Error initializing database tables', error);
      throw new AppError('Failed to initialize database tables', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    } finally {
      // Release the client back to the pool
      client.release();
    }
  }
  
  /**
   * Execute a query with parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   * 
   * Example usage:
   * const result = await PostgresService.query(
   *   'SELECT * FROM internal_contacts WHERE email = $1',
   *   ['john.doe@example.com']
   * );
   * 
   * Input:
   * text: 'SELECT * FROM internal_contacts WHERE email = $1'
   * params: ['john.doe@example.com']
   * 
   * Output:
   * {
   *   rows: [{ id: '123e4567-e89b-12d3-a456-426614174000', first_name: 'John', ... }],
   *   rowCount: 1,
   *   ...
   * }
   */
  static async query(text, params = []) {
    const pool = this.getPool();
    
    logger.info('PostgresService: Executing query', { text, params: JSON.stringify(params) });
    
    try {
      const result = await pool.query(text, params);
      logger.info('PostgresService: Query executed successfully', { rowCount: result.rowCount });
      return result;
    } catch (error) {
      logger.error(`PostgresService: Query error: ${text}`, error);
      throw new AppError('Database query failed', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Execute a query within a transaction
   * @param {Function} callback - Function that executes queries
   * @returns {Promise<any>} Result of the callback function
   * 
   * Example usage:
   * const result = await PostgresService.transaction(async (client) => {
   *   const { rows } = await client.query('INSERT INTO internal_contacts(id, ...) VALUES($1, ...) RETURNING id', [id, ...]);
   *   await client.query('INSERT INTO some_other_table(contact_id, ...) VALUES($1, ...)', [rows[0].id, ...]);
   *   return rows[0];
   * });
   * 
   * Input:
   * callback: async function that performs database operations
   * 
   * Output:
   * Whatever the callback function returns
   */
  static async transaction(callback) {
    const client = await this.getPool().connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error', error);
      throw new AppError('Database transaction failed', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    } finally {
      client.release();
    }
  }
  
  /**
   * Store an AcmeCRM contact in PostgreSQL
   * @param {string} id - AcmeCRM contact ID
   * @param {Object} contact - AcmeCRM contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * Example usage:
   * const contact = await PostgresService.storeAcmeContact('123456', {
   *   id: '123456',
   *   acme_first_name: 'John',
   *   acme_last_name: 'Doe',
   *   acme_email: 'john.doe@example.com'
   * });
   * 
   * Input:
   * id: '123456'
   * contact: {
   *   id: '123456',
   *   acme_first_name: 'John',
   *   acme_last_name: 'Doe',
   *   acme_email: 'john.doe@example.com'
   * }
   * 
   * Output:
   * {
   *   id: '123456',
   *   data: {
   *     id: '123456',
   *     acme_first_name: 'John',
   *     acme_last_name: 'Doe',
   *     acme_email: 'john.doe@example.com'
   *   },
   *   created_at: '2025-05-18T22:34:25.696Z',
   *   updated_at: '2025-05-18T22:34:25.696Z',
   *   version: 1
   * }
   */
  static async storeAcmeContact(id, contact) {
    try {
      const query = `
        INSERT INTO acme_contacts(id, data, created_at, updated_at, version)
        VALUES($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET data = $2, updated_at = $4, version = $5
        RETURNING *
      `;
      
      const now = new Date();
      const version = contact.acme_version || 1;
      
      const { rows } = await this.query(query, [
        id,
        contact,
        now,
        now,
        version
      ]);
      
      return rows[0];
    } catch (error) {
      logger.error(`Error storing AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to store AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an AcmeCRM contact from PostgreSQL
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<Object|null>} AcmeCRM contact data or null if not found
   * 
   * Example usage:
   * const contact = await PostgresService.getAcmeContact('123456');
   * 
   * Input:
   * id: '123456'
   * 
   * Output:
   * {
   *   id: '123456',
   *   acme_first_name: 'John',
   *   acme_last_name: 'Doe',
   *   acme_email: 'john.doe@example.com',
   *   ...
   * }
   */
  static async getAcmeContact(id) {
    try {
      const query = 'SELECT data FROM acme_contacts WHERE id = $1';
      const { rows } = await this.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0].data;
    } catch (error) {
      logger.error(`Error retrieving AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to retrieve AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an AcmeCRM contact from PostgreSQL
   * @param {string} id - AcmeCRM contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example usage:
   * const deleted = await PostgresService.deleteAcmeContact('123456');
   * 
   * Input:
   * id: '123456'
   * 
   * Output:
   * true
   */
  static async deleteAcmeContact(id) {
    try {
      const query = 'DELETE FROM acme_contacts WHERE id = $1 RETURNING id';
      const { rowCount } = await this.query(query, [id]);
      
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting AcmeCRM contact with ID ${id}`, error);
      throw new AppError('Failed to delete AcmeCRM contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Store an internal contact in PostgreSQL
   * @param {string} id - Internal contact ID
   * @param {Object} contact - Internal contact data
   * @returns {Promise<Object>} Stored contact
   * 
   * Example usage:
   * const contact = await PostgresService.storeInternalContact('123e4567-e89b-12d3-a456-426614174000', {
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   email: 'john.doe@example.com',
   *   source: 'acmecrm',
   *   sourceId: '123456'
   * });
   * 
   * Input:
   * id: '123e4567-e89b-12d3-a456-426614174000'
   * contact: {
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   email: 'john.doe@example.com',
   *   address: { street: '123 Main St', city: 'San Francisco', ... },
   *   tags: ['customer', 'tech'],
   *   customFields: { industry: 'Technology' },
   *   source: 'acmecrm',
   *   sourceId: '123456'
   * }
   * 
   * Output:
   * {
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   first_name: 'John',
   *   last_name: 'Doe',
   *   email: 'john.doe@example.com',
   *   ...
   * }
   */
  static async storeInternalContact(id, contact) {
    try {
      const query = `
        INSERT INTO internal_contacts(
          id, first_name, last_name, email, phone, company, title,
          address, notes, status, tags, custom_fields,
          source, source_id, created_at, updated_at, version
        )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE
        SET 
          first_name = $2, last_name = $3, email = $4, phone = $5,
          company = $6, title = $7, address = $8, notes = $9,
          status = $10, tags = $11, custom_fields = $12,
          source = $13, source_id = $14, updated_at = $16, version = $17
        RETURNING *
      `;
      
      const now = new Date();
      const version = contact.version || 1;
      
      const { rows } = await this.query(query, [
        id,
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone || '',
        contact.company || '',
        contact.title || '',
        JSON.stringify(contact.address || {}),
        contact.notes || '',
        contact.status || 'active',
        JSON.stringify(contact.tags || []),
        JSON.stringify(contact.customFields || {}),
        contact.source,
        contact.sourceId,
        contact.createdAt || now,
        contact.updatedAt || now,
        version
      ]);
      
      return rows[0];
    } catch (error) {
      logger.error(`Error storing internal contact with ID ${id}`, error);
      throw new AppError('Failed to store internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an internal contact from PostgreSQL
   * @param {string} id - Internal contact ID
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * Example usage:
   * const contact = await PostgresService.getInternalContact('123e4567-e89b-12d3-a456-426614174000');
   * 
   * Input:
   * id: '123e4567-e89b-12d3-a456-426614174000'
   * 
   * Output:
   * {
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   email: 'john.doe@example.com',
   *   ...
   * }
   */
  static async getInternalContact(id) {
    try {
      const query = 'SELECT * FROM internal_contacts WHERE id = $1';
      const { rows } = await this.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      // Convert from snake_case to camelCase
      const row = rows[0];
      return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        title: row.title,
        address: row.address,
        notes: row.notes,
        status: row.status,
        tags: row.tags,
        customFields: row.custom_fields,
        source: row.source,
        sourceId: row.source_id,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        version: row.version
      };
    } catch (error) {
      logger.error(`Error retrieving internal contact with ID ${id}`, error);
      throw new AppError('Failed to retrieve internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Retrieve an internal contact by source and source ID
   * @param {string} source - Source system (e.g., "acmecrm")
   * @param {string} sourceId - ID in the source system
   * @returns {Promise<Object|null>} Internal contact data or null if not found
   * 
   * Example usage:
   * const contact = await PostgresService.getInternalContactBySourceId('acmecrm', '123456');
   * 
   * Input:
   * source: 'acmecrm'
   * sourceId: '123456'
   * 
   * Output:
   * {
   *   id: '123e4567-e89b-12d3-a456-426614174000',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   email: 'john.doe@example.com',
   *   ...
   * }
   */
  static async getInternalContactBySourceId(source, sourceId) {
    try {
      const query = 'SELECT * FROM internal_contacts WHERE source = $1 AND source_id = $2';
      const { rows } = await this.query(query, [source, sourceId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      // Convert from snake_case to camelCase
      const row = rows[0];
      return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        title: row.title,
        address: row.address,
        notes: row.notes,
        status: row.status,
        tags: row.tags,
        customFields: row.custom_fields,
        source: row.source,
        sourceId: row.source_id,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        version: row.version
      };
    } catch (error) {
      logger.error(`Error retrieving internal contact with source ${source} and ID ${sourceId}`, error);
      throw new AppError('Failed to retrieve internal contact by source ID', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Delete an internal contact from PostgreSQL
   * @param {string} id - Internal contact ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   * 
   * Example usage:
   * const deleted = await PostgresService.deleteInternalContact('123e4567-e89b-12d3-a456-426614174000');
   * 
   * Input:
   * id: '123e4567-e89b-12d3-a456-426614174000'
   * 
   * Output:
   * true
   */
  static async deleteInternalContact(id) {
    try {
      const query = 'DELETE FROM internal_contacts WHERE id = $1 RETURNING id';
      const { rowCount } = await this.query(query, [id]);
      
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting internal contact with ID ${id}`, error);
      throw new AppError('Failed to delete internal contact', errorTypes.DATABASE_ERROR, {
        code: errorCodes.DATABASE_ERROR,
        details: error.message
      });
    }
  }
  
  /**
   * Close the PostgreSQL connection pool
   * @returns {Promise<void>}
   * 
   * Example usage:
   * await PostgresService.close();
   */
  static async close() {
    if (pool) {
      await pool.end();
      pool = null;
      logger.info('PostgreSQL connection pool closed');
    }
  }
}

module.exports = PostgresService;
