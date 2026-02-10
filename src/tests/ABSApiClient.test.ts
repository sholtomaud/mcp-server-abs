import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ABSApiClient } from '../services/abs/ABSApiClient.js';

vi.mock('axios', () => {
    const mockAxiosInstance = {
        interceptors: {
            response: { use: vi.fn() }
        },
        get: vi.fn()
    };
    return {
        default: {
            create: vi.fn(() => mockAxiosInstance),
            isAxiosError: vi.fn().mockReturnValue(false)
        }
    };
});

describe('ABSApiClient', () => {
    let client: ABSApiClient;
    let mockAxiosInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new ABSApiClient();
        mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
    });

    it('should be initialized correctly', () => {
        expect(client).toBeDefined();
        expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
            baseURL: 'https://data.api.abs.gov.au'
        }));
    });

    it('should fetch dataflows', async () => {
        const mockData = '<Structure><Dataflows><Dataflow id="TEST"/></Dataflows></Structure>';
        mockAxiosInstance.get.mockResolvedValue({ data: mockData });

        const result = await client.getDataFlows();
        expect(result).toBeDefined();
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rest/dataflow', expect.any(Object));
    });

    it('should fetch specific dataflow', async () => {
        const mockData = '<Structure><Dataflows><Dataflow id="TEST"/></Dataflows></Structure>';
        mockAxiosInstance.get.mockResolvedValue({ data: mockData });

        const result = await client.getDataFlow('ABS', 'TEST', '1.0.0');
        expect(result).toBeDefined();
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rest/dataflow/ABS/TEST/1.0.0', expect.any(Object));
    });

    it('should fetch data', async () => {
        const mockData = { data: 'some data' };
        mockAxiosInstance.get.mockResolvedValue({ data: mockData });

        const result = await client.getData('TEST_FLOW');
        expect(result).toBeDefined();
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rest/data/TEST_FLOW/all', expect.any(Object));
    });
});
