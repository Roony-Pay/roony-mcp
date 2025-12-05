# @roony-pay/mcp

A lightweight, flexible TypeScript library for building MCP (Model Context Protocol) servers.

MCP is an open protocol from Anthropic that enables AI assistants to interact with external tools, resources, and prompts. This library makes it easy to build MCP-compliant servers that work with Claude, Cursor, and other MCP clients.

## Features

- 🚀 **Simple API** - Define tools with just a few lines of code
- 📦 **Zero dependencies** - Lightweight and fast
- 🔒 **Type-safe** - Full TypeScript support with generics
- 🔌 **Framework agnostic** - Works with Next.js, Express, Fastify, or any HTTP framework
- ⚡ **Full MCP support** - Tools, resources, and prompts

## Installation

```bash
npm install @roony-pay/mcp
# or
pnpm add @roony-pay/mcp
# or
yarn add @roony-pay/mcp
```

## Quick Start

```typescript
import { createMCPServer, defineTool, prop, textResult, jsonResult } from "@roony-pay/mcp";

// Define a tool
const helloTool = defineTool({
  name: "hello",
  description: "Say hello to someone",
  properties: {
    name: prop("string", { description: "Name to greet" }),
  },
  required: ["name"],
  handler: async (args) => {
    return textResult(`Hello, ${args.name}!`);
  },
});

// Create the server
const server = createMCPServer({
  name: "my-server",
  version: "1.0.0",
  tools: [helloTool],
});

// Handle requests (example with Next.js App Router)
export async function POST(req: Request) {
  const body = await req.json();
  const response = await server.handleRequest(body);
  return Response.json(response);
}
```

## Defining Tools

Tools are the primary way AI agents interact with your server. Each tool has a name, description, input schema, and handler function.

### Basic Tool

```typescript
import { defineTool, prop, textResult } from "@roony-pay/mcp";

const greetTool = defineTool({
  name: "greet",
  description: "Greet a user by name",
  properties: {
    name: prop("string", { description: "The user's name" }),
    formal: prop("boolean", { description: "Use formal greeting" }),
  },
  required: ["name"],
  handler: async (args) => {
    const greeting = args.formal ? "Good day" : "Hey";
    return textResult(`${greeting}, ${args.name}!`);
  },
});
```

### Tool with JSON Response

```typescript
import { defineTool, prop, jsonResult } from "@roony-pay/mcp";

const getUserTool = defineTool({
  name: "get_user",
  description: "Get user information",
  properties: {
    id: prop("string", { description: "User ID" }),
  },
  required: ["id"],
  handler: async (args) => {
    const user = await db.users.findById(args.id);
    return jsonResult({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  },
});
```

### Tool with Enum Options

```typescript
const searchTool = defineTool({
  name: "search",
  description: "Search for items",
  properties: {
    query: prop("string", { description: "Search query" }),
    category: prop("string", {
      description: "Category to search in",
      enum: ["books", "movies", "music"],
    }),
    limit: prop("number", {
      description: "Max results",
      default: 10,
    }),
  },
  required: ["query"],
  handler: async (args) => {
    // ...
  },
});
```

## Custom Context

Pass custom data to all your handlers using a context factory:

```typescript
interface MyContext {
  requestId: string | number;
  userId: string;
  db: Database;
}

const server = createMCPServer<MyContext>({
  name: "my-server",
  version: "1.0.0",
  tools: [myTool],
  createContext: async (request) => ({
    requestId: request.id,
    userId: await getUserFromRequest(request),
    db: database,
  }),
});

// Access context in handlers
const myTool = defineTool<{ query: string }, MyContext>({
  name: "search",
  description: "Search with user context",
  properties: {
    query: prop("string", { description: "Search query" }),
  },
  required: ["query"],
  handler: async (args, context) => {
    // Access context.userId, context.db, etc.
    const results = await context.db.search(args.query, context.userId);
    return jsonResult(results);
  },
});
```

## Resources

Expose data sources that AI agents can read:

