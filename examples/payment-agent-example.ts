/**
 * Example: Payment Agent MCP Server
 * 
 * This example shows a more complex MCP server for AI agent payments,
 * similar to the Roony governance platform.
 */

import {
  createMCPServer,
  defineTool,
  prop,
  textResult,
  jsonResult,
  errorResult,
  type MCPContext,
} from "@roony-pay/mcp";

// Types
interface Agent {
  id: string;
  name: string;
  monthlyLimit: number;
  perTransactionLimit: number;
  currentSpend: number;
}

interface PaymentContext extends MCPContext {
  agent: Agent;
  organizationId: string;
}

// Mock database
const mockAgents: Record<string, Agent> = {
  "agent-1": {
    id: "agent-1",
    name: "Shopping Assistant",
    monthlyLimit: 1000,
    perTransactionLimit: 200,
    currentSpend: 150,
  },
};

// Tools
const requestPurchaseTool = defineTool<Record<string, unknown>, PaymentContext>({
  name: "request_purchase",
  description:
    "Request approval for a purchase. If approved, returns a virtual card for the transaction.",
  properties: {
    amount: prop("number", { description: "Purchase amount in USD" }),
    description: prop("string", { description: "What is being purchased" }),
    merchant: prop("string", { description: "Merchant name" }),
  },
  required: ["amount", "description", "merchant"],
  handler: async (args, context) => {
    const { amount, description, merchant } = args as {
      amount: number;
      description: string;
      merchant: string;
    };
    const { agent } = context;

    // Check per-transaction limit
    if (amount > agent.perTransactionLimit) {
      return jsonResult({
        status: "rejected",
        reason: "OVER_TRANSACTION_LIMIT",
        message: `Amount $${amount} exceeds your per-transaction limit of $${agent.perTransactionLimit}`,
      });
    }

    // Check monthly limit
    if (agent.currentSpend + amount > agent.monthlyLimit) {
      return jsonResult({
        status: "rejected",
        reason: "MONTHLY_LIMIT_EXCEEDED",
        message: `This purchase would exceed your monthly limit of $${agent.monthlyLimit}`,
        current_spend: agent.currentSpend,
        remaining: agent.monthlyLimit - agent.currentSpend,
      });
    }

    // Approved! Generate mock virtual card
    const virtualCard = {
      card_number: "4242424242424242",
      exp_month: 12,
      exp_year: new Date().getFullYear() + 1,
      cvc: "123",
      zip: "10001",
    };

    return jsonResult({
      status: "approved",
      purchase_id: `pur_${Date.now()}`,
      amount,
      description,
      merchant,
      card: virtualCard,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      message: `Purchase approved. Use this card to complete your $${amount} purchase at ${merchant}.`,
    });
  },
});

const checkBudgetTool = defineTool<Record<string, unknown>, PaymentContext>({
  name: "check_budget",
  description: "Check remaining budget and spending limits",
  properties: {
    period: prop("string", {
      description: "Budget period to check",
      enum: ["daily", "monthly", "all"],
      default: "all",
    }),
  },
  required: [],
  handler: async (args, context) => {
    const { agent } = context;

    return jsonResult({
      agent_name: agent.name,
      limits: {
        per_transaction: agent.perTransactionLimit,
        monthly: agent.monthlyLimit,
      },
      current_spend: {
        monthly: agent.currentSpend,
      },
      remaining: {
        monthly: agent.monthlyLimit - agent.currentSpend,
      },
      utilization: `${((agent.currentSpend / agent.monthlyLimit) * 100).toFixed(1)}%`,
    });
  },
});

const listTransactionsTool = defineTool<Record<string, unknown>, PaymentContext>({
  name: "list_transactions",
  description: "List recent transactions",
  properties: {
    limit: prop("number", { description: "Max transactions to return", default: 10 }),
    status: prop("string", {
      description: "Filter by status",
      enum: ["approved", "rejected", "pending", "all"],
    }),
  },
  required: [],
  handler: async (args, context) => {
    // Mock transactions
    const transactions = [
      {
        id: "txn_1",
        amount: 50,
        merchant: "AWS",
        description: "Cloud hosting",
        status: "approved",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "txn_2",
        amount: 100,
        merchant: "GitHub",
        description: "Team subscription",
        status: "approved",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    return jsonResult({
      agent_id: context.agent.id,
      transactions,
      total: transactions.length,
    });
  },
});

// Create server with authentication
const server = createMCPServer<PaymentContext>({
  name: "payment-agent",
  version: "1.0.0",
  tools: [requestPurchaseTool, checkBudgetTool, listTransactionsTool],
  createContext: async (request) => {
    // In production, extract agent ID from auth header
    const agentId = "agent-1";
    const agent = mockAgents[agentId];

    if (!agent) {
      throw new Error("Agent not found");
    }

    return {
      requestId: request.id,
      agent,
      organizationId: "org-1",
    };
  },
});

// Export for use in your framework
export { server };

// Example usage with fetch
async function testServer() {
  // Initialize
  const initResponse = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  console.log("Initialize:", JSON.stringify(initResponse, null, 2));

  // List tools
  const toolsResponse = await server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  console.log("Tools:", JSON.stringify(toolsResponse, null, 2));

  // Check budget
  const budgetResponse = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "check_budget",
      arguments: {},
    },
  });
  console.log("Budget:", JSON.stringify(budgetResponse, null, 2));

  // Request purchase
  const purchaseResponse = await server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "request_purchase",
      arguments: {
        amount: 75,
        description: "Design software subscription",
        merchant: "Figma",
      },
    },
  });
  console.log("Purchase:", JSON.stringify(purchaseResponse, null, 2));
}

// Run if executed directly
testServer().catch(console.error);

