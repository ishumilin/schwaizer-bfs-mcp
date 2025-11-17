#!/usr/bin/env node

/**
 * @fileoverview Schwaizer BFS MCP Server - Main entry point.
 * Provides Model Context Protocol (MCP) server for accessing Swiss Federal Statistical Office (BFS) data.
 * Supports searching datasets, retrieving statistical data, and accessing metadata through multiple APIs:
 * - PXWEB API for statistical data tables
 * - DAM API for dataset catalog and metadata
 * - SSE API for time-series data (SDMX format)
 * 
 * @module index
 * @see {@link https://www.bfs.admin.ch/bfs/en/home.html|Swiss Federal Statistical Office}
 * @see {@link https://modelcontextprotocol.io|Model Context Protocol}
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerCatalogTools } from './tools/catalog-tools.js';
import { registerDataTools } from './tools/data-tools.js';
import { registerMetadataTools } from './tools/metadata-tools.js';

/**
 * Creates and configures the MCP server instance with all available tools.
 * Adds a helper method to simplify tool registration and registers all tool categories.
 * 
 * @returns {McpServer} Configured MCP server instance with all tools registered
 * 
 * @example
 * const server = createServer();
 * // Server now has catalog, data, and metadata tools registered
 */
function createServer() {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });
  
  // Helper function to make tool registration easier
  server.tool = function(name, description, schema, handler) {
    this.registerTool(name, {
      description,
      inputSchema: schema,
    }, handler);
  };
  
  // Register all tools
  registerCatalogTools(server);
  registerDataTools(server);
  registerMetadataTools(server);
  
  logger.info('All tools registered successfully');
  
  return server;
}

/**
 * Main function to start the MCP server.
 * Initializes the server, creates stdio transport, and establishes connection.
 * Exits with code 1 if server fails to start.
 * 
 * @async
 * @throws {Error} If server initialization or connection fails
 * 
 * @example
 * // Server is started automatically when this module is executed
 * // node src/index.js
 */
async function main() {
  try {
    logger.info('Starting Schwaizer BFS MCP Server...');
    
    const server = createServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    
    logger.info('Server started successfully and connected via stdio');
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
main();
