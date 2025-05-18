/**
 * Health check routes
 * Provides endpoints to check the health of the service
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const packageJson = require('../../package.json');

// Track when the server started
const startTime = Date.now();

/**
 * GET /health
 * Health check endpoint
 * 
 * Example response:
 * {
 *   "status": "ok",
 *   "timestamp": "2025-05-17T15:45:00-07:00",
 *   "version": "1.0.0",
 *   "uptime": "10s"
 * }
 */
router.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    uptime: uptimeFormatted
  });
});

/**
 * GET /health/details
 * Detailed health check with system information
 * 
 * Example response:
 * {
 *   "status": "ok",
 *   "timestamp": "2025-05-17T15:45:00-07:00",
 *   "version": "1.0.0",
 *   "uptime": "10s",
 *   "system": {
 *     "memory": {
 *       "free": "500MB",
 *       "total": "8GB"
 *     },
 *     "cpu": {
 *       "load": "25%"
 *     }
 *   }
 * }
 */
router.get('/details', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  
  // Get system information
  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const cpuLoad = os.loadavg()[0].toFixed(2);
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    uptime: uptimeFormatted,
    system: {
      memory: {
        free: `${freeMem}MB`,
        total: `${totalMem}MB`
      },
      cpu: {
        load: cpuLoad
      }
    }
  });
});

/**
 * Format uptime in a human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  } else {
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }
}

module.exports = router;
