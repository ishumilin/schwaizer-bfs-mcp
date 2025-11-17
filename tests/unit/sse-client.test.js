import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSseMetadata, getSseData } from '../../src/api/sse-client.js';

// Mock xml2js
vi.mock('xml2js', () => ({
  parseStringPromise: vi.fn(),
}));

// Mock sleep function to avoid delays in tests
vi.mock('../../src/utils/formatting.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock global fetch
global.fetch = vi.fn();

// Import parseStringPromise after mocking
import { parseStringPromise } from 'xml2js';

describe('sse-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSseMetadata', () => {
    it('should fetch and parse SSE metadata successfully', async () => {
      // Mock dataflow list response
      const dataflowResponse = {
        references: {
          'urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=BFS:DF_TEST_1(1.0)': {},
        },
      };

      // Mock metadata XML response
      const metadataXml = '<message:Structure></message:Structure>';
      
      const parsedMetadata = {
        'message:Structure': {
          'message:Structures': [{
            'structure:DataStructures': [{
              'structure:DataStructure': [{
                'structure:DataStructureComponents': [{
                  'structure:DimensionList': [{
                    'structure:Dimension': [
                      {
                        $: { id: 'GEO', position: '0' },
                        'structure:LocalRepresentation': [{
                          'structure:Enumeration': [{
                            'Ref': [{ $: { id: 'CL_GEO' } }],
                          }],
                        }],
                      },
                    ],
                  }],
                }],
              }],
            }],
            'structure:Codelists': [{
              'structure:Codelist': [
                {
                  $: { id: 'CL_GEO' },
                  'common:Name': [{ $: { 'xml:lang': 'en' }, _: 'Geography' }],
                  'structure:Code': [
                    {
                      $: { id: 'CH' },
                      'common:Name': [{ $: { 'xml:lang': 'en' }, _: 'Switzerland' }],
                    },
                  ],
                },
              ],
            }],
          }],
        },
      };

      // Mock fetch calls
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(dataflowResponse),
          text: vi.fn().mockResolvedValue(JSON.stringify(dataflowResponse)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
          text: vi.fn().mockResolvedValue(metadataXml),
        });

      parseStringPromise.mockResolvedValue(parsedMetadata);

      const result = await getSseMetadata('DF_TEST_1', 'en');

      expect(result).toEqual([
        {
          code: 'GEO',
          text: 'Geography',
          value: 'CH',
          valueText: 'Switzerland',
          position_dimension: 0,
        },
      ]);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
        json: vi.fn().mockRejectedValue(new Error('Internal Server Error')),
      });

      await expect(getSseMetadata('DF_TEST_1', 'en')).rejects.toThrow(
        'Failed to fetch SSE metadata'
      );
    });
  });

  describe('getSseData', () => {
    it('should fetch SSE data successfully', async () => {
      // Mock dataflow list response
      const dataflowResponse = {
        references: {
          'urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=BFS:DF_TEST_1(1.0)': {},
        },
      };

      // Mock metadata for getSseMetadata call
      const metadataXml = '<message:Structure></message:Structure>';
      const parsedMetadata = {
        'message:Structure': {
          'message:Structures': [{
            'structure:DataStructures': [{
              'structure:DataStructure': [{
                'structure:DataStructureComponents': [{
                  'structure:DimensionList': [{
                    'structure:Dimension': [
                      {
                        $: { id: 'GEO', position: '0' },
                        'structure:LocalRepresentation': [{
                          'structure:Enumeration': [{
                            'Ref': [{ $: { id: 'CL_GEO' } }],
                          }],
                        }],
                      },
                    ],
                  }],
                }],
              }],
            }],
            'structure:Codelists': [{
              'structure:Codelist': [
                {
                  $: { id: 'CL_GEO' },
                  'common:Name': [{ $: { 'xml:lang': 'en' }, _: 'Geography' }],
                  'structure:Code': [
                    {
                      $: { id: 'CH' },
                      'common:Name': [{ $: { 'xml:lang': 'en' }, _: 'Switzerland' }],
                    },
                  ],
                },
              ],
            }],
          }],
        },
      };

      // Mock data XML response
      const dataXml = '<message:GenericData></message:GenericData>';
      const parsedData = {
        'message:GenericData': {
          'message:DataSet': [
            {
              'generic:Obs': [
                {
                  'generic:ObsKey': [{
                    'generic:Value': [
                      { $: { id: 'GEO', value: 'CH' } },
                    ],
                  }],
                  'generic:ObsValue': [{ $: { value: '100.5' } }],
                },
              ],
            },
          ],
        },
      };

      // Mock fetch calls: dataflow, metadata, data
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(dataflowResponse),
          text: vi.fn().mockResolvedValue(JSON.stringify(dataflowResponse)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
          text: vi.fn().mockResolvedValue(metadataXml),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
          text: vi.fn().mockResolvedValue(dataXml),
        });

      parseStringPromise
        .mockResolvedValueOnce(parsedMetadata)
        .mockResolvedValueOnce(parsedData);

      const result = await getSseData('DF_TEST_1', 'en');

      expect(result).toEqual([
        {
          GEO: 'Switzerland',
          value: 100.5,
        },
      ]);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Not Found'),
        json: vi.fn().mockRejectedValue(new Error('Not Found')),
      });

      await expect(getSseData('DF_TEST_1', 'en')).rejects.toThrow(
        'HTTP 404'
      );
    });
  });
});
