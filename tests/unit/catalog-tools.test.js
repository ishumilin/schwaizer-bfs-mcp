import { describe, it, expect, vi } from 'vitest';
import { registerCatalogTools } from '../../src/tools/catalog-tools.js';
import * as damClient from '../../src/api/dam-client.js';

vi.mock('../../src/api/dam-client.js');

describe('registerCatalogTools', () => {
  it('should register the list_themes tool and return a list of themes', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerCatalogTools(mockServer);

    const listThemesTool = mockServer.tool.mock.calls.find(call => call[0] === 'list_themes');
    const listThemesFn = listThemesTool[3];

    const mockThemes = [
      { "name": "Population", "prodima": 900010, "code": "01" },
      { "name": "Territory and environment", "prodima": 900035, "code": "02" }
    ];
    damClient.getThemes.mockReturnValue(mockThemes);

    const result = await listThemesFn({ language: 'en' });

    const expectedContent = {
      totalThemes: mockThemes.length,
      themes: mockThemes,
      note: 'Use the prodima number with search_datasets to filter by theme',
    };

    expect(result.content[0].text).toEqual(JSON.stringify(expectedContent, null, 2));
    expect(damClient.getThemes).toHaveBeenCalled();
  });

  it('should register the search_datasets tool and return a list of datasets', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerCatalogTools(mockServer);

    const searchDatasetsTool = mockServer.tool.mock.calls.find(call => call[0] === 'search_datasets');
    const searchDatasetsFn = searchDatasetsTool[3];

    const mockSearchResults = {
      data: [
        {
          description: {
            titles: { main: 'Test Dataset' },
            language: 'en'
          },
          shop: { orderNr: 'test-bfs-nr' },
          ids: { damId: 'test-asset-id' },
          bfs: { embargo: '2025-01-01' },
        },
      ],
    };
    damClient.searchCatalog.mockResolvedValue(mockSearchResults);

    const result = await searchDatasetsFn({ language: 'en', query: 'test', limit: 50 });

    const expectedContent = {
      totalResults: 1,
      datasets: [
        {
          title: 'Test Dataset',
          numberBfs: 'test-bfs-nr',
          numberAsset: 'test-asset-id',
          publicationDate: '2025-01-01',
          language: 'en',
        },
      ],
    };

    expect(result.content[0].text).toEqual(JSON.stringify(expectedContent, null, 2));
    expect(damClient.searchCatalog).toHaveBeenCalledWith({
      language: 'en',
      extendedSearch: 'test',
      prodima: undefined,
      spatialDivision: undefined,
      publishingYearStart: undefined,
      publishingYearEnd: undefined,
      limit: 50,
    });
  });

  it('should register the get_dataset_info tool and return dataset information', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerCatalogTools(mockServer);

    const getDatasetInfoTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_dataset_info');
    const getDatasetInfoFn = getDatasetInfoTool[3];

    const mockMetadata = {
      description: {
        titles: { main: 'Test Dataset' },
        language: 'en',
        shortSummary: { raw: 'A test dataset' },
        categorization: {
          prodima: [{ text: 'Test Theme' }],
          spatialdivision: [{ text: 'Switzerland' }],
        },
      },
      shop: { orderNr: 'test-bfs-nr' },
      ids: { damId: 'test-asset-id' },
      bfs: { embargo: '2025-01-01' },
      links: [{ rel: 'self', href: 'http://example.com' }],
    };
    damClient.getAssetMetadata.mockResolvedValue(mockMetadata);

    const result = await getDatasetInfoFn({ language: 'en', numberAsset: 'test-asset-id' });

    const expectedContent = {
      title: 'Test Dataset',
      subtitle: null,
      numberBfs: 'test-bfs-nr',
      numberAsset: 'test-asset-id',
      publicationDate: '2025-01-01',
      language: 'en',
      summary: 'A test dataset',
      themes: ['Test Theme'],
      spatialDivisions: ['Switzerland'],
      links: [{ rel: 'self', href: 'http://example.com' }],
    };

    expect(result.content[0].text).toEqual(JSON.stringify(expectedContent, null, 2));
    expect(damClient.getAssetMetadata).toHaveBeenCalledWith('test-asset-id', 'en');
  });

  it('should handle errors when getting dataset info', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerCatalogTools(mockServer);

    const getDatasetInfoTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_dataset_info');
    const getDatasetInfoFn = getDatasetInfoTool[3];

    damClient.getAssetMetadata.mockRejectedValue(new Error('API Error'));

    const result = await getDatasetInfoFn({ language: 'en', numberAsset: 'test-asset-id' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting dataset info: API Error');
  });

  it('should find asset number by BFS number if not provided', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerCatalogTools(mockServer);

    const getDatasetInfoTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_dataset_info');
    const getDatasetInfoFn = getDatasetInfoTool[3];

    const mockSearchResults = {
      data: [{ ids: { damId: 'test-asset-id' } }],
    };
    damClient.searchCatalog.mockResolvedValue(mockSearchResults);

    const mockMetadata = {
      description: {
        titles: { main: 'Test Dataset' },
        language: 'en',
        shortSummary: { raw: 'A test dataset' },
        categorization: {
          prodima: [{ text: 'Test Theme' }],
          spatialdivision: [{ text: 'Switzerland' }],
        },
      },
      shop: { orderNr: 'test-bfs-nr' },
      ids: { damId: 'test-asset-id' },
      bfs: { embargo: '2025-01-01' },
      links: [{ rel: 'self', href: 'http://example.com' }],
    };
    damClient.getAssetMetadata.mockResolvedValue(mockMetadata);

    await getDatasetInfoFn({ language: 'en', numberBfs: 'test-bfs-nr' });

    expect(damClient.searchCatalog).toHaveBeenCalledWith({
      language: 'en',
      orderNr: 'test-bfs-nr',
      limit: 1,
    });
    expect(damClient.getAssetMetadata).toHaveBeenCalledWith('test-asset-id', 'en');
  });
});
