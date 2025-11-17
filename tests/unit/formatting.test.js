import { describe, it, expect } from 'vitest';
import {
  validateLanguage,
  formatBfsNumber,
  sleep,
  getSpatialDivisionCode,
  formatErrorMessage,
} from '../../src/utils/formatting.js';

describe('formatting utilities', () => {
  describe('validateLanguage', () => {
    it('should accept valid language codes', () => {
      expect(validateLanguage('de')).toBe('de');
      expect(validateLanguage('fr')).toBe('fr');
      expect(validateLanguage('it')).toBe('it');
      expect(validateLanguage('en')).toBe('en');
    });

    it('should normalize language codes to lowercase', () => {
      expect(validateLanguage('DE')).toBe('de');
      expect(validateLanguage('FR')).toBe('fr');
      expect(validateLanguage('IT')).toBe('it');
      expect(validateLanguage('EN')).toBe('en');
    });

    it('should throw error for invalid language codes', () => {
      expect(() => validateLanguage('es')).toThrow('Invalid language: es');
      expect(() => validateLanguage('invalid')).toThrow('Invalid language: invalid');
      expect(() => validateLanguage('')).toThrow('Invalid language');
    });

    it('should throw error for null or undefined', () => {
      expect(() => validateLanguage(null)).toThrow('Invalid language');
      expect(() => validateLanguage(undefined)).toThrow('Invalid language');
    });
  });

  describe('formatBfsNumber', () => {
    it('should return trimmed BFS number', () => {
      expect(formatBfsNumber('px-x-1234')).toBe('px-x-1234');
      expect(formatBfsNumber('  px-x-1234  ')).toBe('px-x-1234');
      expect(formatBfsNumber('DF_LWZ_1')).toBe('DF_LWZ_1');
    });

    it('should throw error for empty or null BFS number', () => {
      expect(() => formatBfsNumber('')).toThrow('BFS number is required');
      expect(() => formatBfsNumber(null)).toThrow('BFS number is required');
      expect(() => formatBfsNumber(undefined)).toThrow('BFS number is required');
    });

    it('should handle BFS numbers with whitespace', () => {
      expect(formatBfsNumber('  px-x-1234  ')).toBe('px-x-1234');
      expect(formatBfsNumber('\tpx-x-1234\n')).toBe('px-x-1234');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    it('should resolve immediately for 0 milliseconds', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('getSpatialDivisionCode', () => {
    it('should return correct codes for valid spatial divisions', () => {
      expect(getSpatialDivisionCode('Switzerland')).toBe(900091);
      expect(getSpatialDivisionCode('Cantons')).toBe(900092);
      expect(getSpatialDivisionCode('Districts')).toBe(900093);
      expect(getSpatialDivisionCode('Communes')).toBe(900004);
      expect(getSpatialDivisionCode('Other spatial divisions')).toBe(900008);
      expect(getSpatialDivisionCode('International')).toBe(900068);
    });

    it('should return null for invalid spatial divisions', () => {
      expect(getSpatialDivisionCode('Invalid')).toBeNull();
      expect(getSpatialDivisionCode('Unknown')).toBeNull();
      expect(getSpatialDivisionCode('')).toBeNull();
    });

    it('should be case-sensitive', () => {
      expect(getSpatialDivisionCode('switzerland')).toBeNull();
      expect(getSpatialDivisionCode('SWITZERLAND')).toBeNull();
    });
  });

  describe('formatErrorMessage', () => {
    it('should format rate limit error (429)', () => {
      const error = {
        response: { status: 429 },
        message: 'Too Many Requests',
      };
      
      expect(formatErrorMessage(error)).toBe(
        'Rate limit exceeded. Please wait a few seconds before trying again.'
      );
    });

    it('should format not found error (404)', () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found',
      };
      
      expect(formatErrorMessage(error)).toBe(
        'Dataset not found. Please check the BFS number and try again.'
      );
    });

    it('should format bad request error (400)', () => {
      const error = {
        response: { status: 400 },
        message: 'Bad Request',
      };
      
      expect(formatErrorMessage(error)).toBe(
        'Invalid request. Please check your query parameters.'
      );
    });

    it('should format other HTTP errors', () => {
      const error = {
        response: { status: 500 },
        message: 'Internal Server Error',
      };
      
      expect(formatErrorMessage(error)).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle errors without response object', () => {
      const error = {
        message: 'Network error',
      };
      
      expect(formatErrorMessage(error)).toBe('Network error');
    });

    it('should handle errors without message', () => {
      const error = {};
      
      expect(formatErrorMessage(error)).toBe('An unknown error occurred');
    });

    it('should handle Error instances', () => {
      const error = new Error('Test error');
      
      expect(formatErrorMessage(error)).toBe('Test error');
    });
  });
});
