# Setup Documentation

This document outlines the setup process for the AcmeCRM Integration Service. It will be updated as we implement the infrastructure and authentication components in Story 1.

## Project Overview

The AcmeCRM Integration Service is a Node.js application that demonstrates how to integrate with a fictional CRM system (AcmeCRM). It includes:

- JWT-based authentication
- CRUD operations for contacts
- Webhook processing
- Field mapping between different data formats
- Error handling and rate limiting

## Prerequisites

- Node.js (v14 or higher)
- Redis (for data storage and caching)
- Kafka (for asynchronous event processing)

### Redis Setup

This project uses Redis for data storage and caching. You need to have Redis installed and running:

- **On macOS (using Homebrew):**
  ```bash
  brew install redis
  brew services start redis
  ```

- **Using Docker:**
  ```bash
  docker run --name redis -p 6379:6379 -d redis
  ```

You can verify Redis is running with:
```bash
redis-cli ping
```

The response should be `PONG`.

### Kafka Setup

This project uses Kafka for asynchronous event processing. You need to have Kafka installed and running:

- **Using Docker (recommended):**
  ```bash
  docker run -p 2181:2181 -p 9092:9092 --env ADVERTISED_HOST=localhost --env ADVERTISED_PORT=9092 spotify/kafka
  ```

- **On macOS (using Homebrew):**
  ```bash
  brew install kafka
  brew services start zookeeper
  brew services start kafka
  ```

You can verify Kafka is running by creating a test topic:
```bash
kafka-topics --create --topic test --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
```

## Project Structure

```
lynq-integration/
├── src/
│   ├── server.js                # Main Express server
│   ├── config/                  # Configuration files
│   ├── models/                  # Data models
│   ├── services/                # Business logic services
│   ├── routes/                  # API routes
│   ├── controllers/             # Route controllers
│   ├── middleware/              # Express middleware
│   ├── utils/                   # Utility functions
│   └── consumers/               # Kafka consumers
├── .env.example                 # Example environment variables
├── package.json
├── README.md                    # Main documentation
└── docs/                        # Additional documentation
    ├── Setup.md                 # This file
    ├── CRUD.md                  # CRUD operations documentation
    ├── Async.md                 # Async processing documentation
    └── Tasks.md                 # Task tracking
```

## Installation

### Setting Up the Project

1. Clone the repository:
   ```bash
   git clone https://github.com/Siddartha-Kodaboina/acme-crm-integration.git
   cd acme-crm-integration
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file to configure your environment variables.

## Configuration

### Environment Variables

The following environment variables are used by the application:

```
# Server Configuration
PORT=3000                     # Port the server will listen on
NODE_ENV=development         # Environment (development, production, test)

# Redis Configuration
REDIS_HOST=localhost         # Redis host
REDIS_PORT=6379             # Redis port
REDIS_PASSWORD=             # Redis password (if any)

# JWT Configuration
JWT_SECRET=your-secret-key  # Secret key for JWT signing
JWT_EXPIRATION=3600         # Token expiration time in seconds

# Kafka Configuration (will be used in later tasks)
KAFKA_BROKERS=localhost:9092 # Kafka broker addresses
```

## Running the Service

### Development Mode

To run the service in development mode with auto-reload:

```bash
npm run dev
```

### Production Mode

To run the service in production mode:

```bash
npm start
```

### Health Check

You can verify the service is running by accessing the health check endpoint:

```
GET http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-05-17T15:45:00-07:00",
  "version": "1.0.0",
  "uptime": "10s"
}
```

## Authentication

### JWT Authentication Flow

The application uses JWT (JSON Web Tokens) for authentication. Here's how it works:

1. **Login**:
   ```
   POST /mock-acme/auth/login
   Content-Type: application/json
   
   {
     "username": "user@example.com",
     "password": "password123"
   }
   ```

   Response:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "expiresIn": 3600,
     "user": {
       "id": "123",
       "username": "user@example.com"
     }
   }
   ```

   Curl command:
   ```bash
   curl -X POST http://localhost:3000/mock-acme/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin@acmecrm.com", "password": "admin123"}'
   ```

2. **Using the Token**:
   ```
   GET /protected-endpoint
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   Curl command:
   ```bash
   curl -X GET http://localhost:3000/protected-endpoint \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

3. **Refreshing the Token**:
   ```
   POST /mock-acme/auth/refresh
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   Response:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "expiresIn": 3600
   }
   ```

   Curl command:
   ```bash
   curl -X POST http://localhost:3000/mock-acme/auth/refresh \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

4. **Logout**:
   ```
   POST /mock-acme/auth/logout
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   Curl command:
   ```bash
   curl -X POST http://localhost:3000/mock-acme/auth/logout \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

### Token Storage

Tokens are stored in Redis with the following structure:

- **Key Pattern**: `acme:auth:token:<token_id>`
- **Data Structure**: Redis Hash
- **Fields**:
  - `userId`: ID of the user the token belongs to
  - `issuedAt`: Timestamp when the token was issued
  - `expiresAt`: Timestamp when the token expires
  - `revoked`: Whether the token has been revoked

### Token Validation

Tokens are validated on each request by:
1. Checking the token signature
2. Verifying the token hasn't expired
3. Ensuring the token hasn't been revoked

## Error Handling

Information about error handling strategies will be added here.

## Rate Limiting

Documentation about rate limiting configuration will be added here.

## Redis Data Structure

The application uses Redis for storing different types of data with the following key patterns:

### Key Prefixes

- **AcmeCRM Data**:
  - `acme:contact:<id>` - Contact data in AcmeCRM format
  - `acme:auth:<token>` - Authentication tokens

- **Integration Service Data**:
  - `integration:contact:<id>` - Contact data in normalized internal format
  - `integration:cache:<key>` - Cached data with TTL

- **System Data**:
  - `system:rate-limit:<ip>` - Rate limiting information
  - `system:metrics:<metric>` - System metrics

### Data Types

- **Contacts**: Stored as Redis hashes, allowing for partial updates
- **Cache Items**: Stored as Redis strings (JSON serialized)
- **Auth Tokens**: Stored as Redis strings with TTL

### TTL Configuration

Different data types have different time-to-live (TTL) values:

- **Auth Tokens**: 1 hour (3600 seconds)
- **Cache Items**: 5 minutes (300 seconds)
- **Rate Limiting**: 1 minute (60 seconds)
