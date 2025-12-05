/**
 * Core types for Roony Governance
 */

// ============================================
// Agent Types
// ============================================

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  status: "active" | "paused" | "suspended";
  
  // Spending limits
  monthlyLimit?: number;
  dailyLimit?: number;
  perTransactionLimit?: number;
  
  // Approval rules
  approvalThreshold?: number;
  flagNewVendors?: boolean;
  
  // Merchant restrictions
  blockedMerchants?: string[];
  allowedMerchants?: string[];
}

// ============================================
// Organization Types
// ============================================

export interface Organization {
  id: string;
  name: string;
  monthlyBudget?: number;
  alertThreshold?: number;
  guardrails?: OrgGuardrails;
}

export interface OrgGuardrails {
  blockCategories?: string[];
  requireApprovalAbove?: number;
  flagAllNewVendors?: boolean;
  maxTransactionAmount?: number;
}

// ============================================
// Purchase Types
// ============================================

export interface PurchaseRequest {
  agentId: string;
  amount: number;
  currency: string;
  description: string;
  merchant: {
    name: string;
    url?: string;
    mcc?: string;
  };
  metadata?: Record<string, string>;
}

export interface PurchaseIntent {
  id: string;
  agentId: string;
  organizationId: string;
  amount: number;
  currency: string;
  description: string;
  merchantName: string;
  merchantUrl?: string;
  status: PurchaseStatus;
  rejectionCode?: string;
  rejectionReason?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
}

export type PurchaseStatus = 
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "expired";

// ============================================
// Spending Check Types
// ============================================

export interface SpendingCheckRequest {
  agentId: string;
  amount: number;
  currency: string;
  merchantName: string;
  description: string;
}

export interface SpendingCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalReason?: string;
  rejectionCode?: RejectionCode;
  rejectionMessage?: string;
}

export type RejectionCode =
  | "AGENT_NOT_FOUND"
  | "OVER_TRANSACTION_LIMIT"
  | "OVER_ORG_MAX_TRANSACTION"
  | "DAILY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "ORG_BUDGET_EXCEEDED"
  | "MERCHANT_BLOCKED"
  | "MERCHANT_NOT_ALLOWED"
  | "CATEGORY_BLOCKED"
  | "NO_PAYMENT_METHOD"
  | "POLICY_REJECTED";

// ============================================
// Virtual Card Types
// ============================================

export interface VirtualCard {
  id: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  billingZip?: string;
  hardLimit: number;
  currency: string;
  expiresAt: Date;
}

export interface VirtualCardRequest {
  purchaseIntentId: string;
  organizationId: string;
  agentId: string;
  amount: number;
  currency: string;
  merchantName?: string;
  allowedCategories?: string[];
  blockedCategories?: string[];
}

// ============================================
// Approval Types
// ============================================

export interface PendingApproval {
  id: string;
  purchaseIntentId: string;
  organizationId: string;
  agentId: string;
  amount: number;
  merchantName: string;
  reason: ApprovalReason;
  reasonDetails?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
}

export type ApprovalReason =
  | "OVER_THRESHOLD"
  | "NEW_VENDOR"
  | "ORG_GUARDRAIL"
  | "MANUAL_REVIEW";

// ============================================
// Budget Types
// ============================================

export interface BudgetUtilization {
  orgBudget: number | null;
  orgSpent: number;
  orgRemaining: number | null;
  percentUsed: number | null;
  alertThreshold: number;
  isOverThreshold: boolean;
}

export interface AgentBudget {
  agentId: string;
  agentName: string;
  limits: {
    perTransaction?: number;
    daily?: number;
    monthly?: number;
  };
  currentSpend: {
    daily: number;
    monthly: number;
  };
  remaining: {
    daily: number | "unlimited";
    monthly: number | "unlimited";
  };
}

// ============================================
// MCP Types
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

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, MCPToolProperty>;
    required: string[];
  };
}

export interface MCPToolProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export const MCPErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;
