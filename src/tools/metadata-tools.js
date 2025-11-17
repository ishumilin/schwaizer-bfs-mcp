/**
 * @fileoverview Metadata retrieval tools for BFS MCP server.
 * 
 * This module provides MCP tools for retrieving dataset metadata and structure information
 * from both PXWEB and SSE (Swiss Stats Explorer) APIs. These tools help users understand
 * dataset structure, available dimensions, and possible filter values before querying data.
 * 
 * The module registers three MCP tools:
 * - get_dataset_metadata: Complete PXWEB metadata with all dimensions and values
 * - get_sse_metadata: SSE/SDMX metadata with dimension structure
 * - get_dataset_dimensions: Simplified dimension view for quick reference
 * 
 * @module tools/metadata-tools
 * @see {@link module:api/pxweb-client} for PXWEB metadata retrieval
 * @see {@link module:api/sse-client} for SSE metadata retrieval
 */

import { z } from 'zod';
import { getMetadata as getPxwebMetadata } from '../api/pxweb-client.js';
import { getSseMetadata } from '../api/sse-client.js';
import { logger } from '../utils/logger.js';

/**
 * Registers metadata-related tools with the MCP server.
 * 
 * This function registers three tools that help users explore dataset structure:
 * 1. get_dataset_metadata - Full PXWEB metadata including all dimensions and values
 * 2. get_sse_metadata - SSE/SDMX metadata with dimension codes and values
 * 3. get_dataset_dimensions - Simplified view showing dimension codes and sample values
 * 
 * These tools should be called before querying data to understand what filters
 * and dimensions are available for a specific dataset.
 * 
 * @param {Object} server - MCP server instance with tool registration capability
 * @returns {void}
 * 
 * @example
 * // Register metadata tools during server initialization
 * import { registerMetadataTools } from './tools/metadata-tools.js';
 * 
 * const server = new Server({ name: 'bfs-mcp', version: '1.0.0' });
 * registerMetadataTools(server);
 */
export function registerMetadataTools(server) {
  
  /**
   * MCP Tool: get_dataset_metadata
   *
   * Retrieves complete metadata for a BFS dataset from the PXWEB API.
   * This includes all available dimensions, their codes, and possible values,
   * which is essential for constructing valid data queries.
   *
   * @async
   * @param {object} params - The parameters for the tool.
   * @param {string} params.numberBfs - BFS number of the dataset.
   * @param {string} params.language - Language for the metadata.
   * @returns {Promise<object>} A promise that resolves to the MCP tool response.
   * @throws {Error} If the API request fails.
   */
  server.tool(
    'get_dataset_metadata',
    'Get complete metadata structure for a BFS dataset from the PXWEB API. Returns information about all available dimensions, their codes, and possible values. Use this before querying data to understand what filters you can apply.',
    {
      numberBfs: z.string().describe('BFS number (FSO number) of the dataset (e.g., "px-x-1502040100_131")'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for dimension and value labels'),
    },
    async ({ numberBfs, language }) => {
      try {
        logger.info({ numberBfs, language }, 'Getting dataset metadata');
        
        const metadata = await getPxwebMetadata(numberBfs, language);
        
        // Format metadata for better readability
        const formattedMetadata = {
          title: metadata.title || 'Untitled',
          updated: metadata.updated || 'N/A',
          source: metadata.source || 'BFS',
          note: metadata.note || null,
          variables: metadata.variables?.map(variable => ({
            code: variable.code,
            text: variable.text,
            valueCount: variable.values?.length || 0,
            values: variable.values || [],
            valueTexts: variable.valueTexts || [],
            time: variable.time || false,
            elimination: variable.elimination || false,
          })) || [],
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedMetadata, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message, numberBfs }, 'Error getting dataset metadata');
        return {
          content: [
            {
              type: 'text',
              text: `Error getting dataset metadata: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  /**
   * MCP Tool: get_sse_metadata
   *
   * Retrieves metadata for a Swiss Stats Explorer (SSE) dataset.
   * This tool provides information on available dimensions and their possible values,
   * which is essential for constructing valid data queries with `get_sse_data`.
   *
   * @async
   * @param {object} params - The parameters for the tool.
   * @param {string} params.numberBfs - BFS dataset identifier for SSE.
   * @param {string} params.language - Language for the metadata.
   * @returns {Promise<object>} A promise that resolves to the MCP tool response.
   * @throws {Error} If the API request fails.
   */
  server.tool(
    'get_sse_metadata',
    'Get metadata for a Swiss Stats Explorer (SSE) dataset. Returns available dimensions and their possible values. Use this before calling get_sse_data to understand what filters you can apply.',
    {
      numberBfs: z.string().describe('BFS dataset identifier for SSE (e.g., "DF_LWZ_1")'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for dimension and value labels'),
    },
    async ({ numberBfs, language }) => {
      try {
        logger.info({ numberBfs, language }, 'Getting SSE metadata');
        
        const metadata = await getSseMetadata(numberBfs, language);
        
        // Group by dimension code for better readability
        const dimensionMap = {};
        
        for (const item of metadata) {
          if (!dimensionMap[item.code]) {
            dimensionMap[item.code] = {
              code: item.code,
              text: item.text,
              values: [],
            };
          }
          
          dimensionMap[item.code].values.push({
            value: item.value,
            valueText: item.valueText,
          });
        }
        
        const dimensions = Object.values(dimensionMap);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalDimensions: dimensions.length,
                dimensions,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message, numberBfs }, 'Error getting SSE metadata');
        return {
          content: [
            {
              type: 'text',
              text: `Error getting SSE metadata: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  /**
   * MCP Tool: get_dataset_dimensions
   *
   * Provides a simplified view of a PXWEB dataset's dimensions.
   * This tool is useful for quickly understanding the structure of a dataset
   * and identifying available filters without retrieving the full metadata.
   *
   * @async
   * @param {object} params - The parameters for the tool.
   * @param {string} params.numberBfs - BFS number of the dataset.
   * @param {string} params.language - Language for the dimension labels.
   * @returns {Promise<object>} A promise that resolves to the MCP tool response.
   * @throws {Error} If the API request fails.
   */
  server.tool(
    'get_dataset_dimensions',
    'Get a simplified view of available dimensions and their values for a PXWEB dataset. This is useful for quickly understanding what filters you can apply when querying data. Returns dimension codes and all possible values.',
    {
      numberBfs: z.string().describe('BFS number (FSO number) of the dataset'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for dimension labels'),
    },
    async ({ numberBfs, language }) => {
      try {
        logger.info({ numberBfs, language }, 'Getting dataset dimensions');
        
        const metadata = await getPxwebMetadata(numberBfs, language);
        
        const dimensions = metadata.variables?.map(variable => ({
          code: variable.code,
          name: variable.text,
          isTime: variable.time || false,
          valueCount: variable.values?.length || 0,
          sampleValues: variable.values?.slice(0, 5) || [],
          sampleValueTexts: variable.valueTexts?.slice(0, 5) || [],
          note: variable.values?.length > 5 ? `... and ${variable.values.length - 5} more values` : null,
        })) || [];
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                datasetTitle: metadata.title,
                totalDimensions: dimensions.length,
                dimensions,
                tip: 'Use the "code" field as keys in your query object, and "sampleValues" as possible filter values',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message, numberBfs }, 'Error getting dataset dimensions');
        return {
          content: [
            {
              type: 'text',
              text: `Error getting dataset dimensions: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
