import { describe, it, expect, vi } from 'vitest';
import { registerMetadataTools } from '../../src/tools/metadata-tools.js';
import * as pxwebClient from '../../src/api/pxweb-client.js';
import * as sseClient from '../../src/api/sse-client.js';

vi.mock('../../src/api/pxweb-client.js');
vi.mock('../../src/api/sse-client.js');

describe('registerMetadataTools', () => {
  it('should register the get_dataset_metadata tool and return metadata', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerMetadataTools(mockServer);

    const getDatasetMetadataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_dataset_metadata');
    const getDatasetMetadataFn = getDatasetMetadataTool[3];

    const mockMetadata = {
      "title": "Test Dataset",
      "updated": "N/A",
      "source": "BFS",
      "note": null,
      "variables": [
        { "code": "Jahr", "text": "Year", "valueCount": 2, "values": ["2020", "2021"], "valueTexts": ["2020", "2021"], "time": false, "elimination": false }
      ]
    };
    pxwebClient.getMetadata.mockResolvedValue(mockMetadata);

    const result = await getDatasetMetadataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr'
    });

    expect(result.content[0].text).toEqual(JSON.stringify(mockMetadata, null, 2));
    expect(pxwebClient.getMetadata).toHaveBeenCalledWith('test-bfs-nr', 'en');
  });

  it('should handle errors when getting dataset metadata', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerMetadataTools(mockServer);

    const getDatasetMetadataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_dataset_metadata');
    const getDatasetMetadataFn = getDatasetMetadataTool[3];

    pxwebClient.getMetadata.mockRejectedValue(new Error('API Error'));

    const result = await getDatasetMetadataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr'
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting dataset metadata: API Error');
  });

  it('should handle errors when getting sse metadata', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerMetadataTools(mockServer);

    const getSseMetadataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_sse_metadata');
    const getSseMetadataFn = getSseMetadataTool[3];

    sseClient.getSseMetadata.mockRejectedValue(new Error('API Error'));

    const result = await getSseMetadataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr'
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting SSE metadata: API Error');
  });
});
