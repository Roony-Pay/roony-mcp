/**
 * MCP Tool Handlers for Roony Governance
 */

import type { MCPToolResult, ApprovalReason } from "../types";
import type { StorageProvider } from "../providers/storage-provider";
import type { PaymentProvider } from "../providers/payment-provider";
import { SpendingChecker } from "../governance/spending-checker";

// Helper functions
function textResult(text: string, isError = false): MCPToolResult {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function jsonResult(data: unknown, isError = false): MCPToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

export interface HandlerContext {
  agentId: string;
  organizationId: string;
  storage: StorageProvider;
  paymentProvider: PaymentProvider;
  spendingChecker: SpendingChecker;
}

/**
 * Handle request_purchase tool
 */
export async function handleRequestPurchase(
  args: Record<string, unknown>,
  context: HandlerContext
): Promise<MCPToolResult> {
  const { amount, currency, description, merchant_name, merchant_url, project_id } = args;
  
  // Validate required args
  if (typeof amount !== "number" || amount <= 0) {
    return textResult("Error: 'amount' must be a positive number", true);
  }
  if (typeof currency !== "string") {
    return textResult("Error: 'currency' is required", true);
  }
  if (typeof description !== "string") {
    return textResult("Error: 'description' is required", true);
  }
  if (typeof merchant_name !== "string") {
    return textResult("Error: 'merchant_name' is required", true);
  }
  
  // Check spending
  const checkResult = await context.spendingChecker.checkSpending({
    agentId: context.agentId,
    amount,
    currency,
    merchantName: merchant_name,
    description,
  });
  
  // Handle rejection
  if (!checkResult.allowed && !checkResult.requiresApproval) {
    await context.storage.createPurchaseIntent({
      organizationId: context.organizationId,
      agentId: context.agentId,
      amount,
      currency,
      description,
      merchantName: merchant_name,
      merchantUrl: merchant_url as string | undefined,
      status: "rejected",
      rejectionCode: checkResult.rejectionCode,
      rejectionReason: checkResult.rejectionMessage,
      metadata: project_id ? { project_id: project_id as string } : undefined,
    });
    
    return jsonResult({
      status: "rejected",
      reason_code: checkResult.rejectionCode,
      message: checkResult.rejectionMessage,
      suggestion: getSuggestion(checkResult.rejectionCode),
    });
  }
  
  // Handle pending approval
  if (checkResult.requiresApproval) {
    const intent = await context.storage.createPurchaseIntent({
      organizationId: context.organizationId,
      agentId: context.agentId,
      amount,
      currency,
      description,
      merchantName: merchant_name,
      merchantUrl: merchant_url as string | undefined,
      status: "pending_approval",
      metadata: project_id ? { project_id: project_id as string } : undefined,
    });
    
    const approvalReason: ApprovalReason = checkResult.approvalReason?.includes("threshold")
      ? "OVER_THRESHOLD"
      : checkResult.approvalReason?.includes("vendor")
        ? "NEW_VENDOR"
        : "ORG_GUARDRAIL";
    
    await context.storage.createPendingApproval({
      purchaseIntentId: intent.id,
      organizationId: context.organizationId,
      agentId: context.agentId,
      amount,
      merchantName: merchant_name,
      reason: approvalReason,
      reasonDetails: checkResult.approvalReason,
      status: "pending",
    });
    
    return jsonResult({
      status: "pending_approval",
      message: checkResult.approvalReason || "This purchase requires human approval",
      purchase_intent_id: intent.id,
      suggestion: "A human administrator will review this request. You'll be notified of the decision.",
    });
  }
  
  // Create approved purchase intent
  const intent = await context.storage.createPurchaseIntent({
    organizationId: context.organizationId,
    agentId: context.agentId,
    amount,
    currency,
    description,
    merchantName: merchant_name,
    merchantUrl: merchant_url as string | undefined,
    status: "approved",
    metadata: project_id ? { project_id: project_id as string } : undefined,
  });
  
  // Create virtual card
  const card = await context.paymentProvider.createVirtualCard({
    purchaseIntentId: intent.id,
    organizationId: context.organizationId,
    agentId: context.agentId,
    amount,
    currency,
  });
  
  // Record merchant as known
  await context.storage.recordMerchant(context.organizationId, merchant_name);
  
  return jsonResult({
    status: "approved",
    card: {
      card_id: card.id,
      number: card.cardNumber,
      exp_month: card.expMonth,
      exp_year: card.expYear,
      cvc: card.cvc,
      billing_zip: card.billingZip,
    },
    hard_limit_amount: amount,
    currency,
    expires_at: card.expiresAt.toISOString(),
    purchase_intent_id: intent.id,
    message: `Purchase approved. Use this card to complete your purchase of ${description}.`,
  });
}

/**
 * Handle check_budget tool
 */
export async function handleCheckBudget(
  args: Record<string, unknown>,
  context: HandlerContext
): Promise<MCPToolResult> {
  const period = (args.period as string) || "all";
  
  const agentBudget = await context.storage.getAgentBudget(context.agentId);
  if (!agentBudget) {
    return textResult("Error: Agent not found", true);
  }
  
  const orgBudget = await context.storage.getBudgetUtilization(context.organizationId);
  
  const budgetInfo = {
    agent_id: context.agentId,
    agent_name: agentBudget.agentName,
    currency: "usd",
    limits: agentBudget.limits,
    current_spend: agentBudget.currentSpend,
    remaining: agentBudget.remaining,
    organization: {
      monthly_budget: orgBudget.orgBudget || "unlimited",
      org_spent: orgBudget.orgSpent,
      org_remaining: orgBudget.orgRemaining || "unlimited",
      percent_used: orgBudget.percentUsed?.toFixed(1) + "%" || "N/A",
    },
  };
  
  if (period !== "all" && period in agentBudget.currentSpend) {
    const periodKey = period as "daily" | "monthly";
    return jsonResult({
      agent_id: context.agentId,
      period,
      limit: agentBudget.limits[periodKey] || "unlimited",
      spent: agentBudget.currentSpend[periodKey],
      remaining: agentBudget.remaining[periodKey],
    });
  }
  
  return jsonResult(budgetInfo);
}

/**
 * Handle list_transactions tool
 */
export async function handleListTransactions(
  args: Record<string, unknown>,
  context: HandlerContext
): Promise<MCPToolResult> {
  const limit = Math.min(Math.max(1, (args.limit as number) || 10), 50);
  const statusFilter = (args.status as string) || "all";
  
  const transactions = await context.storage.listPurchaseIntents(context.agentId, {
    status: statusFilter === "all" ? undefined : statusFilter,
    limit,
  });
  
  return jsonResult({
    agent_id: context.agentId,
    count: transactions.length,
    transactions: transactions.map(t => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      merchant: t.merchantName,
      status: t.status,
      rejection_reason: t.rejectionCode ? {
        code: t.rejectionCode,
        message: t.rejectionReason,
      } : null,
      timestamp: t.createdAt.toISOString(),
    })),
  });
}

