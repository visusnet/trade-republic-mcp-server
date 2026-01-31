# Task 05: Portfolio Tools - Plan 2

## Overview

Implement `get_portfolio` and `get_cash_balance` MCP tools for the Trade Republic trading bot.

## Trade Republic API Topics

| Tool | WebSocket Topic | Description |
|------|-----------------|-------------|
| get_portfolio | `portfolio` | Returns full portfolio data |
| get_cash_balance | `cash` | Returns cash balance |

## Architecture

Same as Plan 1 - follows existing patterns from coinbase-mcp-server.

## Key Differences from Plan 1

1. **Topic name**: Uses `portfolio` instead of `compactPortfolio`
2. **Response field names**: Uses `cash` field instead of `availableCash`
3. **Schema approach**: More lenient with optional fields and passthrough

## Response Schemas

### Portfolio Position
```typescript
{
  instrumentId: string,
  netSize: number,
  netValue: number,
  averageBuyIn: number,  // Note: different field name
  realisedProfit: number
}
```

### Cash Balance
```typescript
{
  cash: number,  // Note: different field name
  currency: string
}
```

## Test Strategy

1. Service tests with mocked TradeRepublicApiService
2. Tool registry tests with mocked PortfolioService
3. Use short timeouts in tests for faster execution
4. Test cleanup on success, error, and timeout

## Dependencies

No new npm dependencies required.
