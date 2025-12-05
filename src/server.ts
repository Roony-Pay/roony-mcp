/**
 * MCP Server Implementation
 * 
 * A flexible, generic MCP server that can be used with any framework.
 */

import type {
  MCPRequest,
  MCPResponse,
  MCPServerConfig,
  MCPInitializeResult,
  MCPToolResult,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPContext,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  MCPResourceContent,
  MCPPromptMessage,
} from "./types";
import { ErrorCodes } from "./types";
import { parseMCPRequest, errorResult } from "./utils";

const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

/**
 * MCP Server class
 * 
 * @example
 * ```typescript
 * const server = new MCPServer({
 *   name: "my-server",
 *   version: "1.0.0",
 *   tools: [myTool],
 * });
 * 
 * // Handle a request
 * const response = await server.handleRequest(request);
 * ```
 */
export class MCPServer<TContext = MCPContext> {
  private config: MCPServerConfig<TContext>;
  private tools: Map<string, MCPToolDefinition<Record<string, unknown>, TContext>>;
  private resources: Map<string, MCPResourceDefinition<TContext>>;
  private prompts: Map<string, MCPPromptDefinition<TContext>>;

  constructor(config: MCPServerConfig<TContext>) {
    this.config = {
      ...config,
      protocolVersion: config.protocolVersion || DEFAULT_PROTOCOL_VERSION,
    };

    // Index tools by name
    this.tools = new Map();
    for (const tool of config.tools || []) {
      this.tools.set(tool.name, tool);
    }

    // Index resources by URI
    this.resources = new Map();
    for (const resource of config.resources || []) {
      this.resources.set(resource.uri, resource);
    }

    // Index prompts by name
    this.prompts = new Map();
    for (const prompt of config.prompts || []) {
      this.prompts.set(prompt.name, prompt);
    }
  }

  /**
   * Handle an incoming MCP request
   */
  async handleRequest(body: unknown): Promise<MCPResponse> {
    const parsed = parseMCPRequest(body);

    if (!parsed.valid) {
      return this.createErrorResponse(
        null,
        ErrorCodes.ParseError,
        parsed.error
      );
    }

    const request = parsed.request;

    try {
      return await this.routeRequest(request);
    } catch (error) {
      console.error("MCP Server Error:", error);
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  }

  /**
   * Handle a raw JSON string request
   */
  async handleRawRequest(json: string): Promise<string> {
    try {
      const body = JSON.parse(json);
      const response = await this.handleRequest(body);
      return JSON.stringify(response);
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        null,
        ErrorCodes.ParseError,
        "Invalid JSON"
      );
      return JSON.stringify(errorResponse);
    }
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request);

      case "initialized":
        return this.handleInitialized(request);

      case "ping":
        return this.handlePing(request);

      case "tools/list":
        return this.handleToolsList(request);

      case "tools/call":
        return await this.handleToolsCall(request);

      case "resources/list":
        return this.handleResourcesList(request);

      case "resources/read":
        return await this.handleResourcesRead(request);

      case "prompts/list":
        return this.handlePromptsList(request);

      case "prompts/get":
        return await this.handlePromptsGet(request);

