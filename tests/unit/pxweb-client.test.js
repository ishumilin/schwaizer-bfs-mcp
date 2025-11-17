import { describe, it, expect, vi, beforeEach } from 'vitest';
import ky from 'ky';
import { getMetadata, getData, getConfig } from '../../src/api/pxweb-client.js';

// Mock ky
vi.mock('ky', () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  
  return {
    default: {
      get: mockGet,
      post: mockPost,
      __mockGet: mockGet,
      __mockPost: mockPost,
    },
  };
});

// Mock sleep function to avoid delays in tests
vi.mock('../../src/utils/formatting.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

const mockGet = ky.__mockGet;
const mockPost = ky.__mockPost;

describe('pxweb-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMetadata', () => {
    it('should fetch metadata successfully', async () => {
      const mockMetadata = {
        title: 'Test Dataset',
        variables: [
          { code: 'Jahr', text: 'Year', values: ['2020', '2021'] },
          { code: 'Region', text: 'Region', values: ['CH', 'ZH'] },
        ],
      };

      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockMetadata),
      });

      const result = await getMetadata('px-x-1234', 'en');

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/en/px-x-1234/px-x-1234.px'),
        expect.objectContaining({
          retry: expect.any(Object),
          timeout: 30000,
        })
      );
      expect(result).toEqual(mockMetadata);
    });

    it('should handle API errors gracefully', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Not Found')),
      });

      await expect(getMetadata('px-x-1234', 'en')).rejects.toThrow(
        'Failed to fetch metadata for px-x-1234: Not Found'
      );
    });

    it('should validate and format BFS number', async () => {
      const mockMetadata = { title: 'Test' };
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockMetadata),
      });

      await getMetadata('px-x-1234', 'de');

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('px-x-1234'),
        expect.any(Object)
      );
    });
  });

  describe('getData', () => {
    const mockMetadata = {
      title: 'Test Dataset',
      variables: [
        { code: 'Jahr', text: 'Year', values: ['2020', '2021'] },
        { code: 'Region', text: 'Region', values: ['CH', 'ZH'] },
      ],
    };

    it('should fetch data with custom query', async () => {
      const mockData = { data: [1, 2, 3] };

      // First call for metadata
      mockGet.mockReturnValueOnce({
        json: vi.fn().mockResolvedValue(mockMetadata),
      });

      // Second call for data
      mockPost.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockData),
      });

      const query = {
        Jahr: ['2020', '2021'],
        Region: 'CH',
      };

      const result = await getData('px-x-1234', 'en', query, 'json');

      expect(mockGet).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/en/px-x-1234/px-x-1234.px'),
        expect.objectContaining({
          json: expect.objectContaining({
            query: expect.arrayContaining([
              expect.objectContaining({
                code: 'Jahr',
                selection: {
                  filter: 'item',
                  values: ['2020', '2021'],
                },
              }),
              expect.objectContaining({
                code: 'Region',
                selection: {
                  filter: 'item',
                  values: ['CH'],
                },
              }),
            ]),
            response: { format: 'json' },
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should fetch all data when query is null', async () => {
      const mockData = { data: [1, 2, 3] };

      mockGet.mockReturnValueOnce({
        json: vi.fn().mockResolvedValue(mockMetadata),
      });

      mockPost.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await getData('px-x-1234', 'en', null, 'json-stat');

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          json: expect.objectContaining({
            query: expect.arrayContaining([
              expect.objectContaining({
                code: 'Jahr',
                selection: {
                  filter: 'all',
                  values: ['*'],
                },
              }),
            ]),
            response: { format: 'json-stat' },
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should handle API errors gracefully', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Server Error')),
      });

      // getData calls getMetadata first, which will fail
      await expect(getData('px-x-1234', 'en')).rejects.toThrow(
        'Failed to fetch data for px-x-1234'
      );
    });

    it('should handle single value in query as array', async () => {
      const mockData = { data: [1, 2, 3] };

      mockGet.mockReturnValueOnce({
        json: vi.fn().mockResolvedValue(mockMetadata),
      });

      mockPost.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockData),
      });

      const query = {
        Jahr: '2020', // Single value, not array
      };

      await getData('px-x-1234', 'en', query);

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          json: expect.objectContaining({
            query: expect.arrayContaining([
              expect.objectContaining({
                code: 'Jahr',
                selection: {
                  filter: 'item',
                  values: ['2020'], // Should be converted to array
                },
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('getConfig', () => {
    it('should fetch PXWEB configuration successfully', async () => {
      const mockConfig = {
        maxCells: 100000,
        maxCalls: 30,
        timeWindow: 10,
      };

      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockConfig),
      });

      const result = await getConfig('en');

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/en/?config')
      );
      expect(result).toEqual(mockConfig);
    });

    it('should handle API errors gracefully', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Config Error')),
      });

      await expect(getConfig('de')).rejects.toThrow(
        'Failed to fetch PXWEB config: Config Error'
      );
    });

    it('should use default language when not specified', async () => {
      const mockConfig = { maxCells: 100000 };

      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue(mockConfig),
      });

      await getConfig();

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/de/?config')
      );
    });
  });
});
