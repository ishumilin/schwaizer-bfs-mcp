/**
 * @fileoverview Configuration loader for BFS MCP Server.
 * Loads and validates environment variables for API endpoints, rate limiting, caching, and logging.
 * Uses dotenv to load configuration from .env file.
 * 
 * @module config
 * @see {@link https://www.bfs.admin.ch/bfs/en/home.html|Swiss Federal Statistical Office}
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Server configuration object containing all environment-based settings.
 * 
 * @constant {Object} config
 * @property {string} pxwebBaseUrl - Base URL for PXWEB API (default: https://www.pxweb.bfs.admin.ch/api/v1)
 * @property {string} damBaseUrl - Base URL for DAM (Data Asset Management) API (default: https://dam-api.bfs.admin.ch/hub/api)
 * @property {string} sseBaseUrl - Base URL for SSE (Swiss Stats Explorer) API (default: https://disseminate.stats.swiss/rest)
 * @property {number} requestDelay - Delay between requests in seconds (default: 0)
 * @property {number} maxRetries - Maximum number of retry attempts for failed requests (default: 3)
 * @property {number} cacheTTL - Cache time-to-live in seconds (default: 3600)
 * @property {string} logLevel - Logging level (default: 'info')
 * @property {string} serverName - MCP server name identifier
 * @property {string} serverVersion - Current server version
 * 
 * @example
 * // Access configuration values
 * import { config } from './config.js';
 * 
 * console.log(config.pxwebBaseUrl); // 'https://www.pxweb.bfs.admin.ch/api/v1'
 * console.log(config.maxRetries);   // 3
 */
export const config = {
  // API Base URLs
  pxwebBaseUrl: process.env.BFS_PXWEB_BASE_URL || 'https://www.pxweb.bfs.admin.ch/api/v1',
  damBaseUrl: process.env.BFS_DAM_BASE_URL || 'https://dam-api.bfs.admin.ch/hub/api',
  sseBaseUrl: process.env.BFS_SSE_BASE_URL || 'https://disseminate.stats.swiss/rest',
  
  // Rate limiting
  requestDelay: parseInt(process.env.BFS_REQUEST_DELAY || '0', 10),
  maxRetries: parseInt(process.env.BFS_MAX_RETRIES || '3', 10),
  
  // Caching
  cacheTTL: parseInt(process.env.BFS_CACHE_TTL || '3600', 10),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Server info
  serverName: 'schwaizer-bfs-mcp',
  serverVersion: '1.0.0',
};
