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

        // Ensure cache is clean for integration tests or handled appropriately
        try {
            await fs.unlink(cacheFile);
        } catch (e) {
            // ignore if doesn't exist
        }
    });

    it('should fetch and snapshot dataflows', { timeout: TIMEOUT }, async () => {
        // Raw API call
        const rawDataflows = await apiClient.getDataFlows();
        expect(rawDataflows).toBeDefined();
        await handleSnapshot('raw_dataflows', rawDataflows);

        // Processed dataflows
        const processedDataflows = await dataFlowService.getDataFlows(true);
        expect(processedDataflows.length).toBeGreaterThan(0);

        // Basic validation of processed data
        processedDataflows.forEach(flow => {
            expect(flow).toHaveProperty('id');
            expect(flow).toHaveProperty('name');
            expect(flow).toHaveProperty('agencyID');
        });

        await handleSnapshot('processed_dataflows', processedDataflows);
    });

    it('should fetch and snapshot CPI metadata', { timeout: TIMEOUT }, async () => {
        const datasetId = 'CPI';

        // We need to ensure dataflows are loaded in service first if getFlowMetadata depends on it
        await dataFlowService.getDataFlows();

        const metadata = await dataFlowService.getFlowMetadata(datasetId);
        await handleSnapshot(`metadata_${datasetId}`, metadata);

        expect(metadata).toBeDefined();
    });

    it('should fetch and snapshot small dataset query', { timeout: TIMEOUT }, async () => {
        const datasetId = 'CPI';
        const dataKey = 'all';

        const data = await dataFlowService.getFlowData(datasetId, dataKey, {
            startPeriod: '2023-Q1',
            endPeriod: '2023-Q1',
            format: 'jsondata'
        });

        await handleSnapshot(`data_${datasetId}`, data);
        expect(data).toBeDefined();
    });
});
