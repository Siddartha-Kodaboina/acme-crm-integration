# Database Migration: Redis to PostgreSQL

## Overview

This document outlines the migration of contact data storage from Redis to PostgreSQL while maintaining Redis for JWT token management and rate limiting.

## Motivation

While Redis is excellent for caching and ephemeral data, PostgreSQL offers several advantages for storing contact information:

- **Data Persistence**: Better durability for important business data
- **Relational Capabilities**: Support for complex queries and relationships
- **ACID Compliance**: Transactions for data integrity
- **Schema Enforcement**: Strict typing and constraints

## Migration Phases

### Phase 1: Setup PostgreSQL Infrastructure ✅

- Configure PostgreSQL connection settings ✅
- Design database schema for contacts ✅
- Implement database service with connection pooling ✅
- Create tables and indexes ✅

**Completed**: We've successfully implemented the PostgreSQL infrastructure with proper connection pooling, error handling, and transaction support. The database schema has been designed and implemented with appropriate indexes for performance optimization.

### Phase 2: Adapt Contact Model ✅

- Update contact model to use PostgreSQL instead of Redis ✅
- Maintain the same validation and mapping logic ✅
- Implement storage adapter pattern for database abstraction ✅
- Ensure backward compatibility with existing code ✅

**Completed**: We've successfully adapted the contact model to use PostgreSQL while keeping the validation and mapping logic intact. We've implemented a storage adapter pattern to abstract database operations and make it easier to switch between different storage backends.

### Phase 3: Refine Redis Usage ✅

- Remove contact storage from Redis ✅
- Optimize Redis for JWT token management ✅
- Configure Redis for rate limiting ✅
- Implement graceful degradation for deprecated functions ✅

**Completed**: We've successfully refactored the Redis service to focus exclusively on JWT token management and rate limiting, removing all contact storage functionality. This has optimized Redis for its specialized role, eliminated redundant code, and clarified the responsibilities of each service in the system.

### Phase 4: Verify and Test (In Progress)

- Update test suite to work with PostgreSQL
- Create integration tests for the entire system
- Conduct performance testing and comparison
- Verify error handling and edge cases
- Update documentation and create testing guide

**Current Focus**: We're now conducting comprehensive testing to ensure all components work correctly with the new database architecture. This includes updating existing tests, creating new integration tests, conducting performance benchmarks, and verifying proper error handling throughout the system.

## Database Schema

### AcmeCRM Contacts Table

```sql
CREATE TABLE acme_contacts (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_acme_contacts_created_at ON acme_contacts(created_at);
CREATE INDEX idx_acme_contacts_updated_at ON acme_contacts(updated_at);
```

### Internal Contacts Table

```sql
CREATE TABLE internal_contacts (
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
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_internal_contacts_email ON internal_contacts(email);
CREATE INDEX idx_internal_contacts_source_source_id ON internal_contacts(source, source_id);
CREATE INDEX idx_internal_contacts_created_at ON internal_contacts(created_at);
CREATE INDEX idx_internal_contacts_updated_at ON internal_contacts(updated_at);
```

## Technical Implementation

- Node.js PostgreSQL client: `pg`
- Connection pooling for efficient resource usage
- Repository pattern to abstract database operations
- Prepared statements for security and performance
- JSON/JSONB for flexible schema elements

## Testing Strategy

- Unit tests for database service
- Integration tests for contact model with PostgreSQL
- End-to-end tests for API endpoints
- Performance benchmarks to compare with Redis implementation
