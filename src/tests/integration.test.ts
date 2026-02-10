import { describe, it, expect, beforeAll } from 'vitest';
import { ABSApiClient } from '../services/abs/ABSApiClient.js';
import { DataFlowService } from '../services/abs/DataFlowService.js';
import { handleSnapshot } from './snapshotHelper.js';
import path from 'path';
import fs from 'fs/promises';

describe('ABS API Integration Tests', () => {
    // Increase timeout for integration tests as ABS API can be slow
    const TIMEOUT = 60000;

    let apiClient: ABSApiClient;
    let dataFlowService: DataFlowService;
    const cacheFile = path.join(process.cwd(), 'src', 'tests', 'data', 'integration_cache.json');

    beforeAll(async () => {
        apiClient = new ABSApiClient();
        dataFlowService = new DataFlowService(cacheFile, 24);

        // We no longer unlink the cache file so it can be committed to the repo
    });

    it('should fetch and snapshot dataflows', { timeout: TIMEOUT }, async () => {
        // Raw API call - using allstubs to keep response small
        const rawDataflows = await apiClient.getDataFlows({ detail: 'allstubs' });
        expect(rawDataflows).toBeDefined();

        // Limit to 5 items for snapshot
        if (rawDataflows.Structure?.Structures?.Dataflows?.Dataflow && Array.isArray(rawDataflows.Structure.Structures.Dataflows.Dataflow)) {
            rawDataflows.Structure.Structures.Dataflows.Dataflow = rawDataflows.Structure.Structures.Dataflows.Dataflow.slice(0, 5);
        }

        await handleSnapshot('raw_dataflows', rawDataflows);

        // Processed dataflows - limited to 5
        const processedDataflows = await dataFlowService.getDataFlows(true, { limit: 5, params: { detail: 'allstubs' } });
        expect(processedDataflows.length).toBeGreaterThan(0);
        expect(processedDataflows.length).toBeLessThanOrEqual(5);

        // Basic validation of processed data
        processedDataflows.forEach(flow => {
            expect(flow).toHaveProperty('id');
            expect(flow).toHaveProperty('name');
            expect(flow).toHaveProperty('agencyID');
        });

        await handleSnapshot('processed_dataflows', processedDataflows);
    });

    it('should fetch and snapshot specific dataflow metadata', { timeout: TIMEOUT }, async () => {
        // Use the first flow from our limited list
        const flows = await dataFlowService.getDataFlows();
        const datasetId = flows[0].id;

        const metadata = await dataFlowService.getFlowMetadata(datasetId);
        await handleSnapshot(`metadata_${datasetId}`, metadata);

        expect(metadata).toBeDefined();
    });

    it('should fetch and snapshot small dataset query', { timeout: TIMEOUT }, async () => {
        const flows = await dataFlowService.getDataFlows();
        const datasetId = flows[0].id;
        const dataKey = 'all';

        const data = await dataFlowService.getFlowData(datasetId, dataKey, {
            lastNObservations: 5,
            format: 'jsondata'
        });

        await handleSnapshot(`data_${datasetId}`, data);
        expect(data).toBeDefined();
    });

    it('should snapshot MCP tool output format for query_dataset', { timeout: TIMEOUT }, async () => {
        const flows = await dataFlowService.getDataFlows();
        const datasetId = flows[0].id;
        const data = await dataFlowService.getFlowData(datasetId, 'all', {
            lastNObservations: 5,
            format: 'jsondata'
        });

        // Simulating the MCP tool response structure from src/index.ts
        const mcpToolResponse = {
            content: [
                {
                    type: "text",
                    text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
                }
            ]
        };

        await handleSnapshot(`mcp_response_query_${datasetId}`, mcpToolResponse);
    });

    it('should snapshot MCP resource output format for dataflows', { timeout: TIMEOUT }, async () => {
        const flows = await dataFlowService.getDataFlows();

        // Simulating the MCP resource response structure from src/index.ts
        const mcpResourceResponse = {
            contents: [
                {
                    uri: "abs://dataflows",
                    mimeType: "application/json",
                    text: JSON.stringify(flows, null, 2)
                }
            ]
        };

        await handleSnapshot('mcp_resource_dataflows', mcpResourceResponse);
    });
});
