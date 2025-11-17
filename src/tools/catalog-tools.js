/**
 * @fileoverview Catalog tools for BFS MCP server.
 * 
 * This module provides MCP tools for searching and browsing the Swiss Federal
 * Statistical Office (BFS) data catalog. It enables discovery of statistical
 * datasets through keyword search, theme filtering, and metadata retrieval.
 * 
 * The catalog tools interact with the BFS DAM (Data Asset Management) API to:
 * - Search for datasets by keywords, themes, and spatial divisions
 * - List all available statistical themes/categories
 * - Retrieve detailed metadata for specific datasets
 * 
 * @module tools/catalog-tools
 * @see {@link https://www.bfs.admin.ch/bfs/en/home.html|Swiss Federal Statistical Office}
 * @see {@link https://dam-api.bfs.admin.ch/hub/api/dam/assets|BFS DAM API}
 */

import { z } from 'zod';
import { searchCatalog, getAssetMetadata, getThemes } from '../api/dam-client.js';
import { logger } from '../utils/logger.js';

/**
 * Registers catalog-related tools with the MCP server.
 * 
 * This function registers three MCP tools:
 * 1. search_datasets - Search the BFS catalog by keywords and filters
 * 2. list_themes - List all available statistical themes
 * 3. get_dataset_info - Get detailed metadata for a specific dataset
 * 
 * Each tool is registered with Zod schemas for input validation and
 * comprehensive error handling.
 * 
 * @param {Object} server - MCP server instance with tool registration methods
 * @returns {void}
 * 
 * @example
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { registerCatalogTools } from './tools/catalog-tools.js';
 * 
 * const server = new Server({ name: 'bfs-mcp', version: '1.0.0' });
 * registerCatalogTools(server);
 */
