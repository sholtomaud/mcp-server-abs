# Peer Review Report: ABS MCP Server

## Executive Summary

The ABS MCP Server project shows a strong foundation with a well-designed service layer and a clear understanding of the target Australian Bureau of Statistics (ABS) API. However, there is a significant discrepancy between the current entry point (`src/index.ts`) and the architectural intent described in the documentation and service files.

To achieve a "best in class" implementation, the server needs to bridge this gap, leverage more advanced MCP features (Resources and Prompts), and improve its AI-facing documentation.

---

## 1. Architecture & Implementation Analysis

### The "Implementation Gap"
The most critical finding is that `src/index.ts` currently provides a minimal implementation that bypasses the logic found in `src/services/`.
- **Current State**: `index.ts` uses `axios` directly to fetch JSON data for a hardcoded URL pattern. It ignores the `ABSApiClient` and `DataFlowService`.
- **Intended State**: The README and `src/services/` suggest a system that uses `fast-xml-parser` to handle SDMX-ML, implements a 24-hour file-based cache for dataflows, and uses a structured logging system.

### Service Layer Quality
- **`ABSApiClient.ts`**: Excellent use of Axios instances and interceptors. The error handling is centralized, and the use of `fast-xml-parser` is appropriate for the SDMX-ML format.
- **`DataFlowService.ts`**: Implements a robust caching pattern. This is essential for a "best in class" server to avoid hitting rate limits and provide faster responses to the LLM.

---

## 2. MCP Protocol Best Practices

### Tools vs. Resources
Currently, the server only implements a single tool: `query_dataset`.
- **Recommendation**: The list of available dataflows (currently handled by `DataFlowService`) should be exposed as **MCP Resources**. This allows the AI to browse available datasets without executing a tool, which is more tokens-efficient and provides better context discovery.
- **Resource URIs**: Implement URIs like `abs://dataflows` and `abs://structures/{agencyId}`.

### AI-Friendliness
The tool definition for `query_dataset` is functional but sparse.
- **Improvement**: Add more descriptive text to `inputSchema`. For example, providing example `datasetId`s in the description helps the LLM understand the expected format (e.g., "C21_G01_LGA").
- **Parameterization**: The ABS API supports many filters (start/end periods, dimensions). These should be exposed as optional tool arguments instead of hardcoding `all?format=json`.

### Error Handling
- The server uses basic `try-catch` blocks.
- **Best Practice**: Map specific API errors to MCP Error codes. Use the `ABSError` type consistently across the application.

---

## 3. Code Quality & TypeScript

### Type Safety
- The project has a good `types/abs.ts` file, but it is underutilized in the main server loop.
- **Recommendation**: Use `Zod` or similar libraries for runtime schema validation of tool arguments, which integrates well with MCP's `inputSchema`.

### Modern Patterns
- The project uses ES Modules correctly (`"type": "module"` and `.js` extensions in imports).
- **Logging**: The `winston` logger in `utils/logger.ts` is well-configured (file rotation, colorized console) but is currently unused in the main entry point. All server events should flow through this logger.

---

## 4. Testing Strategy

The repository currently lacks any automated tests. A "best in class" implementation requires:
1.  **Unit Tests**: For the `ABSApiClient` (mocking Axios) and `DataFlowService` (mocking the filesystem).
2.  **Integration Tests**: Using the MCP SDK's testing utilities to verify that `CallToolRequest` returns the expected structure.
3.  **Schema Validation Tests**: Ensuring the ABS API responses match the TypeScript interfaces defined in `abs.ts`.

---

## 5. Actionable Recommendations

### Phase 1: Harmonization (Immediate)
1.  **Refactor `index.ts`**: Replace direct `axios` calls with `DataFlowService` and `ABSApiClient`.
2.  **Enable Logging**: Ensure `index.ts` uses the centralized Winston logger.
3.  **Integrate Cache**: Initialize the `DataFlowService` with the local `dataflows.xml` as a seed.

### Phase 2: Feature Enhancement
1.  **Implement Resources**: Expose `getDataFlows()` as a resource.
2.  **Expand Tools**: Add tools for metadata discovery (e.g., `get_dataset_metadata`).
3.  **Implement Prompts**: Create standard prompts for common ABS queries, such as "Compare population growth between two regions."

### Phase 3: Robustness
1.  **Add Vitest/Jest**: Implement at least 80% coverage for the service layer.
2.  **CI/CD**: Add a GitHub Action to run linting (`eslint`) and tests on every push.

---

## Conclusion

The project has the "bones" of a professional MCP server. By moving the logic from the service layer into the MCP handlers and following the protocol's patterns for resources and prompts, it will become a model implementation for data-heavy MCP servers.
