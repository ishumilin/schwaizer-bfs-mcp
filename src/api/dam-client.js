/**
 * @fileoverview DAM (Data Asset Management) API client for BFS MCP server.
 * Provides functions to search the BFS catalog, retrieve asset metadata, and list available themes.
 * The DAM API is the primary interface for discovering and accessing BFS statistical datasets.
 * 
 * @module api/dam-client
 * @see {@link https://www.bfs.admin.ch/bfs/en/home.html|Swiss Federal Statistical Office}
 */

import ky from 'ky';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { validateLanguage, getSpatialDivisionCode } from '../utils/formatting.js';

/**
 * Configured HTTP client for DAM API requests.
 * Pre-configured with base URL, retry logic, and timeout settings.
 * 
 * @constant {import('ky').KyInstance}
 * @see {@link https://github.com/sindresorhus/ky|ky HTTP client}
 */
export const apiClient = ky.create({
  prefixUrl: config.damBaseUrl,
  headers: {
    'Accept': 'application/json',
  },
  retry: {
    limit: config.maxRetries,
    methods: ['get'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  timeout: 30000,
});

/**
 * Search for datasets in the BFS catalog using various filters.
 * Searches the Data Asset Management API for statistical datasets matching the provided criteria.
 * 
 * @async
 * @param {Object} params - Search parameters
 * @param {string} params.language - Language code (de, fr, it, en)
 * @param {string} [params.title] - Search in title field only
 * @param {string} [params.extendedSearch] - Extended search across multiple fields (title, description, etc.)
 * @param {string} [params.spatialDivision] - Spatial division filter (e.g., "Switzerland", "Cantons")
 * @param {number|number[]} [params.prodima] - Theme number(s) to filter by (use getThemes() to see available themes)
 * @param {string} [params.inquiry] - Inquiry filter
 * @param {string} [params.institution] - Institution filter
 * @param {string} [params.publishingYearStart] - Publishing year start (e.g., "2020")
 * @param {string} [params.publishingYearEnd] - Publishing year end (e.g., "2023")
 * @param {string} [params.orderNr] - BFS number filter (exact match)
 * @param {number} [params.limit=100] - Result limit (default: 100, max: 1000)
 * @returns {Promise<Object>} Search results with data array containing matching datasets
 * @throws {Error} If the API request fails
 * 
 * @example
 * // Search for population datasets in English
 * const results = await searchCatalog({
 *   language: 'en',
 *   extendedSearch: 'population',
 *   prodima: 900010,
 *   limit: 50
 * });
 * 
 * @example
 * // Search by BFS number
 * const dataset = await searchCatalog({
 *   language: 'de',
 *   orderNr: 'px-x-1502040100_131'
 * });
 */
export async function searchCatalog(params) {
  const {
    language = 'de',
    title,
    extendedSearch,
    spatialDivision,
    prodima,
    inquiry,
    institution,
    publishingYearStart,
    publishingYearEnd,
    orderNr,
    limit = 100,
  } = params;
  
  const lang = validateLanguage(language);
  const spatialDivisionCode = spatialDivision ? getSpatialDivisionCode(spatialDivision) : null;
  
  const url = `dam/assets`;
  
  const searchParams = {
    language: lang,
    articleModelGroup: 900029, // Data article type
    articleModel: 900033, // Data article model
  };
  
  // Add optional parameters
  if (title) searchParams.title = title;
  if (extendedSearch) searchParams.extendedSearch = extendedSearch;
  if (spatialDivisionCode) searchParams.spatialdivision = spatialDivisionCode;
  if (prodima) searchParams.prodima = Array.isArray(prodima) ? prodima : [prodima];
  if (inquiry) searchParams.inquiry = inquiry;
  if (institution) searchParams.institution = institution;
  if (publishingYearStart) searchParams.periodStart = publishingYearStart;
  if (publishingYearEnd) searchParams.periodEnd = publishingYearEnd;
  if (orderNr) searchParams.orderNr = orderNr;
  if (limit) searchParams.limit = Math.min(limit, 1000);
  
  logger.debug({ url, searchParams }, 'Searching DAM catalog');
  
  try {
    const response = await apiClient.get(url, {
      searchParams,
      headers: {
        'Accept-Language': lang,
      },
    }).json();
    
    logger.debug({ resultCount: response.data?.length || 0 }, 'Successfully searched catalog');
    return response;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to search catalog');
    throw new Error(`Failed to search catalog: ${error.message}`);
  }
}

/**
 * Get detailed metadata for a specific asset by its asset number.
 * Retrieves comprehensive information including title, description, themes, spatial divisions, and download links.
 * 
 * @async
 * @param {string} numberAsset - Asset number (DAM ID) from the BFS catalog
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @returns {Promise<Object>} Asset metadata including description, categorization, and links
 * @throws {Error} If the asset is not found or the API request fails
 * 
 * @example
 * // Get metadata for a specific asset
 * const metadata = await getAssetMetadata('12345678', 'en');
 * console.log(metadata.description.titles.main);
 * console.log(metadata.links);
 */
export async function getAssetMetadata(numberAsset, language = 'de') {
  const lang = validateLanguage(language);
  const url = `dam/assets/${numberAsset}`;
  
  logger.debug({ url, numberAsset, language: lang }, 'Fetching asset metadata');
  
  try {
    const response = await apiClient.get(url, {
      headers: {
        'Accept-Language': lang,
      },
    }).json();
    
    logger.debug({ numberAsset }, 'Successfully fetched asset metadata');
    return response;
  } catch (error) {
    logger.error({ error: error.message, numberAsset }, 'Failed to fetch asset metadata');
    throw new Error(`Failed to fetch asset metadata for ${numberAsset}: ${error.message}`);
  }
}

/**
 * List all available BFS statistical themes with their prodima numbers and codes.
 * Returns a static list of 22 main statistical themes used to categorize BFS datasets.
 * Use the prodima numbers with searchCatalog() to filter datasets by theme.
 * 
 * @returns {Array<Object>} List of themes, each with name, prodima number, and theme code
 * @property {string} name - Theme name in English
 * @property {number} prodima - Prodima number used for filtering in searchCatalog()
 * @property {string} code - Two-digit theme code (00-21)
 * 
 * @example
 * // Get all available themes
 * const themes = getThemes();
 * console.log(themes[1]); // { name: 'Population', prodima: 900010, code: '01' }
 * 
 * @example
 * // Use theme to filter search results
 * const themes = getThemes();
 * const populationTheme = themes.find(t => t.name === 'Population');
 * const results = await searchCatalog({
 *   language: 'en',
 *   prodima: populationTheme.prodima
 * });
 */
export function getThemes() {
  return [
    { name: 'Statistical basis and overviews', prodima: 900001, code: '00' },
    { name: 'Population', prodima: 900010, code: '01' },
    { name: 'Territory and environment', prodima: 900035, code: '02' },
    { name: 'Work and income', prodima: 900051, code: '03' },
    { name: 'National economy', prodima: 900075, code: '04' },
    { name: 'Prices', prodima: 900084, code: '05' },
    { name: 'Industry and services', prodima: 900092, code: '06' },
    { name: 'Agriculture and forestry', prodima: 900104, code: '07' },
    { name: 'Energy', prodima: 900127, code: '08' },
    { name: 'Construction and housing', prodima: 900140, code: '09' },
    { name: 'Tourism', prodima: 900160, code: '10' },
    { name: 'Mobility and transport', prodima: 900169, code: '11' },
    { name: 'Money, banks and insurance', prodima: 900191, code: '12' },
    { name: 'Social security', prodima: 900198, code: '13' },
    { name: 'Health', prodima: 900210, code: '14' },
    { name: 'Education and science', prodima: 900212, code: '15' },
    { name: 'Culture, media, information society, sports', prodima: 900214, code: '16' },
    { name: 'Politics', prodima: 900226, code: '17' },
    { name: 'General Government and finance', prodima: 900239, code: '18' },
    { name: 'Crime and criminal justice', prodima: 900257, code: '19' },
    { name: 'Economic and social situation of the population', prodima: 900269, code: '20' },
    { name: 'Sustainable development, regional and international disparities', prodima: 900276, code: '21' },
  ];
}