export function registerCatalogTools(server) {
  
  /**
   * MCP Tool: search_datasets
   * 
   * Searches for statistical datasets in the BFS catalog using various filters.
   * Supports keyword search, theme filtering, spatial division filtering, and
   * publication year ranges. Returns a list of matching datasets with their
   * BFS numbers and basic metadata.
   * 
   * @async
   * @param {Object} params - Search parameters
   * @param {string} params.language - Language for results (de, fr, it, en)
   * @param {string} [params.query] - Search term for titles and descriptions
   * @param {number} [params.theme] - Theme prodima number (use list_themes)
   * @param {string} [params.spatialDivision] - Spatial division level
   * @param {string} [params.publishingYearStart] - Start year (e.g., "2020")
   * @param {string} [params.publishingYearEnd] - End year (e.g., "2023")
   * @param {number} [params.limit=50] - Maximum results (1-1000)
   * @returns {Promise<Object>} MCP tool response with dataset list
   * @throws {Error} If search fails or API is unavailable
   * 
   * @example
   * // Search for population datasets
   * {
   *   language: 'en',
   *   query: 'population',
   *   limit: 10
   * }
   * 
   * @example
   * // Search by theme and spatial division
   * {
   *   language: 'de',
   *   theme: 1,
   *   spatialDivision: 'Cantons',
   *   publishingYearStart: '2020'
   * }
   */
  server.tool(
    'search_datasets',
    'Search for statistical datasets in the Swiss Federal Statistical Office (BFS) catalog. Search by keywords, themes, spatial divisions, and other criteria. Returns a list of matching datasets with their BFS numbers and metadata.',
    {
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for results (de=German, fr=French, it=Italian, en=English)'),
      query: z.string().optional().describe('Search term to find in titles and descriptions'),
      theme: z.number().optional().describe('Filter by theme (prodima number). Use list_themes to see available themes.'),
      spatialDivision: z.enum(['Switzerland', 'Cantons', 'Districts', 'Communes', 'Other spatial divisions', 'International']).optional().describe('Filter by spatial division level'),
      publishingYearStart: z.string().optional().describe('Filter by publishing year start (e.g., "2020")'),
      publishingYearEnd: z.string().optional().describe('Filter by publishing year end (e.g., "2023")'),
      limit: z.number().min(1).max(1000).default(50).describe('Maximum number of results to return (default: 50, max: 1000)'),
    },
    async ({ language, query, theme, spatialDivision, publishingYearStart, publishingYearEnd, limit }) => {
      try {
        logger.info({ language, query, theme }, 'Searching BFS catalog');
        
        const results = await searchCatalog({
          language,
          extendedSearch: query,
          prodima: theme,
          spatialDivision,
          publishingYearStart,
          publishingYearEnd,
          limit,
        });
        
        // Format results for better readability
        const datasets = results.data?.map(item => ({
          title: item.description?.titles?.main || 'Untitled',
          numberBfs: item.shop?.orderNr || 'N/A',
          numberAsset: item.ids?.damId || 'N/A',
          publicationDate: item.bfs?.embargo || 'N/A',
          language: item.description?.language || language,
        })) || [];
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalResults: datasets.length,
                datasets,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message }, 'Error searching catalog');
        return {
          content: [
            {
              type: 'text',
              text: `Error searching catalog: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  /**
   * MCP Tool: list_themes
   * 
   * Lists all available statistical themes (categories) in the BFS catalog.
   * Themes are used to organize datasets by subject area (e.g., Population,
   * Economy, Health). Each theme has a prodima number that can be used with
   * search_datasets to filter results.
   * 
   * @async
   * @param {Object} params - List parameters
   * @param {string} params.language - Language for theme names (de, fr, it, en)
   * @returns {Promise<Object>} MCP tool response with theme list
   * @throws {Error} If theme retrieval fails
   * 
   * @example
   * // List all themes in English
   * {
   *   language: 'en'
   * }
   * 
   * @example
   * // List themes in German
   * {
   *   language: 'de'
   * }
   */
  server.tool(
    'list_themes',
    'List all available statistical themes (categories) in the BFS catalog. Each theme has a name, prodima number (for filtering), and theme code. Use the prodima number with search_datasets to filter by theme.',
    {
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for theme names'),
    },
    async ({ language }) => {
      try {
        logger.info({ language }, 'Listing BFS themes');
        
        const themes = getThemes();
        
        // Note: Theme names are currently in English only
        // In a production version, you might want to fetch localized names
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalThemes: themes.length,
                themes,
                note: 'Use the prodima number with search_datasets to filter by theme',
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message }, 'Error listing themes');
        return {
          content: [
            {
              type: 'text',
              text: `Error listing themes: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
  
  /**
   * MCP Tool: get_dataset_info
   * 
   * Retrieves detailed metadata for a specific BFS dataset using its BFS number
   * or asset number. Returns comprehensive information including title, description,
   * publication date, themes, spatial divisions, and download links.
   * 
   * This tool is useful for getting complete information about a dataset after
   * finding it through search_datasets. At least one identifier (numberBfs or
   * numberAsset) must be provided.
   * 
   * @async
   * @param {Object} params - Dataset identifier parameters
   * @param {string} [params.numberBfs] - BFS number (e.g., "px-x-1502040100_131")
   * @param {string} [params.numberAsset] - Asset number from DAM API
   * @param {string} params.language - Language for results (de, fr, it, en)
   * @returns {Promise<Object>} MCP tool response with dataset metadata
   * @throws {Error} If neither identifier is provided or dataset not found
   * 
   * @example
   * // Get dataset info by BFS number
   * {
   *   numberBfs: 'px-x-1502040100_131',
   *   language: 'en'
   * }
   * 
   * @example
   * // Get dataset info by asset number
   * {
   *   numberAsset: '12345678',
   *   language: 'de'
   * }
   */
  server.tool(
    'get_dataset_info',
    'Get detailed information about a specific BFS dataset using its BFS number or asset number. Returns comprehensive metadata including title, description, available languages, publication date, and links to data files.',
    {
      numberBfs: z.string().optional().describe('BFS number (FSO number) of the dataset (e.g., "px-x-1502040100_131")'),
      numberAsset: z.string().optional().describe('Asset number of the dataset'),
      language: z.enum(['de', 'fr', 'it', 'en']).default('en').describe('Language for results'),
    },
    async ({ numberBfs, numberAsset, language }) => {
      try {
        if (!numberBfs && !numberAsset) {
          throw new Error('Either numberBfs or numberAsset must be provided');
        }
        
        logger.info({ numberBfs, numberAsset, language }, 'Getting dataset info');
        
        let assetNum = numberAsset;
        
        // If only BFS number provided, search for the asset
        if (!assetNum && numberBfs) {
          const searchResults = await searchCatalog({
            language,
            orderNr: numberBfs,
            limit: 1,
          });
          
          if (!searchResults.data || searchResults.data.length === 0) {
            throw new Error(`Dataset not found with BFS number: ${numberBfs}`);
          }
          
          assetNum = searchResults.data[0].ids?.damId?.toString();
        }
        
        const metadata = await getAssetMetadata(assetNum, language);
        
        // Format metadata for readability
        const info = {
          title: metadata.description?.titles?.main || 'Untitled',
          subtitle: metadata.description?.titles?.sub || null,
          numberBfs: metadata.shop?.orderNr || 'N/A',
          numberAsset: metadata.ids?.damId || 'N/A',
          publicationDate: metadata.bfs?.embargo || 'N/A',
          language: metadata.description?.language || language,
          summary: metadata.description?.shortSummary?.raw || null,
          themes: metadata.description?.categorization?.prodima?.map(p => p.text) || [],
          spatialDivisions: metadata.description?.categorization?.spatialdivision?.map(s => s.text) || [],
          links: metadata.links?.map(link => ({
            rel: link.rel,
            href: link.href,
          })) || [],
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error({ error: error.message }, 'Error getting dataset info');
        return {
          content: [
            {
              type: 'text',
              text: `Error getting dataset info: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
