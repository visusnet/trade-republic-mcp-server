# Task 06: Market Data Tools - Implementation Plan 2

## Overview

Implement seven market data MCP tools for the Trade Republic trading bot: `get_price`, `get_price_history`, `get_order_book`, `search_assets`, `get_asset_info`, `get_market_status`, and `wait_for_market`.

## Research Summary

### Trade Republic API WebSocket Topics

Based on research from pytr and TradeRepublicApi:

| Tool | WebSocket Topic | Parameters | Notes |
|------|-----------------|------------|-------|
| get_price | `ticker` | `{ id: "{ISIN}.{EXCHANGE}" }` | Returns bid, ask, last, open, pre prices |
| get_price_history | `aggregateHistory` | `{ id: "{ISIN}", range: "1d"|"5d"|"1m"|"3m"|"6m"|"1y"|"5y"|"max" }` | Historical price data |
| get_order_book | `ticker` | Same as get_price | Bid/ask sizes from ticker response |
| search_assets | `neonSearch` | `{ query, filter }` | Asset search functionality |
| get_asset_info | `instrument` | `{ id: "{ISIN}" }` | Instrument details |
| get_market_status | `homeInstrumentExchange` | `{ id: "{ISIN}.{EXCHANGE}" }` | Exchange status |
| wait_for_market | `ticker` | Polling with timeout | Wait until market opens |

### Ticker Response Structure (from pytr)

```typescript
{
  bid: { price: number, size: number, time: string },
  ask: { price: number, size: number, time: string },
  last: { price: number, size: number, time: string },
  open: { price: number, size: number, time: string },
  pre: { price: number, size: number, time: string },
  qualityId: 'realtime' | 'delayed',
  delta?: number,
  leverage?: number
}
```

### Instrument Response Structure

```typescript
{
  isin: string,
  wkn: string,
  name: string,
  shortName: string,
  intlSymbol: string,
  typeId: 'stock' | 'fund' | 'etf' | 'derivative' | 'crypto' | 'bond',
  company: { name: string, description: string },
  exchanges: Array<{ id: string, name: string, open: boolean }>,
  tags: Array<{ id: string, name: string, icon: string }>
}
```

---

## Architecture

```
TradeRepublicMcpServer
    ├── PortfolioToolRegistry (existing)
    │       └── PortfolioService (existing)
    │
    └── MarketDataToolRegistry (NEW)
            └── MarketDataService (NEW)
                    └── TradeRepublicApiService (existing)
```

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/server/services/MarketDataService.ts` | Service implementation |
| `src/server/services/MarketDataService.spec.ts` | Service tests |
| `src/server/services/MarketDataService.request.ts` | Zod request schemas |
| `src/server/services/MarketDataService.response.ts` | Zod response schemas |
| `src/server/services/MarketDataService.types.ts` | Type definitions and enums |
| `src/server/tools/MarketDataToolRegistry.ts` | Tool registry |
| `src/server/tools/MarketDataToolRegistry.spec.ts` | Tool registry tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/server/services/index.ts` | Export new modules |
| `src/server/tools/index.ts` | Export MarketDataToolRegistry |
| `src/server/TradeRepublicMcpServer.ts` | Integrate services |

---

## Implementation Steps

### Step 1: Create MarketDataService.types.ts

Define enums for:
- `Exchange` (LSX, TG, QTX)
- `TimeRange` (1d, 5d, 1m, 3m, 6m, 1y, 5y, max)
- `AssetType` (stock, etf, fund, derivative, crypto, bond)
- `MarketStatus` (open, closed, pre_market, after_hours)

### Step 2: Create MarketDataService.request.ts

Zod schemas with:
- ISIN validation (12-character format)
- Exchange enum with default LSX
- TimeRange enum for history
- Limit parameter (1-50) for search
- Timeout/poll parameters for wait_for_market

### Step 3: Create MarketDataService.response.ts

Response schemas with transforms for normalization. NO `.passthrough()`.

### Step 4: Create MarketDataService.spec.ts (RED Phase)

Comprehensive tests following PortfolioService.spec.ts pattern:
- Authentication checks
- Topic subscription verification
- Successful response handling
- API error handling (MESSAGE_CODE.E)
- Timeout handling
- Cleanup verification
- WebSocket error handling
- Invalid response format handling

Estimated: ~100+ test cases across 7 methods

### Step 5: Create MarketDataService.ts (GREEN Phase)

Implementation with:
- Public constructor
- 7 public methods with explicit `public` modifier
- Private `subscribeAndWait` with payload support
- Private `ensureAuthenticated`
- Private `sleep` for polling

### Step 6: Create MarketDataToolRegistry.spec.ts (RED Phase)

Test cases for each tool registration and handler behavior.

### Step 7: Create MarketDataToolRegistry.ts (GREEN Phase)

Register all 7 tools with descriptions and input schemas.

### Step 8: Update Index Files

Export new modules from services and tools.

### Step 9: Update TradeRepublicMcpServer.ts

Add MarketDataService and MarketDataToolRegistry integration.

### Step 10: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## WebSocket Topics Summary

| Tool | Topic | Payload Format |
|------|-------|----------------|
| get_price | `ticker` | `{ id: "{ISIN}.{EXCHANGE}" }` |
| get_price_history | `aggregateHistory` | `{ id: "{ISIN}", range: "{range}" }` |
| get_order_book | `ticker` | `{ id: "{ISIN}.{EXCHANGE}" }` |
| search_assets | `neonSearch` | `{ q: "{query}", filter: [...], limit: n }` |
| get_asset_info | `instrument` | `{ id: "{ISIN}" }` |
| get_market_status | Uses `getAssetInfo` internally | N/A |
| wait_for_market | Uses `getMarketStatus` + `getPrice` | N/A |

---

## Key Implementation Notes

1. **NO `.passthrough()`** - All Zod schemas define explicit fields only
2. **Explicit `public` visibility** - All public methods have explicit `public` modifier
3. **ISIN Validation** - 12-character format: 2 letters + 10 alphanumeric
4. **Exchange Default** - LSX (Lang & Schwarz Exchange) is the default
5. **Ticker ID Format** - `{ISIN}.{EXCHANGE}` (e.g., `DE0007164600.LSX`)
6. **Error Handling** - Same pattern as PortfolioService with cleanup
7. **Logging** - Use logger.api for all API-related logs

---

## Potential Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Topic names may differ from research | Add fallback topic names in implementation |
| Field names may vary | Use `.transform()` for normalization |
| API rate limiting | Add exponential backoff (future enhancement) |
| Market status determination | Use instrument exchange data as primary source |
