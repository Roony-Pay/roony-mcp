/**
 * Example: Next.js API Route for Roony MCP
 * 
 * File: app/api/mcp/route.ts
 * 
 * This example shows how to set up a Roony MCP endpoint in Next.js.
 * In production, you'd authenticate agents via API keys and look up
 * their organization from your database.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createRoonyMCPServer,
  InMemoryStorageProvider,
  MockPaymentProvider,
  parseMCPRequest,
} from "@roony-pay/governance";

// Initialize providers (in production, use real implementations)
const storage = new InMemoryStorageProvider();
const payments = new MockPaymentProvider();

// Set up test data
storage.addOrganization({
  id: "org_demo",
  name: "Demo Organization",
  monthlyBudget: 10000,
  guardrails: {
    maxTransactionAmount: 500,
    requireApprovalAbove: 200,
    flagAllNewVendors: false,
  },
});

storage.addAgent({
  id: "agent_demo",
  organizationId: "org_demo",
  name: "Demo Shopping Agent",
  status: "active",
  monthlyLimit: 1000,
  dailyLimit: 200,
  perTransactionLimit: 100,
  approvalThreshold: 75,
  flagNewVendors: true,
});

// Create MCP server
const mcpServer = createRoonyMCPServer({
  storage,
  paymentProvider: payments,
});

// API Route Handler
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const mcpRequest = parseMCPRequest(body);
    
    if (!mcpRequest) {
      return NextResponse.json(
        { error: "Invalid MCP request" },
        { status: 400 }
      );
    }
    
    // In production, authenticate the agent from the Authorization header
    // const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    // const agent = await storage.getAgentByApiKey(hashApiKey(apiKey));
    
    // For demo, use fixed agent
    const agentId = "agent_demo";
    const organizationId = "org_demo";
    
    // Handle MCP request
    const response = await mcpServer.handleRequest(
      mcpRequest,
      agentId,
      organizationId
    );
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("MCP endpoint error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "roony-governance",
    version: "1.0.0",
  });
}

