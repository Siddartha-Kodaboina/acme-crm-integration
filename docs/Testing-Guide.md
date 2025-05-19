# Testing Guide for Database Migration

This guide provides instructions for testing the database migration from Redis to PostgreSQL for contact storage, while keeping Redis for JWT token management and rate limiting.

## Test Structure

The test suite is organized into the following categories:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test interactions between components
3. **Performance Tests**: Compare performance between Redis and PostgreSQL
4. **Error Handling Tests**: Verify system resilience

## Running Tests

### Running All Tests

To run all tests in sequence, use the test runner:

```bash
node src/tests/run-all-tests.js
```

This will run all tests and generate a comprehensive test report in `test-report.json`.

### Running Individual Tests

You can also run individual tests directly:

```bash
# Unit Tests
node src/tests/contact-model-postgres.test.js
node src/tests/redis-refactor.test.js
node src/tests/auth-with-redis.test.js

# Integration Tests
node src/tests/system-integration.test.js

# Performance Tests
node src/tests/performance/contact-performance.test.js

# Error Handling Tests
node src/tests/error-handling.test.js
```

## Test Configuration

Test configuration is centralized in `src/tests/config/test.config.js`. This file contains settings for:

- PostgreSQL test settings
- Redis test settings
- Performance test parameters
- Test data generators

You can modify these settings to adjust the test behavior.

## Test Utilities

Common test utilities are available in `src/tests/utils/test.utils.js`. These include:

- Setting up and tearing down test environments
- Clearing test data
- Measuring performance
- Comparing performance between implementations

## Adding New Tests

When adding new tests, follow these guidelines:

1. Place unit tests in the `src/tests` directory
2. Place integration tests in the `src/tests` directory
3. Place performance tests in the `src/tests/performance` directory
4. Use the test utilities for common operations
5. Add the test file to the `testFiles` array in `src/tests/run-all-tests.js`

## Performance Testing

Performance tests compare the speed of operations between PostgreSQL and Redis. Each test:

1. Measures the time taken for operations in both databases
2. Compares the results
3. Provides insights into performance differences

The performance threshold is configurable in `src/tests/config/test.config.js`.

## Error Handling Testing

Error handling tests verify that the system handles errors gracefully. They test:

1. Error creation and formatting
2. Rate limit errors with retry information
3. Exponential backoff calculation
4. Redis rate limiting key generation and storage

## Test Reports

After running all tests, a comprehensive test report is generated in `test-report.json`. This report includes:

- Test summary (total, passed, failed, skipped)
- Success rate
- Detailed results for each test
- Duration of each test

## Troubleshooting

If tests fail, check the following:

1. Database connections: Ensure PostgreSQL and Redis are running
2. Environment variables: Verify `STORAGE_TYPE` is set correctly
3. Test data: Make sure test data is properly cleaned up between tests
4. Dependencies: Ensure all required packages are installed

## Continuous Integration

These tests can be integrated into a CI/CD pipeline. To do so:

1. Add the test runner to your CI configuration
2. Configure the environment variables
3. Set up the databases
4. Run the tests
5. Check the exit code (0 for success, 1 for failure)

## Best Practices

1. Always run tests in isolation
2. Clean up test data after each test
3. Use unique identifiers for test data
4. Keep tests independent of each other
5. Use the test utilities for common operations
6. Update tests when changing the codebase
