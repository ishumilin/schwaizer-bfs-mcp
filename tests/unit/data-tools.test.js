import { describe, it, expect, vi } from 'vitest';
import { registerDataTools } from '../../src/tools/data-tools.js';
import * as pxwebClient from '../../src/api/pxweb-client.js';
import * as sseClient from '../../src/api/sse-client.js';

vi.mock('../../src/api/pxweb-client.js');
vi.mock('../../src/api/sse-client.js');

describe('registerDataTools', () => {
  it('should register the get_statistical_data tool and return data', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerDataTools(mockServer);

    const getStatisticalDataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_statistical_data');
    const getStatisticalDataFn = getStatisticalDataTool[3];

    const mockData = {
      "columns": [
        { "code": "Jahr", "text": "Year", "type": "t" },
        { "code": "Demografisches Merkmal und Indikator", "text": "Demographic characteristic and indicator", "type": "d" },
        { "code": "Deaths per month and mortality since 1803", "text": "Deaths per month and mortality since 1803", "type": "c" }
      ],
      "data": [
        { "key": ["2020", "0"], "values": ["76195"] }
      ]
    };
    pxwebClient.getData.mockResolvedValue(mockData);

    const result = await getStatisticalDataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr',
      query: { "Jahr": ["2020"], "Demografisches Merkmal und Indikator": ["0"] },
      format: 'json'
    });

    expect(result.content[0].text).toEqual(JSON.stringify(mockData, null, 2));
    expect(pxwebClient.getData).toHaveBeenCalledWith('test-bfs-nr', 'en', { "Jahr": ["2020"], "Demografisches Merkmal und Indikator": ["0"] }, 'json');
  });

  it('should handle errors when getting statistical data', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerDataTools(mockServer);

    const getStatisticalDataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_statistical_data');
    const getStatisticalDataFn = getStatisticalDataTool[3];

    pxwebClient.getData.mockRejectedValue(new Error('API Error'));

    const result = await getStatisticalDataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr',
      query: { "Jahr": ["2020"] },
      format: 'json'
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting statistical data: API Error');
  });

  it('should handle errors when getting sse data', async () => {
    const mockServer = {
      tool: vi.fn(),
    };

    registerDataTools(mockServer);

    const getSseDataTool = mockServer.tool.mock.calls.find(call => call[0] === 'get_sse_data');
    const getSseDataFn = getSseDataTool[3];

    sseClient.getSseData.mockRejectedValue(new Error('API Error'));

    const result = await getSseDataFn({
      language: 'en',
      numberBfs: 'test-bfs-nr'
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting SSE data: API Error');
  });
});
