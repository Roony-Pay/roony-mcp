/**
 * Spending Checker
 * 
 * Core governance logic that evaluates purchase requests against
 * agent controls and organization guardrails.
 */

import type {
  SpendingCheckRequest,
  SpendingCheckResult,
} from "../types";
import type { StorageProvider } from "../providers/storage-provider";

export interface SpendingCheckerConfig {
  storage: StorageProvider;
}

export class SpendingChecker {
  private storage: StorageProvider;
  
  constructor(config: SpendingCheckerConfig) {
    this.storage = config.storage;
  }
  
  /**
   * Check if a purchase is allowed based on agent and org rules
   */
  async checkSpending(request: SpendingCheckRequest): Promise<SpendingCheckResult> {
    // 1. Load agent and org data
    const agent = await this.storage.getAgent(request.agentId);
    if (!agent) {
      return {
        allowed: false,
        requiresApproval: false,
        rejectionCode: "AGENT_NOT_FOUND",
        rejectionMessage: "Agent not found",
      };
    }
    
    const org = await this.storage.getOrganization(agent.organizationId);
    if (!org) {
      return {
        allowed: false,
        requiresApproval: false,
        rejectionCode: "AGENT_NOT_FOUND",
        rejectionMessage: "Organization not found",
      };
    }
    
    const guardrails = org.guardrails || {};
    
    // 2. Check per-transaction limit (agent level)
    if (agent.perTransactionLimit && request.amount > agent.perTransactionLimit) {
      return {
        allowed: false,
        requiresApproval: false,
        rejectionCode: "OVER_TRANSACTION_LIMIT",
        rejectionMessage: `Amount $${request.amount.toFixed(2)} exceeds per-transaction limit of $${agent.perTransactionLimit.toFixed(2)}`,
      };
    }
    
    // 3. Check org max transaction amount (guardrail)
    if (guardrails.maxTransactionAmount && request.amount > guardrails.maxTransactionAmount) {
      return {
        allowed: false,
        requiresApproval: false,
        rejectionCode: "OVER_ORG_MAX_TRANSACTION",
        rejectionMessage: `Amount $${request.amount.toFixed(2)} exceeds organization maximum of $${guardrails.maxTransactionAmount.toFixed(2)}`,
      };
    }
    
    // 4. Check agent's daily limit
    if (agent.dailyLimit) {
      const dailySpend = await this.storage.getAgentSpend(agent.id, "daily");
      if (dailySpend + request.amount > agent.dailyLimit) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "DAILY_LIMIT_EXCEEDED",
          rejectionMessage: `Daily spend would exceed limit of $${agent.dailyLimit.toFixed(2)} (current: $${dailySpend.toFixed(2)})`,
        };
      }
    }
    
    // 5. Check agent's monthly limit
    if (agent.monthlyLimit) {
      const monthlySpend = await this.storage.getAgentSpend(agent.id, "monthly");
      if (monthlySpend + request.amount > agent.monthlyLimit) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "MONTHLY_LIMIT_EXCEEDED",
          rejectionMessage: `Monthly spend would exceed limit of $${agent.monthlyLimit.toFixed(2)} (current: $${monthlySpend.toFixed(2)})`,
        };
      }
    }
    
    // 6. Check organization's monthly budget
    if (org.monthlyBudget) {
      const orgSpend = await this.storage.getOrgSpend(org.id, "monthly");
      if (orgSpend + request.amount > org.monthlyBudget) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "ORG_BUDGET_EXCEEDED",
          rejectionMessage: `Organization monthly budget of $${org.monthlyBudget.toFixed(2)} would be exceeded (current: $${orgSpend.toFixed(2)})`,
        };
      }
    }
    
    // 7. Check blocked merchants (agent level)
    if (agent.blockedMerchants && agent.blockedMerchants.length > 0) {
      const merchantLower = request.merchantName.toLowerCase();
      const isBlocked = agent.blockedMerchants.some(blocked => 
        merchantLower.includes(blocked.toLowerCase())
      );
      if (isBlocked) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "MERCHANT_BLOCKED",
          rejectionMessage: `Merchant "${request.merchantName}" is blocked for this agent`,
        };
      }
    }
    
    // 8. Check allowed merchants (agent level - if set, only these are allowed)
    if (agent.allowedMerchants && agent.allowedMerchants.length > 0) {
      const merchantLower = request.merchantName.toLowerCase();
      const isAllowed = agent.allowedMerchants.some(allowed => 
        merchantLower.includes(allowed.toLowerCase())
      );
      if (!isAllowed) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "MERCHANT_NOT_ALLOWED",
          rejectionMessage: `Merchant "${request.merchantName}" is not in the allowed list`,
        };
      }
    }
    
    // 9. Check blocked categories (org guardrail)
    if (guardrails.blockCategories && guardrails.blockCategories.length > 0) {
      const merchantLower = request.merchantName.toLowerCase();
      const isBlockedCategory = guardrails.blockCategories.some(cat => 
        merchantLower.includes(cat.toLowerCase())
      );
      if (isBlockedCategory) {
        return {
          allowed: false,
          requiresApproval: false,
          rejectionCode: "CATEGORY_BLOCKED",
          rejectionMessage: `Merchant "${request.merchantName}" matches a blocked category`,
        };
      }
    }
    
    // --- Approval checks (allowed but needs review) ---
    
    // 10. Check approval threshold (agent level)
    if (agent.approvalThreshold && request.amount > agent.approvalThreshold) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalReason: `Amount $${request.amount.toFixed(2)} exceeds approval threshold of $${agent.approvalThreshold.toFixed(2)}`,
      };
    }
    
    // 11. Check org-level approval threshold (guardrail)
    if (guardrails.requireApprovalAbove && request.amount > guardrails.requireApprovalAbove) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalReason: `Amount $${request.amount.toFixed(2)} exceeds organization approval threshold of $${guardrails.requireApprovalAbove.toFixed(2)}`,
      };
    }
    
    // 12. Check new vendor (agent level)
    if (agent.flagNewVendors) {
      const isNew = await this.storage.isNewVendor(org.id, request.merchantName);
      if (isNew) {
        return {
          allowed: true,
          requiresApproval: true,
          approvalReason: `First purchase from new vendor "${request.merchantName}"`,
        };
      }
    }
    
    // 13. Check org-level new vendor flagging (guardrail)
    if (guardrails.flagAllNewVendors) {
      const isNew = await this.storage.isNewVendor(org.id, request.merchantName);
      if (isNew) {
        return {
          allowed: true,
          requiresApproval: true,
          approvalReason: `First purchase from new vendor "${request.merchantName}" (org policy)`,
        };
      }
    }
    
    // All checks passed - approved
    return {
      allowed: true,
      requiresApproval: false,
    };
  }
}

/**
 * Create a spending checker instance
 */
export function createSpendingChecker(config: SpendingCheckerConfig): SpendingChecker {
  return new SpendingChecker(config);
}

