/**
 * Example: Express MCP Server
 * 
 * This example shows how to create an MCP server with Express.
 * 
 * Run: npx ts-node examples/express-example.ts
 */

import express from "express";
import {
  createMCPServer,
  defineTool,
  prop,
  textResult,
  jsonResult,
} from "@roony-pay/mcp";

const app = express();
app.use(express.json());

// Define tools
const echoTool = defineTool({
  name: "echo",
  description: "Echo back the input message",
  properties: {
    message: prop("string", { description: "Message to echo" }),
    uppercase: prop("boolean", { description: "Convert to uppercase" }),
  },
  required: ["message"],
  handler: async (args) => {
    const { message, uppercase } = args as { message: string; uppercase?: boolean };
    const result = uppercase ? message.toUpperCase() : message;
    return textResult(result);
  },
});

const listItemsTool = defineTool({
  name: "list_items",
  description: "List items from a mock database",
  properties: {
    category: prop("string", {
      description: "Category to filter by",
      enum: ["books", "electronics", "clothing"],
    }),
    limit: prop("number", { description: "Max items to return", default: 10 }),
  },
  required: [],
  handler: async (args) => {
    const { category, limit = 10 } = args as { category?: string; limit?: number };

    // Mock database
    const items = [
      { id: 1, name: "TypeScript Handbook", category: "books", price: 29.99 },
      { id: 2, name: "Mechanical Keyboard", category: "electronics", price: 149.99 },
      { id: 3, name: "Developer Hoodie", category: "clothing", price: 59.99 },
      { id: 4, name: "Clean Code", category: "books", price: 39.99 },
      { id: 5, name: "USB-C Hub", category: "electronics", price: 49.99 },
    ];

    const filtered = category
      ? items.filter((item) => item.category === category)
      : items;

    return jsonResult({
      items: filtered.slice(0, limit),
      total: filtered.length,
    });
  },
});

// Create the server
const server = createMCPServer({
  name: "express-example",
  version: "1.0.0",
  tools: [echoTool, listItemsTool],
});

// MCP endpoint
app.post("/mcp", async (req, res) => {
  const response = await server.handleRequest(req.body);
  res.json(response);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: server.getInfo() });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running at http://localhost:${PORT}/mcp`);
  console.log(`📋 Available tools: echo, list_items`);
});

