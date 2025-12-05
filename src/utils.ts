/**
 * Utility functions for building MCP servers
 */

import type {
  MCPToolResult,
  MCPContent,
  MCPToolInputSchema,
  MCPToolProperty,
  MCPToolDefinition,
  MCPToolHandler,
  MCPContext,
} from "./types";

// ============================================
// Result Builders
// ============================================

/**
 * Create a text result
 */
export function textResult(text: string, isError = false): MCPToolResult {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

/**
 * Create a JSON result (stringified with pretty printing)
 */
export function jsonResult(data: unknown, isError = false): MCPToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

/**
 * Create an error result
 */
export function errorResult(message: string): MCPToolResult {
  return textResult(`Error: ${message}`, true);
}

/**
 * Create a result with multiple content items
 */
export function multiResult(items: MCPContent[], isError = false): MCPToolResult {
  return {
    content: items,
    isError,
  };
}

// ============================================
// Schema Builders
// ============================================

type PropertyType = "string" | "number" | "boolean" | "array" | "object";

interface PropertyOptions {
  description: string;
  enum?: string[];
  default?: unknown;
}

/**
 * Create a property definition
 */
export function prop(type: PropertyType, options: PropertyOptions): MCPToolProperty {
  return {
    type,
    description: options.description,
    ...(options.enum && { enum: options.enum }),
    ...(options.default !== undefined && { default: options.default }),
  };
}

/**
 * Create an input schema
 */
export function schema(
  properties: Record<string, MCPToolProperty>,
  required: string[] = []
): MCPToolInputSchema {
  return {
    type: "object",
    properties,
    required,
  };
}

// ============================================
// Tool Builder
// ============================================

interface ToolBuilderOptions<TArgs, TContext> {
  name: string;
  description: string;
  properties: Record<string, MCPToolProperty>;
  required?: string[];
  handler: MCPToolHandler<TArgs, TContext>;
}

/**
 * Define a tool with type-safe handler
 */
export function defineTool<TArgs = Record<string, unknown>, TContext = MCPContext>(
  options: ToolBuilderOptions<TArgs, TContext>
): MCPToolDefinition<TArgs, TContext> {
  return {
    name: options.name,
    description: options.description,
    inputSchema: {
      type: "object",
      properties: options.properties,
      required: options.required || [],
    },
    handler: options.handler,
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate that required arguments are present
 */
export function validateArgs<T extends Record<string, unknown>>(
  args: Record<string, unknown>,
  required: (keyof T)[]
): args is T {
  for (const key of required) {
    if (args[key as string] === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Get a required argument or throw
 */
export function requireArg<T>(
  args: Record<string, unknown>,
  key: string,
  type: "string" | "number" | "boolean"
): T {
  const value = args[key];
  
  if (value === undefined) {
    throw new Error(`Missing required argument: ${key}`);
  }
  
  if (typeof value !== type) {
    throw new Error(`Argument '${key}' must be a ${type}`);
  }
  
  return value as T;
}

/**
 * Get an optional argument with default
 */
export function optionalArg<T>(
  args: Record<string, unknown>,
  key: string,
  defaultValue: T
): T {
  const value = args[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  return value as T;
}

// ============================================
// Request Parsing
// ============================================

/**
 * Parse and validate an incoming MCP request
 */
export function parseMCPRequest(body: unknown): {
  valid: true;
  request: {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
  };
} | {
  valid: false;
  error: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const req = body as Record<string, unknown>;

  if (req.jsonrpc !== "2.0") {
    return { valid: false, error: "Invalid JSON-RPC version" };
  }

  if (typeof req.method !== "string") {
    return { valid: false, error: "Method must be a string" };
  }

  if (req.id === undefined) {
    return { valid: false, error: "Request ID is required" };
  }

  return {
    valid: true,
    request: {
      jsonrpc: "2.0",
      id: req.id as string | number,
      method: req.method,
      params: req.params as Record<string, unknown> | undefined,
    },
  };
}

