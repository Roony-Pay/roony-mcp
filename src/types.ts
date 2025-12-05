/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification (2024-11-05)
 * https://modelcontextprotocol.io
 */

// ============================================
// Core JSON-RPC Types
// ============================================

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================
// Tool Types
// ============================================

export interface MCPToolInputSchema {
  type: "object";
  properties: Record<string, MCPToolProperty>;
  required: string[];
}

export interface MCPToolProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

// ============================================
// Resource Types
// ============================================

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// ============================================
// Prompt Types
// ============================================

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptMessage {
  role: "user" | "assistant";
  content: MCPContent;
}

// ============================================
// Server Capability Types
// ============================================

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

// ============================================
// Client Types
// ============================================

export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, never>;
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

// ============================================
// Standard Methods
// ============================================

export type MCPMethod =
  | "initialize"
  | "initialized"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "resources/subscribe"
  | "resources/unsubscribe"
  | "prompts/list"
  | "prompts/get"
  | "logging/setLevel"
  | "ping";

// ============================================
// Error Codes (JSON-RPC 2.0 + MCP specific)
// ============================================

export const ErrorCodes = {
  // JSON-RPC 2.0 standard errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  
  // MCP specific errors (-32000 to -32099)
  ServerNotInitialized: -32002,
  UnknownErrorCode: -32001,
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// Handler Types
// ============================================

/**
 * Context passed to tool handlers
 */
export interface MCPContext {
  /** Unique identifier for this request */
  requestId: string | number;
  /** Any custom data you want to pass through */
  [key: string]: unknown;
}

/**
 * Tool handler function type
 */
export type MCPToolHandler<TArgs = Record<string, unknown>, TContext = MCPContext> = (
  args: TArgs,
  context: TContext
) => Promise<MCPToolResult> | MCPToolResult;

/**
 * Tool definition with handler
 */
export interface MCPToolDefinition<TArgs = Record<string, unknown>, TContext = MCPContext> {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  handler: MCPToolHandler<TArgs, TContext>;
}

/**
 * Resource handler function type
 */
export type MCPResourceHandler<TContext = MCPContext> = (
  uri: string,
  context: TContext
) => Promise<MCPResourceContent> | MCPResourceContent;

/**
 * Resource definition with handler
 */
export interface MCPResourceDefinition<TContext = MCPContext> {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: MCPResourceHandler<TContext>;
}

/**
 * Prompt handler function type
 */
export type MCPPromptHandler<TContext = MCPContext> = (
  args: Record<string, string>,
  context: TContext
) => Promise<MCPPromptMessage[]> | MCPPromptMessage[];

/**
 * Prompt definition with handler
 */
export interface MCPPromptDefinition<TContext = MCPContext> {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
  handler: MCPPromptHandler<TContext>;
}

// ============================================
// Server Configuration
// ============================================

export interface MCPServerConfig<TContext = MCPContext> {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** MCP protocol version (default: "2024-11-05") */
  protocolVersion?: string;
  /** Tool definitions */
  tools?: MCPToolDefinition<Record<string, unknown>, TContext>[];
  /** Resource definitions */
  resources?: MCPResourceDefinition<TContext>[];
  /** Prompt definitions */
  prompts?: MCPPromptDefinition<TContext>[];
  /** Context factory - called for each request */
  createContext?: (request: MCPRequest) => TContext | Promise<TContext>;
}

