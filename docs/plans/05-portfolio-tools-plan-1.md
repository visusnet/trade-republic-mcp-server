# Task 05: Portfolio Tools - Plan 1

## Overview

Implement `get_portfolio` and `get_cash_balance` MCP tools for the Trade Republic trading bot.

## Trade Republic API Topics

Based on pytr and Trade_Republic_Connector research:

| Tool | WebSocket Topic | Description |
|------|-----------------|-------------|
| get_portfolio | `compactPortfolio` | Returns portfolio with positions |
| get_cash_balance | `cash` | Returns available cash balance |

## Architecture

```
TradeRepublicMcpServer
    └── PortfolioToolRegistry (new)
            └── PortfolioService (new)
                    └── TradeRepublicApiService (existing)
```

## File Structure

**New files:**
- `src/server/services/PortfolioService.ts`
- `src/server/services/PortfolioService.spec.ts`
- `src/server/services/PortfolioService.request.ts`
- `src/server/services/PortfolioService.response.ts`
- `src/server/tools/PortfolioToolRegistry.ts`
- `src/server/tools/PortfolioToolRegistry.spec.ts`

**Modified files:**
- `src/server/services/TradeRepublicApiService.ts` - Add offMessage/offError methods
- `src/server/services/index.ts` - Export new modules
- `src/server/TradeRepublicMcpServer.ts` - Integrate tools

## Key Implementation Details

### PortfolioService
- Subscribes to WebSocket topics and waits for response
- Handles timeout and cleanup
- Validates responses with Zod schemas
- Requires authentication before making requests

### Response Schemas
- Portfolio: positions array, netValue, unrealised profit metrics
- Cash: availableCash, currency

### Error Handling
- Authentication check before each request
- Timeout handling (30 second default)
- API error responses (code 'E')
- Zod validation errors
- Automatic cleanup on completion

## TDD Approach
1. Write tests for offMessage/offError
2. Implement offMessage/offError
3. Write tests for PortfolioService
4. Implement PortfolioService
5. Write tests for PortfolioToolRegistry
6. Implement PortfolioToolRegistry
7. Integrate with TradeRepublicMcpServer
