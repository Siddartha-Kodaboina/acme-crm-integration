# Error Handling and Rate Limiting

This document outlines the error handling and rate limiting implementation in the AcmeCRM Integration Service.

## Error Handling

### Error Types

The application uses a standardized error handling system with the following error types:

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| BAD_REQUEST | 400 | Invalid request parameters or body |
| UNAUTHORIZED | 401 | Authentication required or failed |
| FORBIDDEN | 403 | Authenticated but insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| METHOD_NOT_ALLOWED | 405 | HTTP method not allowed for this endpoint |
| CONFLICT | 409 | Resource conflict (e.g., already exists) |
| UNPROCESSABLE_ENTITY | 422 | Request understood but cannot be processed |
| RATE_LIMIT | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Internal server error |
| BAD_GATEWAY | 502 | Error communicating with external service |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |
| GATEWAY_TIMEOUT | 504 | Timeout communicating with external service |

### Error Response Format

All errors are returned in a consistent JSON format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "type": "ERROR_TYPE",
    "code": "SPECIFIC_ERROR_CODE",
    "status": 400,
    "timestamp": "2025-05-18T09:15:30.123Z",
    "requestId": "123e4567-e89b-12d3-a456-426614174000",
    "retryAfter": 30,
    "details": {
      // Additional error details (only in development)
    }
  }
}
```

| Field | Description |
|-------|-------------|
| message | Human-readable error message |
| type | Error type from the list above |
| code | Specific error code for more detailed identification |
| status | HTTP status code |
| timestamp | ISO timestamp when the error occurred |
| requestId | Unique ID for tracking the request across logs |
| retryAfter | Seconds to wait before retrying (for rate limit errors) |
| details | Additional error details (only in development) |

### Error Handling Middleware

The application uses a centralized error handling middleware that:

1. Captures all errors thrown in the application
2. Converts them to a standardized format
3. Logs them appropriately
4. Returns a consistent error response

### Request ID Tracking

Each request is assigned a unique ID that is:

1. Generated on request receipt
2. Included in all error responses
3. Added to all log entries
4. Available for debugging and tracing

## Rate Limiting

### Rate Limit Configuration

The application implements rate limiting with the following default settings:

| Endpoint | Limit | Time Window | Description |
|----------|-------|-------------|-------------|
| Global | 100 | 60 seconds | Default limit for all endpoints |
| /mock-acme/auth/login | 5 | 60 seconds | Login attempts |
| /mock-acme/auth/refresh | 20 | 60 seconds | Token refresh attempts |
| /api/* | 30 | 60 seconds | API endpoints |

### Rate Limit Response Headers

When a request is made, the following headers are included in the response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2025-05-18T09:16:30.123Z
```

When a rate limit is exceeded, a 429 Too Many Requests response is returned with:

```
Retry-After: 30
X-RateLimit-Reset: 2025-05-18T09:16:30.123Z
```

### Exponential Backoff

For repeated rate limit violations, an exponential backoff strategy is applied:

| Violation | Backoff Time | Formula |
|-----------|--------------|---------|
| 1st | 5 seconds | 5 * 2^0 |
| 2nd | 10 seconds | 5 * 2^1 |
| 3rd | 20 seconds | 5 * 2^2 |
| 4th | 40 seconds | 5 * 2^3 |
| ... | ... | ... |
| Maximum | 3600 seconds (1 hour) | |

## Request Timeouts

### Timeout Configuration

The application implements request timeouts with the following default settings:

| Endpoint | Timeout | Description |
|----------|---------|-------------|
| Default | 30000 ms | Default timeout for all endpoints |
| /health | 5000 ms | Health check endpoints |
| /mock-acme/auth/* | 10000 ms | Authentication endpoints |
| /mock-acme/webhooks/* | 60000 ms | Webhook endpoints |

### Timeout Response

When a request times out, a 504 Gateway Timeout response is returned with:

```json
{
  "error": {
    "message": "Request timeout",
    "type": "TIMEOUT_ERROR",
    "code": "REQUEST_TIMEOUT",
    "status": 504,
    "timestamp": "2025-05-18T09:15:30.123Z"
  }
}
```

## Testing Error Handling and Rate Limiting

You can test the error handling and rate limiting implementation using the provided test script:

```bash
node src/tests/error-handling.test.js
```

This will test:
1. Basic error creation and formatting
2. Rate limit error with retry information
3. Exponential backoff calculation
4. Redis rate limiting key generation and storage

## Configuring Error Handling and Rate Limiting

Configuration is done through environment variables or the `app.config.js` file:

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| INCLUDE_ERROR_STACK | Include stack traces in error responses | false |
| RATE_LIMIT_GLOBAL | Global rate limit | 100 |
| RATE_LIMIT_WINDOW_SEC | Global rate limit window in seconds | 60 |
| RATE_LIMIT_LOGIN | Login rate limit | 5 |
| RATE_LIMIT_LOGIN_WINDOW_SEC | Login rate limit window in seconds | 60 |
| RATE_LIMIT_REFRESH | Token refresh rate limit | 20 |
| RATE_LIMIT_REFRESH_WINDOW_SEC | Token refresh rate limit window in seconds | 60 |
| RATE_LIMIT_API | API rate limit | 30 |
| RATE_LIMIT_API_WINDOW_SEC | API rate limit window in seconds | 60 |
| RATE_LIMIT_BACKOFF_BASE | Base backoff time in seconds | 5 |
| RATE_LIMIT_BACKOFF_MAX | Maximum backoff time in seconds | 3600 |
| REQUEST_TIMEOUT_DEFAULT | Default request timeout in milliseconds | 30000 |
| REQUEST_TIMEOUT_HEALTH | Health check timeout in milliseconds | 5000 |
| REQUEST_TIMEOUT_AUTH | Authentication timeout in milliseconds | 10000 |
| REQUEST_TIMEOUT_WEBHOOKS | Webhook timeout in milliseconds | 60000 |
