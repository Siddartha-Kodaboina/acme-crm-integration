# AcmeCRM Integration Flow Documentation

This document provides a comprehensive overview of the data flow in the AcmeCRM integration project, including authentication, CRUD operations, event processing, and rate limiting. Each step is demonstrated with actual API calls and the resulting data changes in the system.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Authentication Flow](#authentication-flow)
3. [Contact Creation Flow](#contact-creation-flow)
4. [Contact Update Flow](#contact-update-flow)
5. [Contact Deletion Flow](#contact-deletion-flow)
6. [Rate Limiting](#rate-limiting)
7. [Conclusion](#conclusion)

## System Architecture

The AcmeCRM integration system consists of the following components:

- **Web API**: RESTful API endpoints for authentication and CRUD operations
- **PostgreSQL**: Primary data storage for contacts and events
- **Redis**: Used for token management and rate limiting
- **Kafka**: Message broker for event-driven architecture

### Database Schema

#### PostgreSQL Tables

1. **internal_contacts**: Stores contacts in our internal format
   - `id`: UUID primary key
   - `first_name`, `last_name`, `email`, etc.: Contact information
   - `source`: Source system (e.g., "acmecrm")
   - `source_id`: ID in the source system
   - `version`: Optimistic concurrency control
   - `created_at`, `updated_at`: Timestamps

2. **acme_contacts**: Stores contacts in AcmeCRM format
   - `id`: AcmeCRM contact ID
   - `data`: JSON object with AcmeCRM fields (prefixed with "acme_")
   - `version`: Optimistic concurrency control
   - `created_at`, `updated_at`: Timestamps

3. **event_processing**: Tracks Kafka events
   - `id`: Event ID
   - `event_type`: Type of event (e.g., "contact.created")
   - `status`: Processing status
   - `details`: Event details
   - `created_at`, `processed_at`: Timestamps

#### Redis Data Structures

1. **auth:token:[token-id]**: Stores JWT token information
   - `userId`: User ID
   - `issuedAt`: Token issue timestamp
   - `expiresAt`: Token expiration timestamp
   - `revoked`: Whether the token has been revoked

2. **rate:limit:[endpoint]:[ip]**: Tracks rate limiting counters

## Authentication Flow

### Step 1: Login and Get Authentication Token

**API Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username": "admin@acmecrm.com", "password": "admin123"}'
```

**API Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Redis Data (Token Storage):**
```
auth:token:fee20040-c63d-402b-a408-84593b6d5341:
  userId: "1"
  issuedAt: 1747708393
  expiresAt: 1747711993
  revoked: "false"
```

**Explanation:**
1. The user sends credentials to the `/api/auth/login` endpoint
2. The system validates the credentials and generates a JWT token
3. The token is stored in Redis with key `auth:token:[token-id]`
4. The token contains user information and expiration details
5. The token is returned to the client for use in subsequent API calls

## Contact Creation Flow

### Step 2: Create First Contact

**API Request:**
```bash
curl -X POST http://localhost:3000/api/contacts -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A" -d '{"firstName": "John", "lastName": "Doe", "email": "john.doe@example.com", "phone": "555-123-4567", "company": "Acme Inc", "title": "Software Engineer", "source": "acmecrm", "sourceId": "contact-1"}'
```

**API Response:**
```json
{
  "data": {
    "status": "active",
    "tags": [],
    "customFields": {},
    "address": {},
    "createdAt": "2025-05-20T02:36:25.761Z",
    "updatedAt": "2025-05-20T02:36:25.761Z",
    "version": 1,
    "id": "c98eaa00-b3ff-4388-82bc-f6216f37645b",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "company": "Acme Inc",
    "title": "Software Engineer",
    "source": "acmecrm",
    "sourceId": "contact-1"
  }
}
```

**PostgreSQL Data (internal_contacts table):**
```
id: c98eaa00-b3ff-4388-82bc-f6216f37645b
first_name: John
last_name: Doe
email: john.doe@example.com
phone: 555-123-4567
company: Acme Inc
title: Software Engineer
address: {}
notes: 
status: active
tags: []
custom_fields: {}
source: acmecrm
source_id: contact-1
created_at: 2025-05-19 19:36:25.761-07
updated_at: 2025-05-19 19:36:25.761-07
version: 1
```

**PostgreSQL Data (acme_contacts table):**
```
id: contact-1
data: {
  "id": "contact-1",
  "acme_tags": [],
  "acme_email": "john.doe@example.com",
  "acme_notes": "",
  "acme_phone": "555-123-4567",
  "acme_title": "Software Engineer",
  "acme_status": "Active",
  "acme_address": "",
  "acme_company": "Acme Inc",
  "acme_version": 1,
  "acme_last_name": "Doe",
  "acme_created_at": "2025-05-20T02:36:25.761Z",
  "acme_first_name": "John",
  "acme_updated_at": "2025-05-20T02:36:25.761Z",
  "acme_custom_fields": {}
}
created_at: 2025-05-19 19:36:25.786-07
updated_at: 2025-05-19 19:36:25.786-07
version: 1
```

**Kafka Event:**
A message is published to the "contacts" Kafka topic with the following data:
```json
{
  "type": "contact.created",
  "data": {
    "contactId": "contact-1"
  }
}
```

**Explanation:**
1. The client sends a POST request to `/api/contacts` with contact data and the JWT token
2. The system validates the token and contact data
3. The contact is stored in two PostgreSQL tables:
   - `internal_contacts`: Our internal representation of the contact
   - `acme_contacts`: The AcmeCRM representation of the contact
4. A Kafka event is published to notify other services about the new contact
5. The created contact is returned to the client

### Step 3: Create Second Contact

**API Request:**
```bash
curl -X POST http://localhost:3000/api/contacts -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A" -d '{"firstName": "Jane", "lastName": "Smith", "email": "jane.smith@example.com", "phone": "555-987-6543", "company": "Tech Corp", "title": "Product Manager", "source": "acmecrm", "sourceId": "contact-2"}'
```

**API Response:**
```json
{
  "data": {
    "status": "active",
    "tags": [],
    "customFields": {},
    "address": {},
    "createdAt": "2025-05-20T02:39:27.198Z",
    "updatedAt": "2025-05-20T02:39:27.198Z",
    "version": 1,
    "id": "6c011278-5757-4332-809a-368e0f0d0857",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "555-987-6543",
    "company": "Tech Corp",
    "title": "Product Manager",
    "source": "acmecrm",
    "sourceId": "contact-2"
  }
}
```

**PostgreSQL Data (internal_contacts table):**
```
id: 6c011278-5757-4332-809a-368e0f0d0857
first_name: Jane
last_name: Smith
email: jane.smith@example.com
phone: 555-987-6543
company: Tech Corp
title: Product Manager
address: {}
notes: 
status: active
tags: []
custom_fields: {}
source: acmecrm
source_id: contact-2
created_at: 2025-05-19 19:39:27.198-07
updated_at: 2025-05-19 19:39:27.198-07
version: 1
```

**PostgreSQL Data (acme_contacts table):**
```
id: contact-2
data: {
  "id": "contact-2",
  "acme_tags": [],
  "acme_email": "jane.smith@example.com",
  "acme_notes": "",
  "acme_phone": "555-987-6543",
  "acme_title": "Product Manager",
  "acme_status": "Active",
  "acme_address": "",
  "acme_company": "Tech Corp",
  "acme_version": 1,
  "acme_last_name": "Smith",
  "acme_created_at": "2025-05-20T02:39:27.198Z",
  "acme_first_name": "Jane",
  "acme_updated_at": "2025-05-20T02:39:27.198Z",
  "acme_custom_fields": {}
}
created_at: 2025-05-19 19:39:27.245-07
updated_at: 2025-05-19 19:39:27.245-07
version: 1
```

**Kafka Event:**
A message is published to the "contacts" Kafka topic with the following data:
```json
{
  "type": "contact.created",
  "data": {
    "contactId": "contact-2"
  }
}
```

### Step 4: Create Third Contact

**API Request:**
```bash
curl -X POST http://localhost:3000/api/contacts -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A" -d '{"firstName": "Michael", "lastName": "Brown", "email": "michael.brown@example.com", "phone": "555-111-2222", "company": "Innovative Tech", "title": "Developer", "source": "acmecrm", "sourceId": "contact-4"}'
```

**API Response:**
```json
{
  "data": {
    "status": "active",
    "tags": [],
    "customFields": {},
    "address": {},
    "createdAt": "2025-05-20T03:07:56.688Z",
    "updatedAt": "2025-05-20T03:07:56.688Z",
    "version": 1,
    "id": "15163dba-5956-4e85-a47e-39fbbecd9b4f",
    "firstName": "Michael",
    "lastName": "Brown",
    "email": "michael.brown@example.com",
    "phone": "555-111-2222",
    "company": "Innovative Tech",
    "title": "Developer",
    "source": "acmecrm",
    "sourceId": "contact-4"
  }
}
```

**PostgreSQL Data (internal_contacts table):**
```
id: 15163dba-5956-4e85-a47e-39fbbecd9b4f
first_name: Michael
last_name: Brown
email: michael.brown@example.com
phone: 555-111-2222
company: Innovative Tech
title: Developer
address: {}
notes: 
status: active
tags: []
custom_fields: {}
source: acmecrm
source_id: contact-4
created_at: 2025-05-19 20:07:56.688-07
updated_at: 2025-05-19 20:07:56.688-07
version: 1
```

**PostgreSQL Data (acme_contacts table):**
```
id: contact-4
data: {
  "id": "contact-4",
  "acme_tags": [],
  "acme_email": "michael.brown@example.com",
  "acme_notes": "",
  "acme_phone": "555-111-2222",
  "acme_title": "Developer",
  "acme_status": "Active",
  "acme_address": "",
  "acme_company": "Innovative Tech",
  "acme_version": 1,
  "acme_last_name": "Brown",
  "acme_created_at": "2025-05-20T03:07:56.688Z",
  "acme_first_name": "Michael",
  "acme_updated_at": "2025-05-20T03:07:56.688Z",
  "acme_custom_fields": {}
}
created_at: 2025-05-19 20:07:56.712-07
updated_at: 2025-05-19 20:07:56.712-07
version: 1
```

**Kafka Event:**
A message is published to the "contacts" Kafka topic with the following data:
```json
{
  "type": "contact.created",
  "data": {
    "contactId": "contact-4"
  }
}
```

## Contact Update Flow

### Step 5: Update Contact

**API Request:**
```bash
curl -X PATCH http://localhost:3000/api/contacts/6c011278-5757-4332-809a-368e0f0d0857 -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A" -d '{"lastName": "Smith-Jones", "title": "Senior Product Manager", "version": 1}'
```

**API Response:**
```json
{
  "data": {
    "id": "6c011278-5757-4332-809a-368e0f0d0857",
    "firstName": "Jane",
    "lastName": "Smith-Jones",
    "email": "jane.smith@example.com",
    "phone": "555-987-6543",
    "company": "Tech Corp",
    "title": "Senior Product Manager",
    "address": {},
    "notes": "",
    "status": "active",
    "tags": [],
    "customFields": {},
    "source": "acmecrm",
    "sourceId": "contact-2",
    "createdAt": "2025-05-20T02:39:27.198Z",
    "updatedAt": "2025-05-20T03:00:08.927Z",
    "version": 2
  }
}
```

**PostgreSQL Data (internal_contacts table) - AFTER UPDATE:**
```
id: 6c011278-5757-4332-809a-368e0f0d0857
first_name: Jane
last_name: Smith-Jones
email: jane.smith@example.com
phone: 555-987-6543
company: Tech Corp
title: Senior Product Manager
address: {}
notes: 
status: active
tags: []
custom_fields: {}
source: acmecrm
source_id: contact-2
created_at: 2025-05-19 19:39:27.198-07
updated_at: 2025-05-19 20:00:08.927-07
version: 2
```

**PostgreSQL Data (acme_contacts table) - AFTER UPDATE:**
```
id: contact-2
data: {
  "id": "contact-2",
  "acme_tags": [],
  "acme_email": "jane.smith@example.com",
  "acme_notes": "",
  "acme_phone": "555-987-6543",
  "acme_title": "Senior Product Manager",
  "acme_status": "Active",
  "acme_address": "",
  "acme_company": "Tech Corp",
  "acme_version": 1,
  "acme_last_name": "Smith-Jones",
  "acme_created_at": "2025-05-20T02:39:27.198Z",
  "acme_first_name": "Jane",
  "acme_updated_at": "2025-05-20T03:00:08.927Z",
  "acme_custom_fields": {}
}
created_at: 2025-05-19 19:39:27.245-07
updated_at: 2025-05-19 20:00:08.947-07
version: 1
```

**Kafka Event:**
A message is published to the "contacts" Kafka topic with the following data:
```json
{
  "type": "contact.updated",
  "data": {
    "contactId": "contact-2",
    "changedFields": ["acme_last_name", "acme_title", "acme_updated_at"]
  }
}
```

**Explanation:**
1. The client sends a PATCH request to `/api/contacts/{id}` with the fields to update
2. The system validates the token and update data
3. The system checks the version number to ensure optimistic concurrency control
4. The contact is updated in both PostgreSQL tables:
   - `internal_contacts`: Fields are updated directly
   - `acme_contacts`: Fields in the JSON data object are updated
5. The version number is incremented in the internal_contacts table
6. The updatedAt timestamp is updated in both tables
7. A Kafka event is published to notify other services about the update
8. The updated contact is returned to the client

## Contact Deletion Flow

### Step 6: Delete Contact

**API Request:**
```bash
curl -X DELETE http://localhost:3000/api/contacts/c98eaa00-b3ff-4388-82bc-f6216f37645b -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A"
```

**API Response:**
```json
{
  "message": "Contact deleted successfully",
  "id": "c98eaa00-b3ff-4388-82bc-f6216f37645b"
}
```

**PostgreSQL Data (internal_contacts table) - AFTER DELETE:**
The contact is removed from the internal_contacts table.

**PostgreSQL Data (acme_contacts table) - AFTER DELETE:**
The contact is removed from the acme_contacts table.

**Kafka Event:**
A message is published to the "contacts" Kafka topic with the following data:
```json
{
  "type": "contact.deleted",
  "data": {
    "contactId": "contact-1"
  }
}
```

**Explanation:**
1. The client sends a DELETE request to `/api/contacts/{id}`
2. The system validates the token
3. The contact is deleted from both PostgreSQL tables:
   - `internal_contacts`: The contact record is removed
   - `acme_contacts`: The contact record is removed
4. A Kafka event is published to notify other services about the deletion
5. A success message is returned to the client

## Rate Limiting

### Step 7: Test Rate Limiting

**API Request:**
```bash
# Send 40 requests in quick succession
for i in {1..40}; do curl -s -o /dev/null -w "Request $i: %{http_code}\n" -X GET http://localhost:3000/api/contacts -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbkBhY21lY3JtLmNvbSIsInJvbGUiOiJhZG1pbiIsImp0aSI6ImZlZTIwMDQwLWM2M2QtNDAyYi1hNDA4LTg0NTkzYjZkNTM0MSIsImlhdCI6MTc0NzcwODM5MywiZXhwIjoxNzQ3NzExOTkzfQ.DUaRSJEULIGrFLdXi8GAlQKgaMUMOtUIjxGROQaIg6A"; done
```

**API Response:**
```
Request 1: 200
Request 2: 200
...
Request 30: 200
Request 31: 429
Request 32: 429
...
Request 40: 429
```

**Redis Data (Rate Limiting):**
Redis stores rate limiting counters with keys like:
```
rate:limit:GET:/api/contacts:127.0.0.1
```

**Explanation:**
1. The client sends multiple GET requests to `/api/contacts` in quick succession
2. The system tracks the request count in Redis
3. For the first 30 requests (within 60 seconds), the system returns a 200 OK response
4. After reaching the limit of 30 requests, the system returns a 429 Too Many Requests response
5. The rate limit is enforced based on the configuration in app.config.js:
   - API rate limit: 30 requests per 60 seconds

## Conclusion

This documentation has demonstrated the complete flow of the AcmeCRM integration project, including:

1. **Authentication**: JWT tokens stored in Redis
2. **Data Storage**: Contacts stored in PostgreSQL in both internal and AcmeCRM formats
3. **Event Processing**: Kafka events published for CRUD operations
4. **Rate Limiting**: Redis-based rate limiting to protect the API

The system follows a clean architecture with clear separation of concerns:
- API controllers handle HTTP requests and responses
- Models handle data validation and business logic
- Services handle external integrations and event processing
- PostgreSQL provides persistent storage
- Redis provides caching and rate limiting
- Kafka provides event-driven communication

This architecture ensures scalability, maintainability, and reliability of the AcmeCRM integration system.
