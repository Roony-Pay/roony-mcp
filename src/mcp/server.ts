/**
 * Roony MCP Server
 * 
 * MCP (Model Context Protocol) server for AI agent payment governance.
 */

import type {
  MCPRequest,
  MCPResponse,
  MCPToolResult,
} from "../types";
import { MCPErrorCodes } from "../types";
import { ROONY_TOOLS, type RoonyToolName } from "./tools";
import {
  handleRequestPurchase,
  handleCheckBudget,
  handleListTransactions,
  handleGetPolicyInfo,
  type HandlerContext,
} from "./handlers";
import type { StorageProvider } from "../providers/storage-provider";
import type { PaymentProvider } from "../providers/payment-provider";
import { SpendingChecker } from "../governance/spending-checker";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "roony-governance";
const SERVER_VERSION = "1.0.0";

export interface RoonyMCPServerConfig {
  storage: StorageProvider;
  paymentProvider: PaymentProvider;
}

export class RoonyMCPServer {
  private storage: StorageProvider;
  private paymentProvider: PaymentProvider;
  private spendingChecker: SpendingChecker;
  
  constructor(config: RoonyMCPServerConfig) {
    this.storage = config.storage;
    this.paymentProvider = config.paymentProvider;
    this.spendingChecker = new SpendingChecker({ storage: config.storage });
  }
  
  /**
   * Handle an MCP request for a specific agent
   */
  async handleRequest(
    request: MCPRequest,
    agentId: string,
    organizationId: string
  ): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        
        case "initialized":
          return this.handleInitialized(request);
        
        case "tools/list":
          return this.handleToolsList(request);
        
        case "tools/call":
          return await this.handleToolsCall(request, agentId, organizationId);
        
        case "resources/list":
          return this.handleResourcesList(request);
        
        case "prompts/list":
          return this.handlePromptsList(request);
        
        default:
          return this.errorResponse(
            request.id,
            MCPErrorCodes.MethodNotFound,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      console.error("MCP Server Error:", error);
      return this.errorResponse(
        request.id,
        MCPErrorCodes.InternalError,
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  }
  
  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      },
    };
  }
  
  private handleInitialized(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {},
    };
  }
  
  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: ROONY_TOOLS,
      },
    };
  }
  
  private async handleToolsCall(
    request: MCPRequest,
    agentId: string,
    organizationId: string
  ): Promise<MCPResponse> {
    const params = request.params as
      | { name: string; arguments?: Record<string, unknown> }
      | undefined;
    
    if (!params?.name) {
      return this.errorResponse(
        request.id,
        MCPErrorCodes.InvalidParams,
        "Missing tool name"
      );
    }
    
    const toolName = params.name as RoonyToolName;
    const toolArgs = params.arguments || {};
    
    const context: HandlerContext = {
      agentId,
      organizationId,
      storage: this.storage,
      paymentProvider: this.paymentProvider,
      spendingChecker: this.spendingChecker,
    };
    
    let result: MCPToolResult;
    
    switch (toolName) {
      case "request_purchase":
        result = await handleRequestPurchase(toolArgs, context);
        break;
      
      case "check_budget":
        result = await handleCheckBudget(toolArgs, context);
        break;
      
      case "list_transactions":
        result = await handleListTransactions(toolArgs, context);
        break;
      
      case "get_policy_info":
        result = await handleGetPolicyInfo(context);
        break;
      
      default:
        return this.errorResponse(
          request.id,
          MCPErrorCodes.MethodNotFound,
          `Unknown tool: ${params.name}`
        );
    }
    
    return {
      jsonrpc: "2.0",
      id: request.id,
      result,
    };
  }
  
  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { resources: [] },
    };
  }
  
  private handlePromptsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { prompts: [] },
    };
  }
  
  private errorResponse(
    id: string | number,
    code: number,
    message: string
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
  }
}

/**
 * Parse and validate an incoming MCP request
 */
export function parseMCPRequest(body: unknown): MCPRequest | null {
  if (!body || typeof body !== "object") return null;
  
  const req = body as Record<string, unknown>;
  
  if (req.jsonrpc !== "2.0") return null;
  if (typeof req.method !== "string") return null;
  if (req.id === undefined) return null;
  
  return {
    jsonrpc: "2.0",
    id: req.id as string | number,
    method: req.method,
    params: req.params as Record<string, unknown> | undefined,
  };
}

/**
 * Create a Roony MCP server
 */
export function createRoonyMCPServer(config: RoonyMCPServerConfig): RoonyMCPServer {
  return new RoonyMCPServer(config);
}

