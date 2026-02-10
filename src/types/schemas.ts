import { z } from 'zod';

export const QueryDatasetSchema = z.object({
  datasetId: z.string().describe("ID of the dataset to query (e.g., 'C21_G01_LGA')"),
  dataKey: z.string().optional().default("all").describe("Data key for filtering (e.g., '1.AUS.TOT.A')"),
  startPeriod: z.string().optional().describe("Start period (e.g., '2020')"),
  endPeriod: z.string().optional().describe("End period (e.g., '2022')"),
  dimensionAtObservation: z.string().optional().describe("Dimension at observation (e.g., 'AllDimensions')"),
  format: z.enum(['jsondata', 'csvfile', 'csvfilewithlabels', 'genericdata', 'structurespecificdata']).optional().default('jsondata').describe("Response format")
});

export const GetDatasetMetadataSchema = z.object({
  datasetId: z.string().describe("ID of the dataset to get metadata for")
});

export type QueryDatasetArgs = z.infer<typeof QueryDatasetSchema>;
export type GetDatasetMetadataArgs = z.infer<typeof GetDatasetMetadataSchema>;