      default:
        return this.createErrorResponse(
          request.id,
          ErrorCodes.MethodNotFound,
          `Method not found: ${request.method}`
        );
    }
  }

  // ============================================
  // Protocol Handlers
  // ============================================

  private handleInitialize(request: MCPRequest): MCPResponse {
    const result: MCPInitializeResult = {
      protocolVersion: this.config.protocolVersion!,
      capabilities: {
        tools: this.tools.size > 0 ? { listChanged: false } : undefined,
        resources: this.resources.size > 0
          ? { subscribe: false, listChanged: false }
          : undefined,
        prompts: this.prompts.size > 0 ? { listChanged: false } : undefined,
      },
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
    };

    return this.createSuccessResponse(request.id, result);
  }

  private handleInitialized(request: MCPRequest): MCPResponse {
    return this.createSuccessResponse(request.id, {});
  }

  private handlePing(request: MCPRequest): MCPResponse {
    return this.createSuccessResponse(request.id, {});
  }

  // ============================================
  // Tool Handlers
  // ============================================

  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools: MCPTool[] = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    return this.createSuccessResponse(request.id, { tools });
  }

  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as
      | { name: string; arguments?: Record<string, unknown> }
      | undefined;

    if (!params?.name) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InvalidParams,
        "Missing tool name"
      );
    }

    const tool = this.tools.get(params.name);

    if (!tool) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.MethodNotFound,
        `Unknown tool: ${params.name}`
      );
    }

    // Create context
    const context = await this.createContext(request);

    // Execute handler
    let result: MCPToolResult;
    try {
      result = await tool.handler(params.arguments || {}, context);
    } catch (error) {
      result = errorResult(
        error instanceof Error ? error.message : "Tool execution failed"
      );
    }

    return this.createSuccessResponse(request.id, result);
  }

  // ============================================
  // Resource Handlers
  // ============================================

  private handleResourcesList(request: MCPRequest): MCPResponse {
    const resources: MCPResource[] = Array.from(this.resources.values()).map(
      (r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })
    );

    return this.createSuccessResponse(request.id, { resources });
  }

  private async handleResourcesRead(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as { uri: string } | undefined;

    if (!params?.uri) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InvalidParams,
        "Missing resource URI"
      );
    }

    const resource = this.resources.get(params.uri);

    if (!resource) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InvalidParams,
        `Unknown resource: ${params.uri}`
      );
    }

    // Create context
    const context = await this.createContext(request);

    // Execute handler
    let content: MCPResourceContent;
    try {
      content = await resource.handler(params.uri, context);
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : "Resource read failed"
      );
    }

    return this.createSuccessResponse(request.id, { contents: [content] });
  }

  // ============================================
  // Prompt Handlers
  // ============================================

  private handlePromptsList(request: MCPRequest): MCPResponse {
    const prompts: MCPPrompt[] = Array.from(this.prompts.values()).map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));

    return this.createSuccessResponse(request.id, { prompts });
  }

  private async handlePromptsGet(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as
      | { name: string; arguments?: Record<string, string> }
      | undefined;

    if (!params?.name) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InvalidParams,
        "Missing prompt name"
      );
    }

    const prompt = this.prompts.get(params.name);

    if (!prompt) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InvalidParams,
        `Unknown prompt: ${params.name}`
      );
    }

    // Create context
    const context = await this.createContext(request);

    // Execute handler
    let messages: MCPPromptMessage[];
    try {
      messages = await prompt.handler(params.arguments || {}, context);
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : "Prompt get failed"
      );
    }

    return this.createSuccessResponse(request.id, {
      description: prompt.description,
      messages,
    });
  }

  // ============================================
  // Context & Response Helpers
  // ============================================

  private async createContext(request: MCPRequest): Promise<TContext> {
    if (this.config.createContext) {
      return await this.config.createContext(request);
    }

    // Default context
    return {
      requestId: request.id,
    } as TContext;
  }

  private createSuccessResponse(
    id: string | number | null,
    result: unknown
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: id ?? 0,
      result,
    };
  }

  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: id ?? 0,
      error: {
        code,
        message,
      },
    };
  }

  // ============================================
  // Dynamic Registration (for runtime changes)
  // ============================================

  /**
   * Add a tool at runtime
   */
  addTool(tool: MCPToolDefinition<Record<string, unknown>, TContext>): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Remove a tool at runtime
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Add a resource at runtime
   */
  addResource(resource: MCPResourceDefinition<TContext>): void {
    this.resources.set(resource.uri, resource);
  }

  /**
   * Remove a resource at runtime
   */
  removeResource(uri: string): boolean {
    return this.resources.delete(uri);
  }

  /**
   * Add a prompt at runtime
   */
  addPrompt(prompt: MCPPromptDefinition<TContext>): void {
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * Remove a prompt at runtime
   */
  removePrompt(name: string): boolean {
    return this.prompts.delete(name);
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; protocolVersion: string } {
    return {
      name: this.config.name,
      version: this.config.version,
      protocolVersion: this.config.protocolVersion!,
    };
  }
}

/**
 * Create an MCP server with the given configuration
 * 
 * @example
 * ```typescript
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
 *       handler: async (args) => {
 *         return textResult(`Hello, ${args.name}!`);
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function createMCPServer<TContext = MCPContext>(
  config: MCPServerConfig<TContext>
): MCPServer<TContext> {
  return new MCPServer(config);
}

