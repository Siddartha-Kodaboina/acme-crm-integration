# Technical Decisions

This document outlines the key technical decisions made for the Linq Integrations Engineer Take-Home Assessment.

## Technology Stack

### Backend Framework
- **Node.js with Express**: Chosen for its lightweight nature, extensive ecosystem, and suitability for building RESTful APIs.

### Data Storage
- **Redis**: Selected as the primary data store for both mock AcmeCRM data and integration service data. Redis provides:
  - Fast in-memory operations with optional persistence
  - Support for different data structures (strings, hashes, lists)
  - Built-in TTL (time-to-live) functionality for cache management
  - Atomic operations for data consistency
  - Simple setup and minimal configuration
  
  We're using Redis in two ways:
  - As a mock database for simulating AcmeCRM data storage
  - As a caching layer for frequently accessed data with configurable TTL

### Asynchronous Processing
- **Kafka**: Chosen for handling webhook events asynchronously. While more complex than alternatives like Redis queues, Kafka provides robust message streaming capabilities, scalability, and guaranteed message delivery. This demonstrates understanding of enterprise-grade event-driven architectures.

## Architecture Decisions

### Authentication
- **JWT-based Authentication**: Implementing JWT for authentication provides a stateless, secure method for verifying API requests. This matches the requirements for the mock AcmeCRM integration.

### Data Transformation
- **Field Mapping Service**: Created a dedicated service for transforming data between AcmeCRM format and our internal format. This separation of concerns makes the codebase more maintainable and adaptable to changes in either system's data structure.

### Error Handling
- **Comprehensive Error Handling**: Implemented robust error handling with appropriate HTTP status codes, consistent error formats, and detailed logging to facilitate debugging.
- **Rate Limiting with Backoff**: Added rate limiting to prevent API abuse and implemented exponential backoff for retries to handle temporary service disruptions gracefully.

### Caching Strategy
- **Cache-Aside Pattern**: Implemented the cache-aside pattern where the application first checks the cache for data, and if not found, retrieves it from the database and updates the cache.
- **Cache Invalidation**: Cache entries are invalidated when the corresponding data is updated or deleted to ensure data consistency.

## Tradeoffs

### SQLite vs. Full RDBMS
- **Tradeoff**: SQLite is simpler to set up but lacks some features of full database systems like PostgreSQL or MySQL.
- **Justification**: For a take-home assessment, the simplicity of SQLite outweighs the benefits of a more powerful database system. In a production environment, we would likely use a more robust solution.

### Kafka vs. Simpler Queue Systems
- **Tradeoff**: Kafka adds complexity compared to simpler alternatives like Redis-based queues.
- **Justification**: The added complexity is justified by Kafka's robust features for event streaming, which align with the job requirements and demonstrate familiarity with enterprise-grade messaging systems.

### In-Memory Cache vs. Distributed Cache
- **Tradeoff**: A local Redis instance is simpler but doesn't scale as well as a distributed cache.
- **Justification**: For the scope of this assessment, a local Redis instance is sufficient. In a production environment with multiple service instances, we would configure Redis for distributed caching.

## Database Migration: Redis to PostgreSQL

We've decided to migrate from Redis to PostgreSQL for contact storage while keeping Redis for JWT token management and rate limiting. This decision was made for the following reasons:

1. **Data Persistence**: PostgreSQL provides better data persistence and durability compared to Redis
2. **Complex Queries**: PostgreSQL supports complex SQL queries, which are beneficial for filtering and pagination
3. **Relational Data**: PostgreSQL's relational model is better suited for structured contact data
4. **Transaction Support**: PostgreSQL provides ACID transactions for data consistency
5. **Scalability**: PostgreSQL can handle larger datasets with proper indexing and optimization

## Contact Updates and Deletion (Task 2.4)

For contact updates and deletion, we've made the following decisions:

1. **HTTP Methods**: 
   - PUT for full updates (replacing the entire resource)
   - PATCH for partial updates (updating specific fields)
   - DELETE for removing contacts

2. **Optimistic Concurrency Control**: 
   - Using version numbers to prevent conflicts when multiple users update the same contact
   - Returning 409 Conflict when version mismatch occurs

3. **Soft Deletion**: 
   - Implementing soft deletion by marking records as deleted rather than physically removing them
   - This maintains data history and allows for potential recovery
   - Deleted contacts are excluded from normal queries but can be included with a special parameter

4. **Transaction Support**: 
   - Using PostgreSQL transactions to ensure atomic operations
   - This ensures data consistency during complex operations

5. **Validation Strategy**: 
   - Different validation schemas for PUT vs PATCH operations
   - PUT requires all mandatory fields
   - PATCH allows partial updates with validation on provided fields only

6. **Webhook Events**: 
   - Creating specific event types for updates (`contact.updated`) and deletions (`contact.deleted`)
   - Including before/after data in update events for change tracking

## Future Improvements

With more time, the following improvements could be made:

1. Implement comprehensive unit and integration tests
2. Add more sophisticated error recovery mechanisms
3. Enhance documentation with Swagger/OpenAPI specifications
4. Implement monitoring and observability features
5. Add more robust security measures
6. Create a simple frontend for visualizing the integration
