import { describe, it, expect, vi, beforeEach } from 'vitest';
import ky from 'ky';
import { searchCatalog, getAssetMetadata, getThemes } from '../../src/api/dam-client.js';

// Mock the 'ky' library
// The apiClient is created via ky.create(), so we need to mock the instance methods
vi.mock('ky', () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  
  return {
    default: {
      create: vi.fn(() => ({
        get: mockGet,
        post: mockPost,
      })),
      // Expose mocks for test access
      __mockGet: mockGet,
      __mockPost: mockPost,
    },
  };
});

// Access the mocks
const mockGet = ky.__mockGet;
const mockPost = ky.__mockPost;

describe('dam-client', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('searchCatalog', () => {
    it('should call the API with correct parameters and return data', async () => {
      const mockResponse = { data: [{ id: 1, title: 'Test Asset' }] };
      // Mock the chained .json() call
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const params = {
        language: 'en',
        extendedSearch: 'test query',
        limit: 50,
      };
      const result = await searchCatalog(params);

      expect(mockGet).toHaveBeenCalledWith('dam/assets', {
        searchParams: {
          language: 'en',
          articleModelGroup: 900029,
          articleModel: 900033,
          extendedSearch: 'test query',
          limit: 50,
        },
        headers: {
          'Accept-Language': 'en',
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      // Mock the .json() method to throw an error
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('API Failure')),
      });
      
      await expect(searchCatalog({ language: 'en' })).rejects.toThrow('Failed to search catalog: API Failure');
    });
  });

  describe('getAssetMetadata', () => {
    it('should fetch asset metadata successfully', async () => {
      const mockResponse = { id: 'test-id', title: 'Test Asset Metadata' };
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await getAssetMetadata('test-id', 'fr');

      expect(mockGet).toHaveBeenCalledWith('dam/assets/test-id', {
        headers: {
          'Accept-Language': 'fr',
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('API Failure')),
      });
      
      await expect(getAssetMetadata('test-id', 'en')).rejects.toThrow('Failed to fetch asset metadata for test-id: API Failure');
    });
  });

  describe('getThemes', () => {
    it('should return a static list of themes', () => {
      const themes = getThemes();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
      expect(themes[0]).toHaveProperty('name');
      expect(themes[0]).toHaveProperty('prodima');
      expect(themes[0]).toHaveProperty('code');
    });
  });

  describe('searchCatalog with optional parameters', () => {
    it('should handle all optional search parameters', async () => {
      const mockResponse = { data: [] };
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const params = {
        language: 'de',
        title: 'Population',
        spatialDivision: 'Cantons',
        prodima: [900010, 900035],
        inquiry: 'test-inquiry',
        institution: 'BFS',
        publishingYearStart: '2020',
        publishingYearEnd: '2023',
        orderNr: 'px-x-1234',
        limit: 200,
      };

      await searchCatalog(params);

      expect(mockGet).toHaveBeenCalledWith('dam/assets', {
        searchParams: expect.objectContaining({
          language: 'de',
          title: 'Population',
          spatialdivision: 900092,
          prodima: [900010, 900035],
          inquiry: 'test-inquiry',
          institution: 'BFS',
          periodStart: '2020',
          periodEnd: '2023',
          orderNr: 'px-x-1234',
          limit: 200,
        }),
        headers: {
          'Accept-Language': 'de',
        },
      });
    });

    it('should handle single prodima value', async () => {
      const mockResponse = { data: [] };
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      await searchCatalog({
        language: 'en',
        prodima: 900010,
      });

      expect(mockGet).toHaveBeenCalledWith('dam/assets', {
        searchParams: expect.objectContaining({
          prodima: [900010],
        }),
        headers: {
          'Accept-Language': 'en',
        },
      });
    });
  });
});
