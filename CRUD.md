# CRUD Operations Documentation

This document details the CRUD (Create, Read, Update, Delete) operations implemented for the AcmeCRM Integration Service. It will be updated as we implement the contact operations and field mapping in Story 2.

## Contact Data Model

### AcmeCRM Format

The AcmeCRM system uses a specific format for contact data with fields prefixed with `acme_`. This format represents how data is stored and retrieved from the AcmeCRM system.

```json
{
  "id": "string",                      // Unique identifier in AcmeCRM
  "acme_first_name": "string",        // First name of the contact
  "acme_last_name": "string",         // Last name of the contact
  "acme_email": "string",             // Primary email address
  "acme_phone": "string",             // Primary phone number
  "acme_company": "string",           // Company name
  "acme_title": "string",             // Job title
  "acme_address": "string",           // Full address as a single string
  "acme_notes": "string",             // Additional notes
  "acme_status": "string",            // Status in AcmeCRM (Active, Inactive, Lead)
  "acme_tags": ["string"],            // Array of tags
  "acme_custom_fields": {              // Custom fields defined in AcmeCRM
    "field_name": "value"
  },
  "acme_created_at": "ISO date string", // Creation timestamp
  "acme_updated_at": "ISO date string", // Last update timestamp
  "acme_version": "number"             // Schema version
}
```

#### Validation Rules for AcmeCRM Format

| Field | Required | Validation Rules |
|-------|----------|------------------|
| id | Yes | Non-empty string |
| acme_first_name | Yes | Non-empty string, max 100 chars |
| acme_last_name | Yes | Non-empty string, max 100 chars |
| acme_email | Yes | Valid email format |
| acme_phone | No | Valid phone format if provided |
| acme_company | No | Max 200 chars if provided |
| acme_title | No | Max 200 chars if provided |
| acme_address | No | Max 500 chars if provided |
| acme_notes | No | Max 2000 chars if provided |
| acme_status | No | One of: "Active", "Inactive", "Lead" |
| acme_tags | No | Array of strings, each max 50 chars |
| acme_custom_fields | No | Object with string keys and values |
| acme_created_at | Yes | Valid ISO 8601 date string |
| acme_updated_at | Yes | Valid ISO 8601 date string |
| acme_version | Yes | Positive integer |

### Internal Format

Our integration service uses a normalized format for contacts. This is the format used within our application for processing and business logic.

```json
{
  "id": "string",                      // Unique identifier in our system
  "firstName": "string",              // First name of the contact
  "lastName": "string",               // Last name of the contact
  "email": "string",                  // Primary email address
  "phone": "string",                  // Primary phone number
  "company": "string",                // Company name
  "title": "string",                  // Job title
  "address": {                        // Structured address
    "street": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string"
  },
  "notes": "string",                  // Additional notes
  "status": "string",                 // Status in our system
  "tags": ["string"],                 // Array of tags
  "customFields": {                   // Custom fields
    "field_name": "value"
  },
  "source": "string",                 // Source system (e.g., "acmecrm")
  "sourceId": "string",               // ID in the source system
  "createdAt": "ISO date string",      // Creation timestamp
  "updatedAt": "ISO date string",      // Last update timestamp
  "version": "number"                 // Schema version
}
```

#### Validation Rules for Internal Format

| Field | Required | Validation Rules |
|-------|----------|------------------|
| id | Yes | Non-empty string |
| firstName | Yes | Non-empty string, max 100 chars |
| lastName | Yes | Non-empty string, max 100 chars |
| email | Yes | Valid email format |
| phone | No | Valid phone format if provided |
| company | No | Max 200 chars if provided |
| title | No | Max 200 chars if provided |
| address | No | Object with street, city, state, zipCode, country fields |
| notes | No | Max 2000 chars if provided |
| status | No | One of: "active", "inactive", "lead" |
| tags | No | Array of strings, each max 50 chars |
| customFields | No | Object with string keys and values |
| source | Yes | Non-empty string |
| sourceId | Yes | Non-empty string |
| createdAt | Yes | Valid ISO 8601 date string |
| updatedAt | Yes | Valid ISO 8601 date string |
| version | Yes | Positive integer |

## Field Mapping

The following table shows how fields are mapped between AcmeCRM format and our internal format:

| AcmeCRM Field | Internal Field | Transformation |
|---------------|----------------|----------------|
| id | sourceId | Direct mapping |
| (generated) | id | Generated UUID |
| acme_first_name | firstName | Direct mapping |
| acme_last_name | lastName | Direct mapping |
| acme_email | email | Direct mapping |
| acme_phone | phone | Format standardization |
| acme_company | company | Direct mapping |
| acme_title | title | Direct mapping |
| acme_address | address | Parse into structured address |
| acme_notes | notes | Direct mapping |
| acme_status | status | Lowercase transformation |
| acme_tags | tags | Direct mapping |
| acme_custom_fields | customFields | Direct mapping |
| acme_created_at | createdAt | Direct mapping |
| acme_updated_at | updatedAt | Direct mapping |
| acme_version | version | Direct mapping |
| (constant) | source | Set to "acmecrm" |

### Schema Versioning

Both schemas include a version field to handle schema evolution:

- **Version 1**: Initial schema as documented above
- **Future versions**: Will be documented here with migration paths

When a schema changes, the system will:
1. Detect the version of incoming data
2. Apply appropriate migrations to bring it to the current version
3. Process the data using the current version handlers

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
