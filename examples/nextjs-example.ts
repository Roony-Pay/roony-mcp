/**
 * Example: Next.js App Router MCP Endpoint
 * 
 * This example shows how to create an MCP server in a Next.js API route.
 * 
 * File: app/api/mcp/route.ts
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

// Define custom context (optional)
interface AppContext extends MCPContext {
  userId: string;
}

// Define tools
const calculatorTool = defineTool({
  name: "calculate",
  description: "Perform basic math operations",
  properties: {
    operation: prop("string", {
      description: "The operation to perform",
      enum: ["add", "subtract", "multiply", "divide"],
    }),
    a: prop("number", { description: "First number" }),
    b: prop("number", { description: "Second number" }),
  },
  required: ["operation", "a", "b"],
  handler: async (args) => {
    const { operation, a, b } = args as { operation: string; a: number; b: number };

    let result: number;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) return errorResult("Cannot divide by zero");
        result = a / b;
        break;
      default:
        return errorResult(`Unknown operation: ${operation}`);
    }

    return textResult(`${a} ${operation} ${b} = ${result}`);
  },
});

const weatherTool = defineTool({
  name: "get_weather",
  description: "Get current weather for a city",
  properties: {
    city: prop("string", { description: "City name" }),
    units: prop("string", {
      description: "Temperature units",
      enum: ["celsius", "fahrenheit"],
      default: "celsius",
    }),
  },
  required: ["city"],
  handler: async (args) => {
    const { city, units = "celsius" } = args as { city: string; units?: string };

    // In production, call a real weather API
    const mockWeather = {
      city,
      temperature: units === "celsius" ? 22 : 72,
      units,
      condition: "Partly cloudy",
      humidity: 65,
    };

    return jsonResult(mockWeather);
  },
});

// Create the server
const server = createMCPServer<AppContext>({
  name: "nextjs-example",
  version: "1.0.0",
  tools: [calculatorTool, weatherTool],
  createContext: async (request) => ({
    requestId: request.id,
    userId: "user-123", // In production, extract from auth
  }),
});

// Next.js App Router handler
export async function POST(req: Request) {
  const body = await req.json();
  const response = await server.handleRequest(body);
  return Response.json(response);
}

