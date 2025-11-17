/**
 * @fileoverview Swiss Stats Explorer (SSE) API client for BFS MCP server.
 * 
 * This module provides a client for interacting with the Swiss Federal Statistical Office's
 * Swiss Stats Explorer (SSE) API, which uses the SDMX (Statistical Data and Metadata eXchange)
 * standard. The SSE API is particularly well-suited for time-series data and provides modern
 * SDMX-based access to BFS datasets.
 * 
 * Key features:
 * - SDMX XML parsing for metadata and data retrieval
 * - Dataflow URL resolution with caching for performance
 * - Support for dimension-based filtering and time period selection
 * - Multi-language support (de, fr, it, en)
 * - Automatic conversion of SDMX structures to simplified JSON format
 * 
 * @module api/sse-client
 * @see {@link https://www.bfs.admin.ch/bfs/en/home/services/api.html|BFS API Documentation}
 */

import { parseStringPromise } from 'xml2js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { validateLanguage, formatBfsNumber, sleep } from '../utils/formatting.js';

/**
 * Cache for dataflow URLs to avoid repeated lookups.
 * Maps cache keys (format: `${numberBfs}_${metadata}`) to resolved SSE URLs.
 * @type {Map<string, string>}
 * @constant
 */
const dataflowUrlCache = new Map();

/**
 * Get the full SSE URL for a dataset by looking up its dataflow.
 * 
 * This internal function resolves the complete SDMX URL for a dataset by:
 * 1. Checking the cache for previously resolved URLs
 * 2. Fetching all available dataflows from the SSE API
 * 3. Parsing dataflow URNs to find the matching dataset
 * 4. Constructing the appropriate metadata or data URL
 * 5. Caching the result for future requests
 * 
 * @param {string} numberBfs - BFS dataset identifier (e.g., "DF_LWZ_1")
 * @param {boolean} [metadata=false] - Whether to get metadata URL instead of data URL
 * @returns {Promise<string>} Full SSE URL with agency, dataflow, and version
 * @throws {Error} If the dataset is not found or the API request fails
 * 
 * @example
 * // Get data URL for a dataset
 * const dataUrl = await getSseUrl('DF_LWZ_1', false);
 * // Returns: 'https://disseminate.stats.swiss/rest/data/BFS,DF_LWZ_1,1.0/'
 * 
 * @example
 * // Get metadata URL for a dataset
 * const metadataUrl = await getSseUrl('DF_LWZ_1', true);
 * // Returns: 'https://disseminate.stats.swiss/rest/dataflow/BFS/DF_LWZ_1/1.0?references=all'
 */