/**
 * Handle get_policy_info tool
 */
export async function handleGetPolicyInfo(
  context: HandlerContext
): Promise<MCPToolResult> {
  const agent = await context.storage.getAgent(context.agentId);
  if (!agent) {
    return textResult("Error: Agent not found", true);
  }
  
  const org = await context.storage.getOrganization(context.organizationId);
  const guardrails = org?.guardrails || {};
  
  const policyInfo = {
    agent_id: context.agentId,
    agent_name: agent.name,
    agent_controls: {
      spending_limits: {
        per_transaction: agent.perTransactionLimit || "unlimited",
        daily: agent.dailyLimit || "unlimited",
        monthly: agent.monthlyLimit || "unlimited",
      },
      approval_rules: {
        threshold: agent.approvalThreshold
          ? `Purchases over $${agent.approvalThreshold} require human approval`
          : "No approval threshold",
        new_vendors: agent.flagNewVendors
          ? "Purchases from new vendors require human approval"
          : "New vendor purchases allowed",
      },
      merchant_restrictions: {
        blocked: agent.blockedMerchants?.length ? agent.blockedMerchants : "none",
        allowed_only: agent.allowedMerchants?.length ? agent.allowedMerchants : "any merchant",
      },
    },
    organization_guardrails: {
      monthly_budget: org?.monthlyBudget || "unlimited",
      max_transaction: guardrails.maxTransactionAmount || "unlimited",
      require_approval_above: guardrails.requireApprovalAbove || "none",
      flag_all_new_vendors: guardrails.flagAllNewVendors || false,
      blocked_categories: guardrails.blockCategories?.length
        ? guardrails.blockCategories
        : "none",
    },
    summary: getSummary(agent, guardrails),
  };
  
  return jsonResult(policyInfo);
}

// Helper functions

function getSuggestion(reasonCode?: string): string {
  switch (reasonCode) {
    case "OVER_TRANSACTION_LIMIT":
      return "Try a smaller purchase amount or request a limit increase from your administrator.";
    case "DAILY_LIMIT_EXCEEDED":
      return "Your daily spending limit has been reached. Try again tomorrow or request a limit increase.";
    case "MONTHLY_LIMIT_EXCEEDED":
      return "Your monthly spending limit has been reached. Try again next month or request a limit increase.";
    case "ORG_BUDGET_EXCEEDED":
      return "The organization's monthly budget has been reached. Contact your administrator.";
    case "OVER_ORG_MAX_TRANSACTION":
      return "This amount exceeds the organization's maximum transaction limit.";
    case "MERCHANT_NOT_ALLOWED":
      return "This merchant is not on the approved list. Contact your administrator to add it.";
    case "MERCHANT_BLOCKED":
      return "This merchant has been blocked. Use an alternative merchant.";
    case "CATEGORY_BLOCKED":
      return "This merchant category is blocked by organization policy.";
    case "AGENT_NOT_FOUND":
      return "Unable to identify the agent. Check your API key configuration.";
    default:
      return "Contact your administrator for assistance.";
  }
}

function getSummary(agent: any, guardrails: any): string {
  const parts = [];
  
  if (agent.monthlyLimit) {
    parts.push(`You have a monthly budget of $${agent.monthlyLimit}`);
  }
  if (agent.perTransactionLimit) {
    parts.push(`max $${agent.perTransactionLimit} per transaction`);
  }
  if (agent.approvalThreshold) {
    parts.push(`purchases over $${agent.approvalThreshold} need approval`);
  }
  if (agent.flagNewVendors) {
    parts.push(`new vendors require approval`);
  }
  
  if (parts.length === 0) {
    return "No specific limits set. Organization guardrails still apply.";
  }
  
  return parts.join(", ") + ".";
}

