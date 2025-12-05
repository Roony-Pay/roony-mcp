/**
 * Example: Express Server for Roony MCP
 * 
 * Run: npx ts-node examples/express/server.ts
 * 
 * This example shows how to set up a standalone Roony governance
 * server using Express.
 */

import express from "express";
import {
  createRoonyMCPServer,
  InMemoryStorageProvider,
  MockPaymentProvider,
  parseMCPRequest,
  createSpendingChecker,
} from "@roony-pay/governance";

const app = express();
app.use(express.json());

// Initialize providers
const storage = new InMemoryStorageProvider();
const payments = new MockPaymentProvider();

// Set up demo organization and agent
storage.addOrganization({
  id: "org_acme",
  name: "Acme Corporation",
  monthlyBudget: 50000,
  alertThreshold: 0.8,
  guardrails: {
    maxTransactionAmount: 1000,
    requireApprovalAbove: 500,
    flagAllNewVendors: true,
    blockCategories: ["gambling", "adult"],
  },
});

storage.addAgent({
  id: "agent_assistant",
  organizationId: "org_acme",
  name: "Executive Assistant",
  status: "active",
  monthlyLimit: 5000,
  dailyLimit: 500,
  perTransactionLimit: 250,
  approvalThreshold: 100,
  flagNewVendors: false, // Org-level handles this
  blockedMerchants: ["competitor.com"],
});

storage.addAgent({
  id: "agent_devops",
  organizationId: "org_acme",
  name: "DevOps Agent",
  status: "active",
  monthlyLimit: 10000,
  perTransactionLimit: 500,
  allowedMerchants: ["AWS", "Google Cloud", "Azure", "GitHub", "Vercel"],
});

// Create MCP server
const mcpServer = createRoonyMCPServer({
  storage,
  paymentProvider: payments,
});

// Create spending checker for direct API usage
const spendingChecker = createSpendingChecker({ storage });

// MCP endpoint
app.post("/mcp", async (req, res) => {
  const mcpRequest = parseMCPRequest(req.body);
  
  if (!mcpRequest) {
    return res.status(400).json({ error: "Invalid MCP request" });
  }
  
  // In production, extract agent from API key
  const agentId = req.headers["x-agent-id"] as string || "agent_assistant";
  const organizationId = "org_acme";
  
  const response = await mcpServer.handleRequest(mcpRequest, agentId, organizationId);
  res.json(response);
});

// Direct spending check API (non-MCP)
app.post("/api/check-spending", async (req, res) => {
  const { agentId, amount, currency, merchantName, description } = req.body;
  
  const result = await spendingChecker.checkSpending({
    agentId,
    amount,
    currency,
    merchantName,
    description,
  });
  
  res.json(result);
});

// List agents
app.get("/api/agents", async (req, res) => {
  // In production, list from database
  res.json({
    agents: [
      { id: "agent_assistant", name: "Executive Assistant" },
      { id: "agent_devops", name: "DevOps Agent" },
    ],
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
🚀 Roony Governance Server running on port ${PORT}

Endpoints:
  POST /mcp              - MCP JSON-RPC endpoint
  POST /api/check-spending - Direct spending check
  GET  /api/agents       - List agents
  GET  /health           - Health check

Demo Agents:
  - agent_assistant (Executive Assistant) - $5,000/mo, $250 max
  - agent_devops (DevOps Agent) - $10,000/mo, AWS/GCP only

Try it:
  curl -X POST http://localhost:${PORT}/mcp \\
    -H "Content-Type: application/json" \\
    -H "X-Agent-Id: agent_assistant" \\
    -d '{
      "jsonrpc": "2.0",
      "id": 1,
      "method": "tools/call",
      "params": {
        "name": "check_budget",
        "arguments": {}
      }
    }'
  `);
});