async function getSseUrl(numberBfs, metadata = false) {
  const cacheKey = `${numberBfs}_${metadata}`;
  
  // Check cache first
  if (dataflowUrlCache.has(cacheKey)) {
    return dataflowUrlCache.get(cacheKey);
  }
  
  const baseUrl = 'https://disseminate.stats.swiss/rest';
  
  try {
    // Get all available dataflows using native fetch
    const response = await fetch(`${baseUrl}/dataflow`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(60000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const dataflowsResponse = await response.json();
    
    // Extract dataflow URNs from references
    const references = dataflowsResponse?.references || {};
    const dataflowUrns = Object.keys(references);
    
    // Find the matching dataflow for our dataset
    let matchingUrn = null;
    for (const urn of dataflowUrns) {
      // URN format: urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=AGENCY:DATAFLOW_ID(VERSION)
      const match = urn.match(/Dataflow=([^:]+):([^(]+)\(([^)]+)\)/);
      if (match && match[2] === numberBfs) {
        matchingUrn = {
          agencyId: match[1],
          dataflowId: match[2],
          version: match[3],
        };
        break;
      }
    }
    
    if (!matchingUrn) {
      throw new Error(`Dataset ${numberBfs} not found in SSE API`);
    }
    
    // Build the URL
    let url;
    if (metadata) {
      // Metadata URL format: /dataflow/agency/dataflow/version?references=all
      url = `${baseUrl}/dataflow/${matchingUrn.agencyId}/${matchingUrn.dataflowId}/${matchingUrn.version}?references=all`;
    } else {
      // Data URL format: /data/agency,dataflow,version/
      url = `${baseUrl}/data/${matchingUrn.agencyId},${matchingUrn.dataflowId},${matchingUrn.version}/`;
    }
    
    // Cache the result
    dataflowUrlCache.set(cacheKey, url);
    
    logger.debug({ numberBfs, metadata, url }, 'Resolved SSE URL');
    return url;
  } catch (error) {
    logger.error({ error: error.message, numberBfs }, 'Failed to resolve SSE URL');
    throw new Error(`Failed to resolve SSE URL for ${numberBfs}: ${error.message}`);
  }
}

/**
 * Get metadata for an SSE dataset.
 * 
 * Retrieves comprehensive metadata about a dataset from the Swiss Stats Explorer API,
 * including all available dimensions, their codes, and possible values. The metadata
 * is extracted from SDMX XML structures and converted to a simplified JSON format.
 * 
 * The returned metadata includes:
 * - Dimension codes and their positions
 * - Codelist references and values
 * - Localized labels in the requested language
 * 
 * @param {string} numberBfs - BFS dataset identifier (e.g., "DF_LWZ_1")
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @returns {Promise<Array<Object>>} Array of dimension metadata objects, each containing:
 *   - code: Dimension code
 *   - text: Dimension label
 *   - value: Dimension value code
 *   - valueText: Dimension value label
 *   - position_dimension: Position in the dimension list
 * @throws {Error} If the dataset is not found or the API request fails
 * 
 * @example
 * // Get metadata for vacant dwellings dataset in English
 * const metadata = await getSseMetadata('DF_LWZ_1', 'en');
 * // Returns array like:
 * // [
 * //   {
 * //     code: 'GR_KT_GDE',
 * //     text: 'Canton/Municipality',
 * //     value: '2581',
 * //     valueText: 'Zürich',
 * //     position_dimension: 0
 * //   },
 * //   ...
 * // ]
 */
export async function getSseMetadata(numberBfs, language = 'de') {
  const lang = validateLanguage(language);
  const bfsNum = formatBfsNumber(numberBfs);
  
  const metadataUrl = await getSseUrl(bfsNum, true);
  
  logger.debug({ metadataUrl, numberBfs: bfsNum, language: lang }, 'Fetching SSE metadata');
  
  try {
    const response = await fetch(metadataUrl, {
      headers: {
        'Accept': 'application/xml',
        'Accept-Language': lang,
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const xmlResponse = await response.text();
    
    const parsed = await parseStringPromise(xmlResponse);
    
    // Extract dimensions from SDMX structure
    const dimensions = [];
    const structure = parsed?.['message:Structure']?.['message:Structures']?.[0];
    
    // Get dimension list
    const dimensionList = structure?.['structure:DataStructures']?.[0]?.['structure:DataStructure']?.[0]
      ?.['structure:DataStructureComponents']?.[0]?.['structure:DimensionList']?.[0]?.['structure:Dimension'] || [];
    
    const dimInfo = dimensionList.map(dim => ({
      id: dim.$?.id,
      position: parseInt(dim.$?.position || '0'),
      codelistRef: dim['structure:LocalRepresentation']?.[0]?.['structure:Enumeration']?.[0]?.['Ref']?.[0]?.$?.id,
    }));
    
    // Get codelists
    const codelists = structure?.['structure:Codelists']?.[0]?.['structure:Codelist'] || [];
    const codelistMap = {};
    
    for (const codelist of codelists) {
      const codelistId = codelist.$?.id;
      const codes = codelist['structure:Code'] || [];
      
      codelistMap[codelistId] = codes.map(code => {
        const codeId = code.$?.id;
        const names = code['common:Name'] || [];
        
        // Find name in requested language, fallback to first available
        let label = codeId;
        const langName = names.find(n => n.$?.['xml:lang'] === lang);
        if (langName) {
          label = langName._ || codeId;
        } else if (names.length > 0) {
          label = names[0]._ || codeId;
        }
        
        return {
          code: codeId,
          label,
        };
      });
    }
    
    // Get codelist names
    const codelistNames = {};
    for (const codelist of codelists) {
      const codelistId = codelist.$?.id;
      const names = codelist['common:Name'] || [];
      
      let name = codelistId;
      const langName = names.find(n => n.$?.['xml:lang'] === lang);
      if (langName) {
        name = langName._ || codelistId;
      } else if (names.length > 0) {
        name = names[0]._ || codelistId;
      }
      
      codelistNames[codelistId] = name;
    }
    
    // Combine dimension info with codelist values
    for (const dim of dimInfo) {
      if (dim.codelistRef && codelistMap[dim.codelistRef]) {
        const codes = codelistMap[dim.codelistRef];
        const codelistText = codelistNames[dim.codelistRef] || dim.id;
        
        for (const code of codes) {
          dimensions.push({
            code: dim.id,
            text: codelistText,
            value: code.code,
            valueText: code.label,
            position_dimension: dim.position,
          });
        }
      }
    }
    
    logger.debug({ numberBfs: bfsNum, dimensionCount: dimensions.length }, 'Successfully fetched SSE metadata');
    return dimensions;
  } catch (error) {
    logger.error({ error: error.message, numberBfs: bfsNum }, 'Failed to fetch SSE metadata');
    throw new Error(`Failed to fetch SSE metadata for ${bfsNum}: ${error.message}`);
  }
}

/**
 * Get data from SSE API.
 * 
 * Retrieves time-series data from the Swiss Stats Explorer API with optional filtering
 * by dimensions and time periods. The data is extracted from SDMX Generic XML format
 * and converted to simplified JSON observations.
 * 
 * Query filters are applied by dimension code, and values can be single strings or arrays.
 * The function automatically resolves dimension positions and constructs the appropriate
 * SDMX query URL. Time periods can be specified to limit the temporal scope of the data.
 * 
 * @param {string} numberBfs - BFS dataset identifier (e.g., "DF_LWZ_1")
 * @param {string} [language='de'] - Language code (de, fr, it, en)
 * @param {Object<string, string|string[]>|null} [query=null] - Query object with dimension filters.
 *   Keys are dimension codes, values are dimension value codes (string or array of strings).
 * @param {string} [startPeriod] - Start period for time-series data (e.g., "2020")
 * @param {string} [endPeriod] - End period for time-series data (e.g., "2023")
 * @returns {Promise<Array<Object>>} Array of observation objects with dimension values and data
 * @throws {Error} If the dataset is not found, no records match the query, or the API request fails
 * 
 * @example
 * // Get all data for a dataset
 * const data = await getSseData('DF_LWZ_1', 'en');
 * 
 * @example
 * // Get data with dimension filters
 * const data = await getSseData('DF_LWZ_1', 'en', {
 *   GR_KT_GDE: ['2581', '4001'],  // Zürich and Basel
 *   LEERWOHN_TYP: '4'              // Specific dwelling type
 * });
 * 
 * @example
 * // Get data for a specific time period
 * const data = await getSseData('DF_LWZ_1', 'en', null, '2020', '2023');
 * // Returns observations from 2020 to 2023
 * 
 * @example
 * // Combine filters and time period
 * const data = await getSseData('DF_LWZ_1', 'en', {
 *   GR_KT_GDE: '2581'
 * }, '2022', '2023');
 * // Returns: [{ GR_KT_GDE: 'Zürich', TIME_PERIOD: '2022', value: 1234 }, ...]
 */
export async function getSseData(numberBfs, language = 'de', query = null, startPeriod = null, endPeriod = null) {
  const lang = validateLanguage(language);
  const bfsNum = formatBfsNumber(numberBfs);
  
  // Apply delay if configured
  if (config.requestDelay > 0) {
    await sleep(config.requestDelay * 1000);
  }
  
  const dataUrl = await getSseUrl(bfsNum, false);
  
  // Get metadata to understand dimension structure
  const metadata = await getSseMetadata(bfsNum, lang);
  
  // Build URL query part
  let urlQuery = 'all';
  if (query) {
    // Get ordered dimension codes
    const orderedCodes = [...new Set(metadata.map(m => m.code))].sort((a, b) => {
      const posA = metadata.find(m => m.code === a)?.position_dimension || 0;
      const posB = metadata.find(m => m.code === b)?.position_dimension || 0;
      return posA - posB;
    });
    
    const urlParts = orderedCodes.map(dim => {
      if (query[dim]) {
        const values = Array.isArray(query[dim]) ? query[dim] : [query[dim]];
        return values.join('+');
      }
      return '';
    });
    
    if (!urlParts.every(part => part === '')) {
      urlQuery = urlParts.join('.');
    }
  }
  
  // Build query parameters
  const queryParams = ['dimensionAtObservation=AllDimensions'];
  if (startPeriod) queryParams.push(`startPeriod=${startPeriod}`);
  if (endPeriod) queryParams.push(`endPeriod=${endPeriod}`);
  
  const url = `${dataUrl}${urlQuery}?${queryParams.join('&')}`;
  
  logger.debug({ url, numberBfs: bfsNum, language: lang }, 'Fetching SSE data');
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'Accept-Language': lang,
      },
      signal: AbortSignal.timeout(60000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const xmlResponse = await response.text();
    
    const parsed = await parseStringPromise(xmlResponse);
    
    // Extract observations from SDMX Generic format
    const observations = [];
    const dataSets = parsed?.['message:GenericData']?.['message:DataSet'];
    
    if (dataSets) {
      for (const dataSet of dataSets) {
        const obs = dataSet?.['generic:Obs'] || [];
        
        for (const observation of obs) {
          const obsData = {};
          
          // Extract dimension values
          const obsKeys = observation?.['generic:ObsKey']?.[0]?.['generic:Value'] || [];
          for (const key of obsKeys) {
            const dimId = key.$?.id;
            const dimValue = key.$?.value;
            
            // Find matching metadata for readable labels
            const metaMatch = metadata.find(m => m.code === dimId && m.value === dimValue);
            obsData[dimId] = metaMatch?.valueText || dimValue;
          }
          
          // Extract observation value
          const obsValue = observation?.['generic:ObsValue']?.[0]?.$?.value;
          obsData.value = obsValue ? parseFloat(obsValue) : null;
          
          observations.push(obsData);
        }
      }
    }
    
    logger.debug({ numberBfs: bfsNum, observationCount: observations.length }, 'Successfully fetched SSE data');
    return observations;
  } catch (error) {
    logger.error({ error: error.message, numberBfs: bfsNum }, 'Failed to fetch SSE data');
    
    if (error.message.includes('NoRecordsFound')) {
      throw new Error('No records found for the specified query');
    }
    
    throw new Error(`Failed to fetch SSE data for ${bfsNum}: ${error.message}`);
  }
}
