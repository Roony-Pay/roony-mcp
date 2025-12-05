/**
 * Roony Governance
 * 
 * Open source AI agent payment governance engine.
 * 
 * Features:
 * - Spending limits (per-transaction, daily, monthly)
 * - Merchant allow/block lists
 * - Organization-wide guardrails
 * - Human approval workflows
 * - MCP (Model Context Protocol) support
 * - Virtual card issuance
 * 
 * @example
 * ```typescript
 * import {
 *   createRoonyMCPServer,
 *   InMemoryStorageProvider,
 *   MockPaymentProvider,
 * } from "@roony-pay/governance";
 * 
 * // Create providers
 * const storage = new InMemoryStorageProvider();
 * const payments = new MockPaymentProvider();
 * 
 * // Create MCP server
 * const mcpServer = createRoonyMCPServer({
 *   storage,
 *   paymentProvider: payments,
 * });
 * 
 * // Handle MCP request
 * const response = await mcpServer.handleRequest(
 *   request,
 *   agentId,
 *   organizationId
 * );
 * ```
 * 
 * For production, implement your own StorageProvider and PaymentProvider,
 * or use the hosted Roony service at https://roony.pay
 */

// Core types
export type {
  // Agents & Organizations
  Agent,
  Organization,
  OrgGuardrails,
  
  // Purchases
  PurchaseRequest,
  PurchaseIntent,
  PurchaseStatus,
  
  // Spending checks
  SpendingCheckRequest,
  SpendingCheckResult,
  RejectionCode,
  
  // Virtual cards
  VirtualCard,
  VirtualCardRequest,
  
  // Approvals
  PendingApproval,
  ApprovalReason,
  
  // Budget
  BudgetUtilization,
  AgentBudget,
  
  // MCP
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTool,
  MCPToolProperty,
  MCPToolResult,
} from "./types";

export { MCPErrorCodes } from "./types";

// Governance
export {
  SpendingChecker,
  createSpendingChecker,
  type SpendingCheckerConfig,
} from "./governance/spending-checker";

// MCP Server
export {
  RoonyMCPServer,
  createRoonyMCPServer,
  parseMCPRequest,
  type RoonyMCPServerConfig,
} from "./mcp/server";

export { ROONY_TOOLS, type RoonyToolName } from "./mcp/tools";

// Providers
export {
  type StorageProvider,
  InMemoryStorageProvider,
} from "./providers/storage-provider";

export {
  type PaymentProvider,
  MockPaymentProvider,
  StripeIssuingProvider,
  type StripeIssuingConfig,
} from "./providers/payment-provider";
