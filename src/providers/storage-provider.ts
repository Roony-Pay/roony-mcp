/**
 * Storage Provider Interface
 * 
 * Abstract interface for data storage. Implement this to use your own database.
 * A reference Drizzle/SQLite implementation is provided in adapters/drizzle.
 */

import type {
  Agent,
  Organization,
  PurchaseIntent,
  PendingApproval,
  BudgetUtilization,
  AgentBudget,
} from "../types";

export interface StorageProvider {
  // Agent operations
  getAgent(agentId: string): Promise<Agent | null>;
  getAgentByApiKey(apiKeyHash: string): Promise<Agent | null>;
  
  // Organization operations
  getOrganization(orgId: string): Promise<Organization | null>;
  
  // Spending tracking
  getAgentSpend(agentId: string, period: "daily" | "monthly"): Promise<number>;
  getOrgSpend(orgId: string, period: "daily" | "monthly"): Promise<number>;
  
  // Merchant tracking
  isNewVendor(orgId: string, merchantName: string): Promise<boolean>;
  recordMerchant(orgId: string, merchantName: string): Promise<void>;
  
  // Purchase intents
  createPurchaseIntent(intent: Omit<PurchaseIntent, "id" | "createdAt">): Promise<PurchaseIntent>;
  getPurchaseIntent(id: string): Promise<PurchaseIntent | null>;
  updatePurchaseIntent(id: string, updates: Partial<PurchaseIntent>): Promise<void>;
  listPurchaseIntents(agentId: string, options?: {
    status?: string;
    limit?: number;
  }): Promise<PurchaseIntent[]>;
  
  // Approvals
  createPendingApproval(approval: Omit<PendingApproval, "id" | "createdAt">): Promise<PendingApproval>;
  getPendingApproval(id: string): Promise<PendingApproval | null>;
  updatePendingApproval(id: string, updates: Partial<PendingApproval>): Promise<void>;
  listPendingApprovals(orgId: string, status?: "pending" | "approved" | "rejected"): Promise<PendingApproval[]>;
  
  // Budget
  getBudgetUtilization(orgId: string): Promise<BudgetUtilization>;
  getAgentBudget(agentId: string): Promise<AgentBudget | null>;
}

/**
 * In-memory storage provider for testing/development
 */
export class InMemoryStorageProvider implements StorageProvider {
  private agents: Map<string, Agent> = new Map();
  private organizations: Map<string, Organization> = new Map();
  private purchaseIntents: Map<string, PurchaseIntent> = new Map();
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private merchants: Map<string, Set<string>> = new Map(); // orgId -> merchantNames
  private spendTracking: Map<string, { daily: number; monthly: number }> = new Map();
  
