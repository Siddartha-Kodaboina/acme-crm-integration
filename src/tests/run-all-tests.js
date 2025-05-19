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
  'contact-model-postgres.test.js',
  'contact-model-update-delete.test.js',
  'redis-refactor.test.js',
  'auth-with-redis.test.js',
  
  // Integration tests
  'contact-update-delete.test.js',
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
 * Example:
 * Input: 'contact-model-postgres.test.js'
 * Output: {
 *   file: 'contact-model-postgres.test.js',
 *   success: true,
 *   duration: 1234, // ms
 *   output: '...'
 * }
 */
function runTest(testFile) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const testPath = path.join(__dirname, testFile);
    
    logger.info(`Running test: ${testFile}`);
    
    // Check if file exists
    if (!fs.existsSync(testPath)) {
      logger.warn(`Test file not found: ${testPath}`);
      testResults.skipped++;
      testResults.results.push({
        file: testFile,
        success: false,
        skipped: true,
        duration: 0,
        output: 'Test file not found'
      });
      
      resolve({
        file: testFile,
        success: false,
        skipped: true,
        duration: 0,
        output: 'Test file not found'
      });
      
      return;
    }
    
    // Run the test
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
 */
async function runAllTests() {
  logger.info('Starting comprehensive test suite');
  
  const startTime = Date.now();
  
  for (const testFile of testFiles) {
    await runTest(testFile);
    
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
