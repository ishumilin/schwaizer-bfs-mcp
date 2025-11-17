/**
 * @fileoverview Logger utility using Pino for structured logging. Provides a configured Pino logger instance with pretty-printing for development. The logger supports multiple log levels (trace, debug, info, warn, error, fatal) and formats output with timestamps and colorization.
 * @module utils/logger
 */

import pino from 'pino';
import { config } from '../config.js';

/**
 * Configured Pino logger instance for the BFS MCP server
 * 
 * Features:
 * - Configurable log level via environment variable
 * - Pretty-printed output with colorization
 * - Formatted timestamps (yyyy-mm-dd HH:MM:ss.l o)
 * - Excludes pid and hostname from output for cleaner logs
 * 
 * @constant {pino.Logger}
 * @example
 * import { logger } from './utils/logger.js';
 * 
 * logger.info({ numberBfs: 'px-x-1502040100_131' }, 'Fetching dataset');
 * logger.error({ error: err.message }, 'Failed to fetch data');
 * logger.debug({ query: filters }, 'Applying filters');
 */
export const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
      ignore: 'pid,hostname',
    },
  },
});
