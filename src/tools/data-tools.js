/**
 * @fileoverview Data retrieval tools for BFS MCP server.
 * 
 * This module registers MCP tools that enable retrieval of statistical data from the
 * Swiss Federal Statistical Office (BFS) through two different APIs:
 * - PXWEB API: Traditional API for structured statistical tables
 * - SSE API: Modern SDMX-based API optimized for time-series data
 * 
 * Both tools support multi-language responses, dimension-based filtering, and provide
 * comprehensive error handling with helpful tips for common issues.
 * 
 * @module tools/data-tools
 * @see {@link module:api/pxweb-client} for PXWEB API implementation
 * @see {@link module:api/sse-client} for SSE API implementation
 */

import { z } from 'zod';
import { getData as getPxwebData } from '../api/pxweb-client.js';
import { getSseData } from '../api/sse-client.js';
import { logger } from '../utils/logger.js';

/**
 * Register data retrieval tools with the MCP server.
 * 
 * Registers two tools for retrieving statistical data:
 * 1. get_statistical_data - Uses PXWEB API for traditional statistical tables
 * 2. get_sse_data - Uses SSE API for time-series data with SDMX format
 * 
 * Both tools include comprehensive input validation using Zod schemas and provide
 * detailed error messages with troubleshooting tips.
 * 
 * @param {Object} server - MCP server instance with tool registration capabilities
 * 
 * @example
 * // Register tools during server initialization
 * import { registerDataTools } from './tools/data-tools.js';
 * registerDataTools(server);
 */
export function registerDataTools(server) {
  
  /**
   * MCP Tool: get_statistical_data
   *
   * Retrieves statistical data from a BFS dataset using the PXWEB API.
   * Supports optional filtering by specific dimensions and can return data
   * in multiple formats (json-stat, json, csv).
   *
   * Before using this tool, it is recommended to use `get_dataset_metadata`
   * to discover available dimensions and their possible values for filtering.
   *
   * @async
   * @param {object} params - The parameters for the tool.
   * @param {string} params.numberBfs - BFS number of the dataset.
   * @param {string} params.language - Language for the results.
   * @param {object} [params.query] - Optional dimension filters.
   * @param {string} [params.format] - The response format.
   * @returns {Promise<object>} A promise that resolves to the MCP tool response.
   * @throws {Error} If the API request fails.
   */
  server.tool(
    'get_statistical_data',
    'Retrieve statistical data from a BFS dataset using the PXWEB API. You can optionally filter by specific dimensions. Use get_dataset_metadata first to see available dimensions and values for filtering. Returns data in JSON-stat format by default.',
    {
      numberBfs: z.string().describe('BFS number (FSO number) of the dataset (e.g., "px-x-1502040100_131")'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for results and labels'),
      query: z.record(z.union([z.string(), z.array(z.string())])).optional().describe('Optional dimension filters as key-value pairs. Keys are dimension codes, values are dimension value codes (string or array of strings). Example: {"Jahr": ["40", "41"], "Geschlecht": ["0", "1"]}'),
      format: z.enum(['json-stat', 'json', 'csv']).default('json-stat').describe('Response format (default: json-stat)'),
    },
    async ({ numberBfs, language, query, format }) => {
      try {
        logger.info({ numberBfs, language, hasQuery: !!query, format }, 'Getting statistical data');
        
        const data = await getPxwebData(numberBfs, language, query, format);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message, numberBfs }, 'Error getting statistical data');
        
        let errorMessage = `Error getting statistical data: ${error.message}`;
        
        if (error.message.includes('429')) {
          errorMessage += '\n\nTip: You may be hitting rate limits. Try adding a delay or querying specific dimensions instead of all data.';
        }
        
        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  /**
   * MCP Tool: get_sse_data
   *
   * Retrieves time-series data from the Swiss Stats Explorer (SSE) API.
   * This tool is optimized for time-series data and uses the modern SDMX-based API.
   * It supports filtering by dimensions and time periods.
   *
   * It is recommended to use `get_sse_metadata` first to discover available
   * dimensions and their possible values for filtering.
   *
   * @async
   * @param {object} params - The parameters for the tool.
   * @param {string} params.numberBfs - BFS dataset identifier for SSE.
   * @param {string} params.language - Language for the results.
   * @param {object} [params.query] - Optional dimension filters.
   * @param {string} [params.startPeriod] - Start period for time-series data.
   * @param {string} [params.endPeriod] - End period for time-series data.
   * @returns {Promise<object>} A promise that resolves to the MCP tool response.
   * @throws {Error} If the API request fails.
   */
  server.tool(
    'get_sse_data',
    'Retrieve time-series data from the Swiss Stats Explorer (SSE) API. This is a modern SDMX-based API that works well for time-series data. Use get_sse_metadata first to see available dimensions. You can filter by dimensions and time periods.',
    {
      numberBfs: z.string().describe('BFS dataset identifier for SSE (e.g., "DF_LWZ_1")'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for results and labels'),
      query: z.record(z.union([z.string(), z.array(z.string())])).optional().describe('Optional dimension filters as key-value pairs. Example: {"GR_KT_GDE": ["2581", "4001"], "LEERWOHN_TYP": ["4"]}'),
      startPeriod: z.string().optional().describe('Start period for time-series data (e.g., "2020")'),
      endPeriod: z.string().optional().describe('End period for time-series data (e.g., "2023")'),
    },
    async ({ numberBfs, language, query, startPeriod, endPeriod }) => {
      try {
        logger.info({ numberBfs, language, hasQuery: !!query, startPeriod, endPeriod }, 'Getting SSE data');
        
        const data = await getSseData(numberBfs, language, query, startPeriod, endPeriod);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalObservations: data.length,
                data,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message, numberBfs }, 'Error getting SSE data');
        
        let errorMessage = `Error getting SSE data: ${error.message}`;
        
        if (error.message.includes('No records found')) {
          errorMessage += '\n\nTip: Check your query filters and time period. The dataset may not have data for the specified criteria.';
        }
        
        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
