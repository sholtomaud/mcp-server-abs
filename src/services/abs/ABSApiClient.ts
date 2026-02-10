import axios, { AxiosInstance } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import logger from '../../utils/logger.js';
import { DetailLevel, ReferenceScope, DataFormat, DataQueryOptions, ABSError } from '../../types/abs.js';

export class ABSApiClient {
    private readonly api: AxiosInstance;
    private readonly xmlParser: XMLParser;

    constructor() {
        this.api = axios.create({
            baseURL: 'https://data.api.abs.gov.au',
            timeout: 30000, // 30 seconds
            headers: {
                'Accept': 'application/xml'
            }
        });

        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            textNodeName: '_text',
            removeNSPrefix: true
        });

        // Add response interceptor for logging
        this.api.interceptors.response.use(
            (response) => {
                logger.debug('API Response received', {
                    url: response.config.url,
                    status: response.status,
                    dataSize: response.data?.length
                });
                return response;
            },
            (error) => {
                this.handleError(error);
                throw error;
            }
        );
    }

    async getDataFlows(params?: any) {
        logger.info('Fetching dataflows from ABS API', { params });

        const response = await this.api.get('/rest/dataflow', {
            params,
            headers: {
                'Accept': 'application/vnd.sdmx.structure+xml;version=2.1'
            }
        });

        return this.xmlParser.parse(response.data);
    }

    async getDataFlow(agencyId: string, id: string, version: string = 'latest') {
        logger.info('Fetching specific dataflow from ABS API', { agencyId, id, version });

        const response = await this.api.get(`/rest/dataflow/${agencyId}/${id}/${version}`, {
            headers: {
                'Accept': 'application/vnd.sdmx.structure+xml;version=2.1'
            },
            params: {
                references: 'all',
                detail: 'full'
            }
        });

        return this.xmlParser.parse(response.data);
    }

    async getStructures(
        structureType: string,
        agencyId: string = 'ABS',
        id: string = 'all',
        version: string = 'latest',
        detail?: DetailLevel,
        references?: ReferenceScope
    ) {
        logger.info('Fetching structures from ABS API', {
            structureType,
            agencyId,
            id,
            version,
            detail,
            references
        });

        const response = await this.api.get(`/rest/${structureType}/${agencyId}/${id}/${version}`, {
            params: {
                detail,
                references
            }
        });

        return this.xmlParser.parse(response.data);
    }

    parseXml(xmlData: string) {
        return this.xmlParser.parse(xmlData);
    }

    async getData(
        dataflowId: string,
        dataKey: string = 'all',
        options?: DataQueryOptions
    ) {
        logger.info('Fetching data from ABS API', {
            dataflowId,
            dataKey,
            options
        });

        const response = await this.api.get(`/rest/data/${dataflowId}/${dataKey}`, {
            params: {
                ...options,
                format: options?.format || 'jsondata'
            },
            headers: {
                'Accept': this.getAcceptHeader(options?.format)
            }
        });

        if (options?.format?.startsWith('csv')) {
            return response.data;
        }

        if (options?.format === 'jsondata' || (typeof response.data === 'object' && response.data !== null)) {
            return response.data;
        }

        return this.xmlParser.parse(response.data);
    }

    private getAcceptHeader(format?: DataFormat): string {
        switch (format) {
            case 'csvfile':
            case 'csvfilewithlabels':
                return 'text/csv';
            case 'jsondata':
                return 'application/vnd.sdmx.data+json';
            case 'genericdata':
                return 'application/xml';
            case 'structurespecificdata':
                return 'application/vnd.sdmx.structurespecificdata+xml';
            default:
                return 'application/xml';
        }
    }

    private handleError(error: any): never {
        const absError: ABSError = new Error('ABS API Error');
        
        if (axios.isAxiosError(error)) {
            absError.message = error.message;
            absError.status = error.response?.status;
            absError.statusText = error.response?.statusText;
            absError.url = error.config?.url;

            logger.error('ABS API Error', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                message: error.message
            });
        } else {
            absError.message = error.message || 'Unknown error';
            logger.error('Unknown API Error', { error });
        }

        throw absError;
    }
}