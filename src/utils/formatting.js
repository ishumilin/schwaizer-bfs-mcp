/**
 * @fileoverview Data formatting and validation utilities for BFS MCP server. Provides helper functions for validating and formatting API inputs and outputs, including language validation, BFS number formatting, spatial division mapping, and user-friendly error message generation.
 * @module utils/formatting
 */

/**
 * Validate and normalize language code
 * 
 * Ensures the provided language code is one of the supported languages
 * (German, French, Italian, English) and returns it in lowercase format.
 * 
 * @param {string} language - Language code (de, fr, it, en)
 * @returns {string} Validated language code in lowercase
 * @throws {Error} If language is invalid or not supported
 * @example
 * import { validateLanguage } from './utils/formatting.js';
 * 
 * const lang = validateLanguage('DE'); // Returns 'de'
 * const lang2 = validateLanguage('en'); // Returns 'en'
 * // validateLanguage('es'); // Throws Error: Invalid language
 */
export function validateLanguage(language) {
  const validLanguages = ['de', 'fr', 'it', 'en'];
  const lang = language?.toLowerCase();
  
  if (!validLanguages.includes(lang)) {
    throw new Error(`Invalid language: ${language}. Must be one of: ${validLanguages.join(', ')}`);
  }
  
  return lang;
}

/**
 * Format BFS number by trimming whitespace
 * 
 * Validates and cleans a BFS dataset identifier by removing leading
 * and trailing whitespace.
 * 
 * @param {string} numberBfs - BFS number to format
 * @returns {string} Cleaned BFS number
 * @throws {Error} If BFS number is not provided
 * @example
 * import { formatBfsNumber } from './utils/formatting.js';
 * 
 * const cleaned = formatBfsNumber('  px-x-1502040100_131  '); // Returns 'px-x-1502040100_131'
 * const cleaned2 = formatBfsNumber('DF_LWZ_1'); // Returns 'DF_LWZ_1'
 */
export function formatBfsNumber(numberBfs) {
  if (!numberBfs) {
    throw new Error('BFS number is required');
  }
  return numberBfs.trim();
}

/**
 * Sleep for specified milliseconds
 * 
 * Creates a promise that resolves after the specified delay.
 * Useful for implementing rate limiting or adding delays between API calls.
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Promise that resolves after the delay
 * @example
 * import { sleep } from './utils/formatting.js';
 * 
 * // Wait 1 second before next operation
 * await sleep(1000);
 * 
 * // Rate limiting example
 * for (const item of items) {
 *   await processItem(item);
 *   await sleep(500); // Wait 500ms between items
 * }
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert spatial division name to BFS code
 * 
 * Maps human-readable spatial division names to their corresponding
 * BFS numerical codes used in the DAM API for filtering datasets.
 * 
 * @param {string} spatialDivision - Spatial division name (Switzerland, Cantons, Districts, Communes, Other spatial divisions, International)
 * @returns {number|null} Spatial division code, or null if not found
 * @example
 * import { getSpatialDivisionCode } from './utils/formatting.js';
 * 
 * const code = getSpatialDivisionCode('Switzerland'); // Returns 900091
 * const code2 = getSpatialDivisionCode('Cantons'); // Returns 900092
 * const code3 = getSpatialDivisionCode('Unknown'); // Returns null
 */
export function getSpatialDivisionCode(spatialDivision) {
  const spatialDivisionMap = {
    'Switzerland': 900091,
    'Cantons': 900092,
    'Districts': 900093,
    'Communes': 900004,
    'Other spatial divisions': 900008,
    'International': 900068,
  };
  
  return spatialDivisionMap[spatialDivision] || null;
}

/**
 * Format error message for user-friendly output
 * 
 * Converts technical error objects into user-friendly messages,
 * with special handling for common HTTP status codes (429, 404, 400).
 * 
 * @param {Error} error - Error object, potentially with response property
 * @returns {string} Formatted, user-friendly error message
 * @example
 * import { formatErrorMessage } from './utils/formatting.js';
 * 
 * // HTTP error with status code
 * const error1 = { response: { status: 429 }, message: 'Too many requests' };
 * formatErrorMessage(error1); // Returns 'Rate limit exceeded. Please wait...'
 * 
 * // HTTP 404 error
 * const error2 = { response: { status: 404 }, message: 'Not found' };
 * formatErrorMessage(error2); // Returns 'Dataset not found. Please check...'
 * 
 * // Generic error
 * const error3 = new Error('Connection failed');
 * formatErrorMessage(error3); // Returns 'Connection failed'
 */
export function formatErrorMessage(error) {
  if (error.response) {
    const status = error.response.status;
    
    if (status === 429) {
      return 'Rate limit exceeded. Please wait a few seconds before trying again.';
    }
    if (status === 404) {
      return 'Dataset not found. Please check the BFS number and try again.';
    }
    if (status === 400) {
      return 'Invalid request. Please check your query parameters.';
    }
    
    return `HTTP ${status}: ${error.message}`;
  }
  
  return error.message || 'An unknown error occurred';
}
