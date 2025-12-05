/**
 * @roony-pay/mcp
 * 
 * Open source MCP (Model Context Protocol) server library
 * for building AI agent tools.
 * 
 * @example
 * ```typescript
 * import { createMCPServer, defineTool, prop, textResult } from "@roony-pay/mcp";
 * 
 * const server = createMCPServer({
 *   name: "my-server",
 *   version: "1.0.0",
 *   tools: [
 *     defineTool({
 *       name: "hello",
 *       description: "Say hello",
 *       properties: {
 *         name: prop("string", { description: "Name to greet" }),
 *       },
 *       required: ["name"],
 *       handler: async (args) => textResult(`Hello, ${args.name}!`),
 *     }),
 *   ],
 * });
 * 
 * // Use with Next.js
 * export async function POST(req: Request) {
 *   const body = await req.json();
 *   const response = await server.handleRequest(body);
 *   return Response.json(response);
 * }
 * ```
 */

// Server
export { MCPServer, createMCPServer } from "./server";

// Types
export type {
  // Core types
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPMethod,
  
  // Tool types
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPToolInputSchema,
  MCPToolProperty,
  MCPToolDefinition,
  MCPToolHandler,
  MCPContent,
  
  // Resource types
  MCPResource,
  MCPResourceContent,
  MCPResourceDefinition,
  MCPResourceHandler,
  
  // Prompt types
  MCPPrompt,
  MCPPromptArgument,
  MCPPromptMessage,
  MCPPromptDefinition,
  MCPPromptHandler,
  
  // Server types
  MCPServerConfig,
  MCPServerCapabilities,
  MCPServerInfo,
  MCPInitializeResult,
  
  // Client types
  MCPClientCapabilities,
  MCPClientInfo,
  
  // Context
  MCPContext,
} from "./types";

export { ErrorCodes } from "./types";

// Utilities
export {
  // Result builders
  textResult,
  jsonResult,
  errorResult,
  multiResult,
  
  // Schema builders
  prop,
  schema,
  defineTool,
  
  // Validation helpers
  validateArgs,
  requireArg,
  optionalArg,
  
  // Request parsing
  parseMCPRequest,
} from "./utils";

