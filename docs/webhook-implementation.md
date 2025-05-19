# Webhook Receiver Implementation

## Overview

This document outlines the implementation plan for the webhook receiver component of the AcmeCRM Integration API. The webhook receiver will allow our system to receive and process events from AcmeCRM in real-time.

## Objectives

- Create a secure endpoint for receiving webhook events
- Implement signature verification to ensure webhook authenticity
- Validate webhook payloads for proper structure and content
- Process webhook events asynchronously using Kafka
- Store processed events in PostgreSQL for audit and retry purposes

## Components

### 1. Webhook Routes and Controller

- `POST /api/webhooks`: Main endpoint for receiving webhook events
- Controller to handle webhook requests and responses

### 2. Security Middleware

- HMAC-SHA256 signature verification
- Timestamp validation to prevent replay attacks
- IP address validation (optional)

### 3. Validation Schemas

- Event type validation
- Payload structure validation based on event type
- Required fields validation

### 4. Kafka Producer

- Event publishing to appropriate Kafka topics
- Topic structure based on event types

### 5. PostgreSQL Storage

- Event storage for audit purposes
- Status tracking for event processing

## Webhook Payload Structure

### Headers

```
X-Acme-Signature: HMAC-SHA256 signature of the request body
X-Acme-Timestamp: Timestamp when the webhook was sent
Content-Type: application/json
```

### Body

```json
{
  "event": "contact.created",
  "timestamp": "2025-05-19T00:00:00.000Z",
  "id": "evt_123456789",
  "data": {
    "id": "c8b5f7d9-8e7a-4a1d-9b5c-1d2e3f4a5b6c",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com",
    "phone": "555-987-6543",
    "company": "Acme Inc",
    "title": "Senior Engineer",
    "createdAt": "2025-05-19T00:00:00.000Z",
    "updatedAt": "2025-05-19T00:00:00.000Z"
  }
}
```

## Event Types

- `contact.created`: A new contact was created in AcmeCRM
- `contact.updated`: A contact was updated in AcmeCRM
- `contact.deleted`: A contact was deleted in AcmeCRM

## Processing Flow

1. Webhook request is received at the endpoint
2. Signature is verified using the HMAC-SHA256 algorithm
3. Payload is validated against the appropriate schema
4. Event is acknowledged immediately with a 200 OK response
5. Event is published to the appropriate Kafka topic
6. Kafka consumer processes the event asynchronously
7. Event is stored in PostgreSQL with processing status

## Error Handling

- Invalid signature: 401 Unauthorized
- Invalid payload: 400 Bad Request
- Server error: 500 Internal Server Error
- Successful processing: 200 OK

## Database Schema

### Webhook Events Table

```sql
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error TEXT
);
```

## Implementation Steps

1. Create webhook routes and controller
2. Implement signature verification middleware
3. Develop payload validation schemas
4. Set up Kafka producer for event publishing
5. Create PostgreSQL table for storing webhook events
6. Implement event processing logic
7. Write tests for webhook flow
8. Update documentation

## Testing

- Unit tests for signature verification
- Unit tests for payload validation
- Integration tests for the webhook flow
- Load testing for webhook endpoint