  // Setup methods for testing
  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }
  
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  
  // StorageProvider implementation
  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }
  
  async getAgentByApiKey(apiKeyHash: string): Promise<Agent | null> {
    for (const agent of this.agents.values()) {
      // In real implementation, compare hashes
      if ((agent as any).apiKeyHash === apiKeyHash) {
        return agent;
      }
    }
    return null;
  }
  
  async getOrganization(orgId: string): Promise<Organization | null> {
    return this.organizations.get(orgId) || null;
  }
  
  async getAgentSpend(agentId: string, period: "daily" | "monthly"): Promise<number> {
    const tracking = this.spendTracking.get(agentId);
    return tracking?.[period] || 0;
  }
  
  async getOrgSpend(orgId: string, period: "daily" | "monthly"): Promise<number> {
    const tracking = this.spendTracking.get(`org:${orgId}`);
    return tracking?.[period] || 0;
  }
  
  async isNewVendor(orgId: string, merchantName: string): Promise<boolean> {
    const merchants = this.merchants.get(orgId);
    return !merchants?.has(merchantName.toLowerCase());
  }
  
  async recordMerchant(orgId: string, merchantName: string): Promise<void> {
    if (!this.merchants.has(orgId)) {
      this.merchants.set(orgId, new Set());
    }
    this.merchants.get(orgId)!.add(merchantName.toLowerCase());
  }
  
  async createPurchaseIntent(intent: Omit<PurchaseIntent, "id" | "createdAt">): Promise<PurchaseIntent> {
    const id = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullIntent: PurchaseIntent = {
      ...intent,
      id,
      createdAt: new Date(),
    };
    this.purchaseIntents.set(id, fullIntent);
    
    // Track spending for approved intents
    if (intent.status === "approved") {
      this.trackSpend(intent.agentId, intent.organizationId, intent.amount);
    }
    
    return fullIntent;
  }
  
  async getPurchaseIntent(id: string): Promise<PurchaseIntent | null> {
    return this.purchaseIntents.get(id) || null;
  }
  
  async updatePurchaseIntent(id: string, updates: Partial<PurchaseIntent>): Promise<void> {
    const existing = this.purchaseIntents.get(id);
    if (existing) {
      this.purchaseIntents.set(id, { ...existing, ...updates });
    }
  }
  
  async listPurchaseIntents(agentId: string, options?: { status?: string; limit?: number }): Promise<PurchaseIntent[]> {
    let results = Array.from(this.purchaseIntents.values())
      .filter(pi => pi.agentId === agentId);
    
    if (options?.status) {
      results = results.filter(pi => pi.status === options.status);
    }
    
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }
  
  async createPendingApproval(approval: Omit<PendingApproval, "id" | "createdAt">): Promise<PendingApproval> {
    const id = `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullApproval: PendingApproval = {
      ...approval,
      id,
      createdAt: new Date(),
    };
    this.pendingApprovals.set(id, fullApproval);
    return fullApproval;
  }
  
  async getPendingApproval(id: string): Promise<PendingApproval | null> {
    return this.pendingApprovals.get(id) || null;
  }
  
  async updatePendingApproval(id: string, updates: Partial<PendingApproval>): Promise<void> {
    const existing = this.pendingApprovals.get(id);
    if (existing) {
      this.pendingApprovals.set(id, { ...existing, ...updates });
    }
  }
  
  async listPendingApprovals(orgId: string, status?: "pending" | "approved" | "rejected"): Promise<PendingApproval[]> {
    let results = Array.from(this.pendingApprovals.values())
      .filter(pa => pa.organizationId === orgId);
    
    if (status) {
      results = results.filter(pa => pa.status === status);
    }
    
    return results;
  }
  
  async getBudgetUtilization(orgId: string): Promise<BudgetUtilization> {
    const org = this.organizations.get(orgId);
    const spent = await this.getOrgSpend(orgId, "monthly");
    const budget = org?.monthlyBudget || null;
    const threshold = org?.alertThreshold || 0.8;
    const percentUsed = budget ? (spent / budget) * 100 : null;
    
    return {
      orgBudget: budget,
      orgSpent: spent,
      orgRemaining: budget ? budget - spent : null,
      percentUsed,
      alertThreshold: threshold * 100,
      isOverThreshold: percentUsed !== null && percentUsed >= threshold * 100,
    };
  }
  
  async getAgentBudget(agentId: string): Promise<AgentBudget | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    const dailySpent = await this.getAgentSpend(agentId, "daily");
    const monthlySpent = await this.getAgentSpend(agentId, "monthly");
    
    return {
      agentId,
      agentName: agent.name,
      limits: {
        perTransaction: agent.perTransactionLimit,
        daily: agent.dailyLimit,
        monthly: agent.monthlyLimit,
      },
      currentSpend: {
        daily: dailySpent,
        monthly: monthlySpent,
      },
      remaining: {
        daily: agent.dailyLimit ? Math.max(0, agent.dailyLimit - dailySpent) : "unlimited",
        monthly: agent.monthlyLimit ? Math.max(0, agent.monthlyLimit - monthlySpent) : "unlimited",
      },
    };
  }
  
  private trackSpend(agentId: string, orgId: string, amount: number): void {
    // Track agent spend
    const agentTracking = this.spendTracking.get(agentId) || { daily: 0, monthly: 0 };
    agentTracking.daily += amount;
    agentTracking.monthly += amount;
    this.spendTracking.set(agentId, agentTracking);
    
    // Track org spend
    const orgKey = `org:${orgId}`;
    const orgTracking = this.spendTracking.get(orgKey) || { daily: 0, monthly: 0 };
    orgTracking.daily += amount;
    orgTracking.monthly += amount;
    this.spendTracking.set(orgKey, orgTracking);
  }
}

