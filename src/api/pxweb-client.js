/**
 * @fileoverview PXWEB API client for BFS MCP server.
 * Provides functions to retrieve metadata and data from BFS statistical datasets using the PXWEB API.
 * PXWEB is a standard API for accessing statistical data in PX format, widely used by statistical offices.
 * 
 * @module api/pxweb-client
 * @see {@link https://www.bfs.admin.ch/bfs/en/home.html|Swiss Federal Statistical Office}
 * @see {@link https://www.scb.se/en/services/statistical-programs-for-px-files/px-web/pxweb-api/|PXWEB API Documentation}
 */

import ky from 'ky';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { validateLanguage, formatBfsNumber, sleep } from '../utils/formatting.js';

/**
 * Get metadata structure for a BFS dataset from the PXWEB API.
 * Returns information about all available dimensions, their codes, and possible values.
 * This metadata is essential for understanding what filters can be applied when querying data.
 * 
 * @async
 * @param {string} numberBfs - BFS number (FSO number) of the dataset (e.g., "px-x-1502040100_131")
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @returns {Promise<Object>} Dataset metadata including variables array with dimension information
 * @throws {Error} If the dataset is not found or the API request fails
 * 
 * @example
 * // Get metadata for a dataset
 * const metadata = await getMetadata('px-x-1502040100_131', 'en');
 * console.log(metadata.variables); // Array of dimensions
 * metadata.variables.forEach(v => {
 *   console.log(`${v.code}: ${v.values.length} values`);
 * });
 */
export async function getMetadata(numberBfs, language = 'de') {
  const lang = validateLanguage(language);
  const bfsNum = formatBfsNumber(numberBfs);
  
  const url = `${config.pxwebBaseUrl}/${lang}/${bfsNum}/${bfsNum}.px`;
  
  logger.debug({ url, numberBfs: bfsNum, language: lang }, 'Fetching PXWEB metadata');
  
  try {
    const response = await ky.get(url, {
      retry: {
        limit: config.maxRetries,
        methods: ['get'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      timeout: 30000,
    }).json();
    
    logger.debug({ numberBfs: bfsNum }, 'Successfully fetched metadata');
    return response;
  } catch (error) {
    logger.error({ error: error.message, numberBfs: bfsNum }, 'Failed to fetch metadata');
    throw new Error(`Failed to fetch metadata for ${bfsNum}: ${error.message}`);
  }
}

/**
 * Get data from a BFS dataset with optional dimension filters.
 * If no query is provided, retrieves all data. If a query is provided, filters data by specified dimensions.
 * Automatically fetches metadata first to build a valid query structure.
 * 
 * @async
 * @param {string} numberBfs - BFS number (FSO number) of the dataset (e.g., "px-x-1502040100_131")
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @param {Object|null} [query=null] - Query object with dimension filters. Keys are dimension codes, values are arrays of dimension value codes.
 * @param {string} [format='json-stat'] - Response format: 'json-stat' (default), 'json', or 'csv'
 * @returns {Promise<Object>} Dataset data in the specified format
 * @throws {Error} If the dataset is not found or the API request fails
 * 
 * @example
 * // Get all data from a dataset
 * const allData = await getData('px-x-1502040100_131', 'en');
 * 
 * @example
 * // Get filtered data
 * const filteredData = await getData(
 *   'px-x-1502040100_131',
 *   'en',
 *   {
 *     'Jahr': ['40', '41'],  // Filter by specific years
 *     'Geschlecht': ['0', '1']  // Filter by gender
 *   },
 *   'json-stat'
 * );
 * 
 * @example
 * // Get data in CSV format
 * const csvData = await getData('px-x-1502040100_131', 'de', null, 'csv');
 */
export async function getData(numberBfs, language = 'de', query = null, format = 'json-stat') {
  const lang = validateLanguage(language);
  const bfsNum = formatBfsNumber(numberBfs);
  
  const url = `${config.pxwebBaseUrl}/${lang}/${bfsNum}/${bfsNum}.px`;
  
  logger.debug({ url, numberBfs: bfsNum, language: lang, hasQuery: !!query }, 'Fetching PXWEB data');
  
  // Apply delay if configured
  if (config.requestDelay > 0) {
    await sleep(config.requestDelay * 1000);
  }
  
  try {
    // First get metadata to build query if not provided
    const metadata = await getMetadata(numberBfs, language);
    
    let queryPayload;
    
    if (query === null) {
      // Build query to get all data
      queryPayload = {
        query: metadata.variables.map(variable => ({
          code: variable.code,
          selection: {
            filter: 'all',
            values: ['*'],
          },
        })),
        response: {
          format: format,
        },
      };
    } else {
      // Use provided query
      queryPayload = {
        query: Object.entries(query).map(([code, values]) => ({
          code,
          selection: {
            filter: 'item',
            values: Array.isArray(values) ? values : [values],
          },
        })),
        response: {
          format: format,
        },
      };
    }
    
    const response = await ky.post(url, {
      json: queryPayload,
      retry: {
        limit: config.maxRetries,
        methods: ['post'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      timeout: 60000,
    }).json();
    
    logger.debug({ numberBfs: bfsNum }, 'Successfully fetched data');
    return response;
  } catch (error) {
    logger.error({ error: error.message, numberBfs: bfsNum }, 'Failed to fetch data');
    throw new Error(`Failed to fetch data for ${bfsNum}: ${error.message}`);
  }
}

/**
 * Get configuration limits and settings from the PXWEB API.
 * Returns information about API limits such as maximum cells per query, timeout settings, etc.
 * Useful for understanding API constraints before making large data requests.
 * 
 * @async
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @returns {Promise<Object>} API configuration including limits and settings
 * @throws {Error} If the API request fails
 * 
 * @example
 * // Get API configuration
 * const config = await getConfig('en');
 * console.log(config.maxCells); // Maximum cells per query
 * console.log(config.timeWindow); // Time window for rate limiting
 */
export async function getConfig(language = 'de') {
  const lang = validateLanguage(language);
  const url = `${config.pxwebBaseUrl}/${lang}/?config`;
  
  try {
    const response = await ky.get(url).json();
    logger.debug('Successfully fetched PXWEB config');
    return response;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch PXWEB config');
    throw new Error(`Failed to fetch PXWEB config: ${error.message}`);
  }
}
