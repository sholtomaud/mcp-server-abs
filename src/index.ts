#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ABSApiClient } from "./services/abs/ABSApiClient.js";
import { DataFlowService } from "./services/abs/DataFlowService.js";
import logger from "./utils/logger.js";
import path from "path";
import { QueryDatasetSchema, GetDatasetMetadataSchema } from "./types/schemas.js";

const CACHE_FILE = path.join(process.cwd(), "data", "cache.json");
const SEED_FILE = path.join(process.cwd(), "dataflows.xml");

const apiClient = new ABSApiClient();
const dataFlowService = new DataFlowService(CACHE_FILE, 24, SEED_FILE);

export const server = new Server(
  {
    name: "abs-mcp-server",
    version: "0.1.0",
    description: "Access Australian Bureau of Statistics (ABS) data"
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

// --- Resources ---

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "abs://dataflows",
        name: "ABS Dataflows",
        description: "List of all available dataflows from the ABS",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  logger.info(`Resource requested: ${uri}`);

  if (uri === "abs://dataflows") {
    try {
      const flows = await dataFlowService.getDataFlows();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(flows, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error(`Error reading dataflows resource: ${error}`);
      throw new McpError(ErrorCode.InternalError, "Failed to fetch dataflows");
    }
  }

  const structureMatch = uri.match(/^abs:\/\/structures\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (structureMatch) {
    const [, structureType, agencyId, id] = structureMatch;
    try {
      const structure = await apiClient.getStructures(structureType, agencyId, id);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(structure, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error(`Error reading structure resource: ${error}`);
      throw new McpError(ErrorCode.InternalError, `Failed to fetch structure ${structureType}/${agencyId}`);
    }
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_dataset",
        description: "Query a specific ABS dataset with optional filters. Returns data in JSON or CSV format.",
        inputSchema: {
          type: "object",
          required: ["datasetId"],
          properties: {
            datasetId: { type: "string", description: "ID of the dataset (e.g., 'C21_G01_LGA')" },
            dataKey: { type: "string", description: "Filter dimensions (e.g., '1.AUS.TOT.A'). Default is 'all'" },
            startPeriod: { type: "string", description: "Start period (e.g., '2020')" },
            endPeriod: { type: "string", description: "End period (e.g., '2022')" },
            dimensionAtObservation: { type: "string", description: "Dimension at observation level" },
            format: {
                type: "string",
                enum: ['jsondata', 'csvfile', 'csvfilewithlabels', 'genericdata', 'structurespecificdata'],
                description: "Format of the response"
            }
          }
        }
      },
      {
        name: "get_dataset_metadata",
        description: "Get metadata for a specific dataset, including its structure, concepts, and codelists.",
        inputSchema: {
          type: "object",
          required: ["datasetId"],
          properties: {
            datasetId: { type: "string", description: "ID of the dataset (e.g., 'CPI')" }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`Tool called: ${name}`, { args });

  try {
    if (name === "query_dataset") {
      const validated = QueryDatasetSchema.parse(args);
      const { datasetId, dataKey, ...options } = validated;

      const data = await dataFlowService.getFlowData(datasetId, dataKey, options);

      return {
        content: [
          {
            type: "text",
            text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          }
        ]
      };
    } else if (name === "get_dataset_metadata") {
      const validated = GetDatasetMetadataSchema.parse(args);
      const metadata = await dataFlowService.getFlowMetadata(validated.datasetId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(metadata, null, 2)
          }
        ]
      };
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in tool ${name}: ${errorMessage}`);

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool: ${errorMessage}`
        }
      ]
    };
  }
});

// --- Prompts ---

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "compare_population",
        description: "Compare population growth between two regions",
        arguments: [
            { name: "region1", description: "First region to compare (e.g. 'Greater Sydney')", required: true },
            { name: "region2", description: "Second region to compare (e.g. 'Greater Melbourne')", required: true }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "compare_population") {
        const region1 = request.params.arguments?.region1 || "Region 1";
        const region2 = request.params.arguments?.region2 || "Region 2";
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `I want to compare the population growth between ${region1} and ${region2}. Please find the relevant ABS datasets (like ERP or Census) and provide a comparison for the last 5 available years.`
                    }
                }
            ]
        };
    }
    throw new McpError(ErrorCode.InvalidRequest, "Unknown prompt");
});

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("ABS MCP Server started successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Server failed to start:", errorMessage);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}