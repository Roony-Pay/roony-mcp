/**
 * MCP Tool Definitions for Roony Governance
 */

import type { MCPTool } from "../types";

export const ROONY_TOOLS: MCPTool[] = [
  {
    name: "request_purchase",
    description: 
      "Request approval for a purchase. If approved, returns a virtual card that can be used " +
      "for the transaction. The card is single-use and limited to the approved amount.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "The purchase amount in the specified currency (e.g., 49.99)",
        },
        currency: {
          type: "string",
          description: "Three-letter ISO currency code (e.g., 'usd', 'eur')",
        },
        description: {
          type: "string",
          description: "Description of what is being purchased (e.g., 'Monthly Figma subscription')",
        },
        merchant_name: {
          type: "string",
          description: "Name of the merchant or vendor (e.g., 'Figma', 'AWS', 'GitHub')",
        },
        merchant_url: {
          type: "string",
          description: "Optional URL of the merchant website",
        },
        project_id: {
          type: "string",
          description: "Optional project identifier for tracking spend by project",
        },
      },
      required: ["amount", "currency", "description", "merchant_name"],
    },
  },
  {
    name: "check_budget",
    description:
      "Check the remaining budget and spending limits for this agent. " +
      "Returns daily, weekly, monthly, and per-transaction limits along with current spend.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Budget period to check: 'daily', 'weekly', 'monthly', or 'all'",
          enum: ["daily", "weekly", "monthly", "all"],
        },
      },
      required: [],
    },
  },
  {
    name: "list_transactions",
    description:
      "List recent transactions made by this agent. " +
      "Returns transaction history with amounts, merchants, and status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of transactions to return (default: 10, max: 50)",
        },
        status: {
          type: "string",
          description: "Filter by transaction status",
          enum: ["approved", "rejected", "pending", "all"],
        },
      },
      required: [],
    },
  },
  {
    name: "get_policy_info",
    description:
      "Get information about the spending policies that apply to this agent. " +
      "Shows allowed merchants, blocked categories, and spending rules.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export type RoonyToolName = 
  | "request_purchase" 
  | "check_budget" 
  | "list_transactions" 
  | "get_policy_info";

