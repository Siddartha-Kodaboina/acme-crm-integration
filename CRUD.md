# CRUD Operations Documentation

This document details the CRUD (Create, Read, Update, Delete) operations implemented for the AcmeCRM Integration Service. It will be updated as we implement the contact operations and field mapping in Story 2.

## Contact Data Model

### AcmeCRM Format

The AcmeCRM system uses a specific format for contact data with fields prefixed with `acme_`.

```json
{
  "id": "string",
  "acme_first_name": "string",
  "acme_last_name": "string",
  "acme_email": "string",
  "acme_phone": "string",
  "acme_company": "string",
  "acme_title": "string",
  "acme_created_at": "ISO date string",
  "acme_updated_at": "ISO date string"
}
```

### Internal Format

Our integration service uses a normalized format for contacts:

```json
{
  "id": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "company": "string",
  "title": "string",
  "source": "string",
  "sourceId": "string",
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

## Field Mapping

Details about how fields are mapped between formats will be documented here.

## API Endpoints

### Create Contact

Details about the contact creation endpoint will be added here.

### Retrieve Contact(s)

Details about the contact retrieval endpoints will be added here.

### Update Contact

Details about the contact update endpoint will be added here.

### Delete Contact

Details about the contact deletion endpoint will be added here.

## Data Storage

### Redis Implementation

Contacts are stored in Redis using the following structure:

#### AcmeCRM Contacts

- **Key Pattern**: `acme:contact:<id>`
- **Data Structure**: Redis Hash
- **Fields**: Directly map to the AcmeCRM format (acme_first_name, acme_last_name, etc.)

#### Integration Contacts

- **Key Pattern**: `integration:contact:<id>`
- **Data Structure**: Redis Hash
- **Fields**: Directly map to the internal format (firstName, lastName, etc.)

### Benefits of Using Redis Hashes

- **Partial Updates**: Can update individual fields without retrieving and storing the entire object
- **Field-Level Access**: Can retrieve specific fields when needed
- **Atomic Operations**: Redis provides atomic operations for hash manipulation

## Caching Strategy

Frequently accessed data is cached using Redis with TTL (Time-To-Live):

- **Key Pattern**: `integration:cache:<key>`
- **Data Structure**: Redis String (JSON serialized)
- **Default TTL**: 5 minutes (300 seconds)

The cache follows the cache-aside pattern:
1. Check cache for requested data
2. If found, return cached data
3. If not found, retrieve from primary storage
4. Store retrieved data in cache with TTL
5. Return data to client

## Error Handling

Specific error handling for CRUD operations will be detailed here.

## Examples

Example requests and responses will be added here.
