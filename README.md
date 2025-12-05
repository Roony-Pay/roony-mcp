# Roony Governance

**Open source AI agent payment governance engine.**

Give your AI agents the ability to make purchases with built-in spending controls, approval workflows, and audit trails.

<p align="center">
  <img src="https://img.shields.io/npm/v/@roony-pay/governance" alt="npm version">
  <img src="https://img.shields.io/github/license/roony-pay/roony-mcp" alt="license">
  <img src="https://img.shields.io/github/stars/roony-pay/roony-mcp" alt="stars">
</p>

## Why Roony?

AI agents are increasingly autonomous—booking travel, purchasing software, managing subscriptions. But how do you give an AI your credit card without losing control?

**Roony provides:**

- 🔒 **Spending Limits** - Per-transaction, daily, and monthly caps
- 🏪 **Merchant Controls** - Allow/block specific merchants or categories  
- 👤 **Human Approval** - Require review for large or unusual purchases
- 🏢 **Organization Guardrails** - Company-wide policies across all agents
- 💳 **Virtual Cards** - Single-use cards that expire after purchase
- 🤖 **MCP Support** - Works with Claude, Cursor, and other MCP clients

## Quick Start

### Option 1: Use Hosted Roony (Easiest)

Just use [roony.pay](https://roony.pay) - we handle everything:
- Dashboard to manage agents and policies
- Stripe integration for virtual cards
- No infrastructure to manage

### Option 2: Self-Host

```bash
npm install @roony-pay/governance
```

```typescript
import {
  createRoonyMCPServer,
  InMemoryStorageProvider,
  MockPaymentProvider,
} from "@roony-pay/governance";

// Create providers (use your own implementations for production)
const storage = new InMemoryStorageProvider();
const payments = new MockPaymentProvider();

// Add an organization
storage.addOrganization({
  id: "org_123",
  name: "Acme Corp",
  monthlyBudget: 10000,
  guardrails: {
    maxTransactionAmount: 500,
    requireApprovalAbove: 200,
  },
});

// Add an agent with spending controls
storage.addAgent({
  id: "agent_123",
  organizationId: "org_123",
  name: "Shopping Assistant",
  status: "active",
  monthlyLimit: 1000,
  perTransactionLimit: 100,
  approvalThreshold: 50,
  flagNewVendors: true,
});

// Create MCP server
const server = createRoonyMCPServer({
  storage,
  paymentProvider: payments,
});

// Handle requests (e.g., in Next.js API route)
export async function POST(req: Request) {
  const body = await req.json();
  const response = await server.handleRequest(body, "agent_123", "org_123");
  return Response.json(response);
}
```

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Agent   │────▶│  Roony Gateway   │────▶│  Your Payment   │
│  (Claude)   │     │                  │     │  Provider       │
└─────────────┘     │  ✓ Check limits  │     │  (Stripe, etc)  │
                    │  ✓ Evaluate rules│     └─────────────────┘
                    │  ✓ Log & audit   │              │
                    │  ✓ Issue card    │              ▼
                    └──────────────────┘     ┌─────────────────┐
                             │               │    Merchant     │
                             ▼               └─────────────────┘
                    ┌──────────────────┐
                    │  Approval Queue  │
                    │  (if needed)     │
                    └──────────────────┘
```

### MCP Tools

When connected via MCP, agents have access to these tools:

| Tool | Description |
|------|-------------|
| `request_purchase` | Request a purchase, get a virtual card if approved |
| `check_budget` | Check remaining budget and limits |
| `list_transactions` | View transaction history |
| `get_policy_info` | See what rules apply to this agent |

### Example: Agent Requests a Purchase

```json
// Agent calls request_purchase
{
  "amount": 49.99,
  "currency": "usd",
  "description": "Monthly Figma subscription",
  "merchant_name": "Figma"
}

// If approved, agent receives:
{
  "status": "approved",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "hard_limit_amount": 49.99,
  "expires_at": "2025-12-05T15:00:00Z"
}

// If rejected:
{
  "status": "rejected",
  "reason_code": "OVER_TRANSACTION_LIMIT",
  "message": "Amount $49.99 exceeds per-transaction limit of $25.00",
  "suggestion": "Try a smaller purchase amount..."
}

// If needs approval:
{
  "status": "pending_approval",
  "message": "Amount exceeds approval threshold",
  "purchase_intent_id": "pi_abc123"
}
```

## Spending Controls

### Agent-Level Controls

| Control | Description |
|---------|-------------|
| `monthlyLimit` | Max spend per month |
| `dailyLimit` | Max spend per day |
| `perTransactionLimit` | Max per single purchase |
| `approvalThreshold` | Require human approval above this |
| `flagNewVendors` | Require approval for first purchase at new merchants |
| `blockedMerchants` | List of blocked merchant names |
| `allowedMerchants` | If set, only these merchants allowed |

### Organization Guardrails

| Guardrail | Description |
|-----------|-------------|
| `monthlyBudget` | Total budget across all agents |
| `maxTransactionAmount` | Hard cap on any single transaction |
| `requireApprovalAbove` | All purchases above this need review |
| `flagAllNewVendors` | All new vendors need approval |
| `blockCategories` | Block entire merchant categories |

## Implementing Providers

### Storage Provider

Implement `StorageProvider` to use your own database:

```typescript
import type { StorageProvider } from "@roony-pay/governance";

class PostgresStorageProvider implements StorageProvider {
  async getAgent(agentId: string) {
    return await db.query("SELECT * FROM agents WHERE id = $1", [agentId]);
  }
  
  async getAgentSpend(agentId: string, period: "daily" | "monthly") {
    // Sum approved purchases for the period
  }
  
  // ... implement other methods
}
```

### Payment Provider

Implement `PaymentProvider` to use your payment processor:

```typescript
import type { PaymentProvider } from "@roony-pay/governance";
import Stripe from "stripe";

class StripePaymentProvider implements PaymentProvider {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  async createVirtualCard(request) {
    const card = await this.stripe.issuing.cards.create({
      cardholder: process.env.CARDHOLDER_ID,
      type: "virtual",
      currency: request.currency,
      spending_controls: {
        spending_limits: [{
          amount: request.amount * 100,
          interval: "all_time",
        }],
      },
    });
    
    // Return card details
  }
}
```

## Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  roony:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://...
      - STRIPE_SECRET_KEY=sk_...
      - STRIPE_CARDHOLDER_ID=ich_...
```

## API Reference

### `createRoonyMCPServer(config)`

Create an MCP server for AI agent governance.

```typescript
const server = createRoonyMCPServer({
  storage: StorageProvider,      // Your database implementation
  paymentProvider: PaymentProvider, // Your payment processor
});

// Handle requests
const response = await server.handleRequest(
  mcpRequest,   // The MCP JSON-RPC request
  agentId,      // ID of the agent making the request  
  organizationId // ID of the organization
);
```

### `createSpendingChecker(config)`

Create a standalone spending checker (without MCP):

```typescript
const checker = createSpendingChecker({
  storage: myStorageProvider,
});

const result = await checker.checkSpending({
  agentId: "agent_123",
  amount: 50.00,
  currency: "usd",
  merchantName: "Amazon",
  description: "Office supplies",
});

if (result.allowed && !result.requiresApproval) {
  // Proceed with purchase
} else if (result.requiresApproval) {
  // Queue for human review
} else {
  // Rejected - show result.rejectionMessage
}
```

## Rejection Codes

| Code | Description |
|------|-------------|
| `AGENT_NOT_FOUND` | Agent ID not found |
| `OVER_TRANSACTION_LIMIT` | Exceeds per-transaction limit |
| `DAILY_LIMIT_EXCEEDED` | Daily spending limit reached |
| `MONTHLY_LIMIT_EXCEEDED` | Monthly spending limit reached |
| `ORG_BUDGET_EXCEEDED` | Organization budget exhausted |
| `OVER_ORG_MAX_TRANSACTION` | Exceeds org max transaction |
| `MERCHANT_BLOCKED` | Merchant is blocked |
| `MERCHANT_NOT_ALLOWED` | Merchant not in allowlist |
| `CATEGORY_BLOCKED` | Merchant category blocked |

## Hosted vs Self-Hosted

| Feature | Self-Hosted | Hosted (roony.pay) |
|---------|-------------|-------------------|
| Spending controls | ✅ | ✅ |
| Approval workflows | ✅ | ✅ |
| MCP support | ✅ | ✅ |
| Virtual cards | You implement | ✅ Built-in |
| Dashboard | You build | ✅ Included |
| Stripe integration | You implement | ✅ Included |
| Support | Community | Priority |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone the repo
git clone https://github.com/roony-pay/roony-mcp.git
cd roony-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## License

MIT © [Roony](https://roony.pay)

---

**Questions?** Open an issue or reach out at hello@roony.pay
