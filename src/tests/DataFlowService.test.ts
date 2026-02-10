import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { ABSApiClient } from '../services/abs/ABSApiClient.js';
import { DataFlowService } from '../services/abs/DataFlowService.js';

vi.mock('fs/promises');
vi.mock('../services/abs/ABSApiClient.js', () => {
  return {
    ABSApiClient: class {
        getDataFlows = vi.fn();
        getData = vi.fn();
        getDataFlow = vi.fn();
        parseXml = vi.fn();
    }
  };
});
vi.mock('../../utils/logger.js');

describe('DataFlowService', () => {
    let service: DataFlowService;
    let mockApiClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new DataFlowService('test-cache.json', 24, 'test-seed.xml');
        // @ts-ignore
        mockApiClient = service.apiClient;
    });

    it('should load from cache if available', async () => {
        const mockCache = {
            lastUpdated: new Date().toISOString(),
            flows: [{ id: 'TEST', name: 'Test Flow', agencyID: 'ABS', version: '1.0.0' }]
        };
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCache));

        const flows = await service.getDataFlows();
        expect(flows).toHaveLength(1);
        expect(flows[0].id).toBe('TEST');
        expect(fs.readFile).toHaveBeenCalledWith('test-cache.json', 'utf8');
    });

    it('should load from seed if cache is missing', async () => {
        vi.mocked(fs.readFile)
            .mockRejectedValueOnce({ code: 'ENOENT' } as any) // cache
            .mockResolvedValueOnce('<XML>seed data</XML>'); // seed

        mockApiClient.parseXml.mockReturnValue({
            Structure: {
                Dataflows: {
                    Dataflow: { id: 'SEED', Name: { _text: 'Seed Flow' }, agencyID: 'ABS', version: '1.0.0' }
                }
            }
        });

        const flows = await service.getDataFlows();
        expect(flows).toHaveLength(1);
        expect(flows[0].id).toBe('SEED');
        expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should fetch from API if cache is invalid', async () => {
        const oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 48);
        const mockCache = {
            lastUpdated: oldDate.toISOString(),
            flows: [{ id: 'OLD', name: 'Old Flow', agencyID: 'ABS', version: '1.0.0' }]
        };
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCache));

        mockApiClient.getDataFlows.mockResolvedValue({
            Structure: {
                Dataflows: {
                    Dataflow: { id: 'NEW', Name: { _text: 'New Flow' }, agencyID: 'ABS', version: '1.0.0' }
                }
            }
        });

        const flows = await service.getDataFlows();
        expect(flows).toHaveLength(1);
        expect(flows[0].id).toBe('NEW');
    });
});
