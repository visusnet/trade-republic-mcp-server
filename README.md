# Trade Republic MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Trade Republic. **This repository includes both the MCP server and a Claude Skill for autonomous trading.**

With this project, AI assistants like Claude can check account balances, view market data, and execute trades via the included autonomous trading agent.

---

## ⚠️ IMPORTANT DISCLAIMER ⚠️

### Unofficial API - Use at Your Own Risk

**Trade Republic does NOT provide a public API.** This project reverse-engineers their internal WebSocket API based on community research (e.g., [pytr](https://github.com/marzzzello/pytr)).

> **Using this software may violate Trade Republic's Terms of Service.**
>
> - Your account could be suspended or terminated
> - Trade Republic may change their API at any time without notice
> - There is no official support or documentation
> - API behavior is based on community observation, not official specifications

### Educational Purposes Only

**This project is for EDUCATIONAL PURPOSES ONLY.** It demonstrates:

- How to build MCP servers for AI assistants
- WebSocket communication patterns
- ECDSA authentication flows

> **Do NOT use this software for actual trading without understanding the risks.**

### Real Money Warning

**If you choose to use this software with valid credentials, it will execute real trades on your Trade Republic account. Your actual funds can be bought, sold, or lost.**

> **Never use this software with funds you cannot afford to lose.**
>
> - The authors take NO responsibility for financial losses
> - The authors take NO responsibility for account suspension
> - Automated trading is inherently risky
> - Past performance does not guarantee future results

---

## Features

### MCP Tools

Access Trade Republic functionality through MCP tools:

- **Portfolio**: Get portfolio positions, cash balance
- **Market Data**: Get prices, price history, order books, search assets
- **Asset Info**: Get detailed instrument information
- **Market Status**: Check if markets are open
- **Orders**: Place, modify, cancel orders (coming soon)

### Autonomous Trading Agent (Coming Soon)

A Claude Skill that runs an autonomous trading bot with:

- Technical analysis
- Risk management
- Automatic order execution

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Trade Republic account
- Claude Code CLI

### 1. Clone and Setup

```bash
git clone https://github.com/your-username/trade-republic-bot
cd trade-republic-bot
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Claude

Add the MCP server to your Claude settings:

```json
{
  "mcpServers": {
    "trade-republic": {
      "url": "http://localhost:3006/mcp"
    }
  }
}
```

### 4. Start the Server

```bash
npm start
```

### 5. Authentication

The server requires Trade Republic credentials. You'll need to complete the authentication flow which includes:

1. Phone number
2. PIN
3. 2FA code (sent via SMS or app)

---

## Development

### Project Structure

```text
trade-republic-bot/
├── src/
│   ├── index.ts                      # Entry point
│   ├── logger.ts                     # Logging utilities
│   └── server/
│       ├── TradeRepublicMcpServer.ts # MCP server
│       ├── services/                 # API services
│       │   ├── TradeRepublicApiService.ts
│       │   ├── PortfolioService.ts
│       │   └── MarketDataService.ts
│       └── tools/                    # MCP tool registries
│           ├── PortfolioToolRegistry.ts
│           └── MarketDataToolRegistry.ts
├── docs/
│   ├── adr/                          # Architecture Decision Records
│   └── plans/                        # Implementation plans
└── package.json
```

### Scripts

```bash
npm start           # Start production server
npm run build       # Build TypeScript
npm test            # Run tests
npm run test:coverage # Run tests with coverage
npm run lint        # Check code style
npm run lint:fix    # Fix code style issues
npm run format      # Format code with Prettier
npm run knip        # Check for unused exports
```

### Code Quality

This project follows strict quality standards:

- **100% test coverage** required
- **ESLint** + **Prettier** for consistent code style
- **Conventional Commits** for clear history
- **Zod** for runtime validation

---

## Security

1. **Never commit credentials** - Use environment variables
2. **Monitor your account** - Check Trade Republic for unexpected activity
3. **Start small** - If testing with real funds, use minimal amounts
4. **Understand the risks** - This is unofficial software

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Not authenticated" | Complete the authentication flow first |
| "WebSocket connection failed" | Check your internet connection |
| "API error" | Trade Republic may have changed their API |

---

## Legal

### No Affiliation

This project is NOT affiliated with, endorsed by, or connected to Trade Republic Bank GmbH in any way.

### No Warranty

This software is provided "AS IS" without warranty of any kind. Use at your own risk.

### License

MIT

---

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io)
- [pytr](https://github.com/marzzzello/pytr) - Python Trade Republic API client (community research)
- [Claude Code](https://claude.ai/download)

---

## Contributing

Contributions are welcome, but please note:

1. This is an educational project
2. We cannot guarantee compatibility with Trade Republic's API
3. All contributions must include tests
4. Follow the existing code style
