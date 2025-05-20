/**
 * Comprehensive Test Runner
 * Runs all tests in sequence to verify the entire system
 * 
 * This script:
 * 1. Runs all unit tests for individual components
 * 2. Runs integration tests for system-wide functionality
 * 3. Runs performance tests to compare with previous implementation
 * 4. Runs error handling tests to verify system resilience
 * 5. Generates a comprehensive test report
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Test files to run in sequence
const testFiles = [
  // Unit tests
  'auth-with-redis.test.js',
  'auth.test.js',
  'postgres.service.test.js',
  'redis-refactor.test.js',
  'contact-model-postgres.test.js',
  'contact-model-update-delete.test.js',
  
  // API tests
  'contact-api.test.js',
  'contact-update-delete.test.js',
  
  // Webhook and Kafka tests
  'webhook-receiver.test.js',
  'webhook-simulator.test.js',
  'kafka.test.js',
  'kafka-consumer.test.js',
  
  // Integration tests
  'integration.test.js',
  'system-integration.test.js',
  
  // Performance tests
  'performance/contact-performance.test.js',
  
  // Error handling tests
  'error-handling.test.js'
];

// Test results
const testResults = {
  total: testFiles.length,
  passed: 0,
  failed: 0,
  skipped: 0,
  results: []
};

/**
 * Run a test file as a child process
 * @param {string} testFile - Path to the test file
 * @returns {Promise<Object>} - Test result
 * 
 */
async function runTest(testFile, timeoutMs = 30000) {
  logger.info(`Running test: ${testFile}`);
  const testPath = path.join(__dirname, testFile);
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    // Set a timeout to prevent tests from hanging indefinitely
    const timeout = setTimeout(() => {
      const errorMsg = `Test ${testFile} timed out after ${timeoutMs}ms`;
      logger.error(errorMsg);
      
      testResults.failed++;
      testResults.results.push({
        file: testFile,
        success: false,
        duration: timeoutMs,
        output: errorMsg
      });
      
      resolve(); // Continue with next test instead of rejecting
    }, timeoutMs);
    
    const testProcess = spawn('node', [testPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    
    testProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    testProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stderr.write(chunk);
    });
    
    testProcess.on('close', (code) => {
      clearTimeout(timeout); // Clear the timeout when the process completes
      
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      if (success) {
        testResults.passed++;
      } else {
        testResults.failed++;
      }
      
      const result = {
        file: testFile,
        success,
        duration,
        output
      };
      
      testResults.results.push(result);
      
      logger.info(`Test ${testFile} ${success ? 'passed' : 'failed'} in ${duration}ms`);
      
      resolve(result);
    });
  });
}

/**
 * Run all tests in sequence
 * Continues with other tests even if one test fails
 */
async function runAllTests() {
  logger.info('Starting comprehensive test suite');
  
  const startTime = Date.now();
  
  for (const testFile of testFiles) {
    try {
      await runTest(testFile);
    } catch (error) {
      logger.error(`Error running test ${testFile}: ${error.message}`);
      testResults.failed++;
      testResults.results.push({
        file: testFile,
        success: false,
        duration: 0,
        output: `Test execution error: ${error.message}`
      });
    }
    
    // Add a small delay between tests to allow resources to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const duration = Date.now() - startTime;
  
  // Generate test report
  const report = {
    timestamp: new Date().toISOString(),
    duration,
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      successRate: `${((testResults.passed / (testResults.total - testResults.skipped)) * 100).toFixed(2)}%`
    },
    results: testResults.results.map(result => ({
      file: result.file,
      success: result.success,
      skipped: !!result.skipped,
      duration: result.duration
    }))
  };
  
  // Log test report
  logger.info('\nTest Report:');
  logger.info(`Total tests: ${report.summary.total}`);
  logger.info(`Passed: ${report.summary.passed}`);
  logger.info(`Failed: ${report.summary.failed}`);
  logger.info(`Skipped: ${report.summary.skipped}`);
  logger.info(`Success rate: ${report.summary.successRate}`);
  logger.info(`Total duration: ${duration}ms`);
  
  // Log detailed results
  logger.info('\nDetailed Results:');
  report.results.forEach(result => {
    logger.info(`${result.file}: ${result.skipped ? 'SKIPPED' : (result.success ? 'PASSED' : 'FAILED')} (${result.duration}ms)`);
  });
  
  // Save report to file
  const reportPath = path.join(__dirname, '..', '..', 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  logger.info(`\nTest report saved to ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run all tests
runAllTests();