```typescript
const server = createMCPServer({
  name: "my-server",
  version: "1.0.0",
  resources: [
    {
      uri: "file:///config.json",
      name: "Configuration",
      description: "Application configuration",
      mimeType: "application/json",
      handler: async (uri, context) => ({
        uri,
        mimeType: "application/json",
        text: JSON.stringify(config),
      }),
    },
  ],
});
```

## Prompts

Provide reusable prompt templates:

```typescript
const server = createMCPServer({
  name: "my-server",
  version: "1.0.0",
  prompts: [
    {
      name: "code_review",
      description: "Review code for best practices",
      arguments: [
        { name: "language", description: "Programming language", required: true },
        { name: "code", description: "Code to review", required: true },
      ],
      handler: async (args) => [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review this ${args.language} code:\n\n${args.code}`,
          },
        },
      ],
    },
  ],
});
```

## Framework Examples

### Next.js App Router

```typescript
// app/api/mcp/route.ts
import { createMCPServer, defineTool, prop, textResult } from "@roony-pay/mcp";

const server = createMCPServer({
  name: "my-nextjs-server",
  version: "1.0.0",
  tools: [/* your tools */],
});

export async function POST(req: Request) {
  const body = await req.json();
  const response = await server.handleRequest(body);
  return Response.json(response);
}
```

### Express

```typescript
import express from "express";
import { createMCPServer } from "@roony-pay/mcp";

const app = express();
app.use(express.json());

const server = createMCPServer({
  name: "my-express-server",
  version: "1.0.0",
  tools: [/* your tools */],
});

app.post("/mcp", async (req, res) => {
  const response = await server.handleRequest(req.body);
  res.json(response);
});

app.listen(3000);
```

### Fastify

```typescript
import Fastify from "fastify";
import { createMCPServer } from "@roony-pay/mcp";

const fastify = Fastify();

const server = createMCPServer({
  name: "my-fastify-server",
  version: "1.0.0",
  tools: [/* your tools */],
});

fastify.post("/mcp", async (request, reply) => {
  const response = await server.handleRequest(request.body);
  return response;
});

fastify.listen({ port: 3000 });
```

## API Reference

### `createMCPServer(config)`

Creates a new MCP server instance.

```typescript
const server = createMCPServer({
  name: string;              // Server name
  version: string;           // Server version
  protocolVersion?: string;  // MCP protocol version (default: "2024-11-05")
  tools?: MCPToolDefinition[];
  resources?: MCPResourceDefinition[];
  prompts?: MCPPromptDefinition[];
  createContext?: (request: MCPRequest) => Promise<TContext> | TContext;
});
```

### `defineTool(options)`

Define a tool with type-safe handler.

```typescript
const tool = defineTool({
  name: string;
  description: string;
  properties: Record<string, MCPToolProperty>;
  required?: string[];
  handler: (args, context) => Promise<MCPToolResult> | MCPToolResult;
});
```

### `prop(type, options)`

Create a property definition for tool input schemas.

```typescript
prop("string" | "number" | "boolean" | "array" | "object", {
  description: string;
  enum?: string[];
  default?: unknown;
});
```

### Result Helpers

```typescript
textResult(text: string, isError?: boolean): MCPToolResult
jsonResult(data: unknown, isError?: boolean): MCPToolResult
errorResult(message: string): MCPToolResult
multiResult(items: MCPContent[], isError?: boolean): MCPToolResult
```

### Validation Helpers

```typescript
validateArgs<T>(args, required: string[]): args is T
requireArg<T>(args, key: string, type: string): T
optionalArg<T>(args, key: string, defaultValue: T): T
```

## MCP Protocol

This library implements the [Model Context Protocol](https://modelcontextprotocol.io) specification (version 2024-11-05).

### Supported Methods

- `initialize` / `initialized`
- `ping`
- `tools/list` / `tools/call`
- `resources/list` / `resources/read`
- `prompts/list` / `prompts/get`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Roony](https://roony.pay)
