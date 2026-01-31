# Task 06: Market Data Tools - Implementation Plan 1

## Overview

Implement market data MCP tools for the Trade Republic trading bot:
- `get_price` - Get current price for an asset
- `get_price_history` - Get historical OHLCV data
- `get_order_book` - Get bid/ask order book (via ticker topic)
- `search_assets` - Search for assets by query
- `get_asset_info` - Get detailed asset information
- `get_market_status` - Get market status (derived from ticker data)
- `wait_for_market` - Wait until market opens (polling with timeout)

## Research Findings

### Trade Republic WebSocket Topics for Market Data

Based on pytr research:

| Tool | WebSocket Topic | Payload | Notes |
|------|-----------------|---------|-------|
| `get_price` | `ticker` | `{ id: "{isin}.{exchange}" }` | Returns bid, ask, last price |
| `get_price_history` | `aggregateHistory` | `{ id: "{isin}.{exchange}", range: timeframe }` | Timeframes: 1d, 5d, 1m, 3m, 6m, 1y, 5y, max |
| `get_order_book` | `ticker` | `{ id: "{isin}.{exchange}" }` | TR has limited order book (bid/ask only) |
| `search_assets` | `neonSearch` | `{ data: { q: query } }` | Search functionality |
| `get_asset_info` | `instrument` | `{ id: isin }` | Returns name, type, exchange info |
| `get_market_status` | `ticker` | `{ id: "{isin}.{exchange}" }` | Derive from price activity |
| `wait_for_market` | N/A | Polling `ticker` | Poll until bid/ask available |

### Default Exchange

Trade Republic uses `LSX` (Lang & Schwarz Exchange) as the default exchange for most instruments.

### Timeframe Values for aggregateHistory

Valid range values: `"1d"`, `"5d"`, `"1m"`, `"3m"`, `"6m"`, `"1y"`, `"5y"`, `"max"`

---

## Architecture

```
TradeRepublicMcpServer
    ├── PortfolioToolRegistry (existing)
    │       └── PortfolioService (existing)
    └── MarketDataToolRegistry (new)
            └── MarketDataService (new)
                    └── TradeRepublicApiService (existing)
```

---

## File Structure

### New Files

```
src/server/services/MarketDataService.ts
src/server/services/MarketDataService.spec.ts
src/server/services/MarketDataService.request.ts
src/server/services/MarketDataService.response.ts
src/server/tools/MarketDataToolRegistry.ts
src/server/tools/MarketDataToolRegistry.spec.ts
```

### Modified Files

```
src/server/services/index.ts - Export MarketDataService
src/server/tools/index.ts - Export MarketDataToolRegistry
src/server/TradeRepublicMcpServer.ts - Register MarketDataToolRegistry
```

---

## Implementation Steps

### Step 1: Create MarketDataService.request.ts

Request schemas with Zod for all 7 tools. Key features:
- `TimeframeSchema` enum for valid time ranges
- Default exchange of `LSX`
- Optional exchange parameter on price-related tools
- Limit parameter for search (1-50, default 10)
- Timeout/poll parameters for wait_for_market

### Step 2: Create MarketDataService.response.ts

Response schemas with transforms for field normalization. NO `.passthrough()` per requirements.

Key schemas:
- `TickerResponseSchema` - bid/ask/last/open/pre prices
- `GetPriceResponseSchema` - derived with spread calculation
- `AggregateHistoryResponseSchema` - OHLCV candles
- `GetOrderBookResponseSchema` - bids/asks with midPrice
- `SearchAssetsResponseSchema` - results array
- `InstrumentResponseSchema` - detailed asset info
- `GetMarketStatusResponseSchema` - status enum
- `WaitForMarketResponseSchema` - waited/timedOut flags

### Step 3: Create MarketDataService.spec.ts (RED Phase)

Test categories per method:
1. Should throw if not authenticated
2. Should subscribe to correct topic with correct payload
3. Should resolve with validated data on success
4. Should calculate derived values correctly (spread, etc.)
5. Should reject on API error (code E)
6. Should reject on timeout
7. Should handle missing optional fields
8. Should cleanup on all paths

### Step 4: Create MarketDataService.ts (GREEN Phase)

Service implementation with:
- Constructor accepting TradeRepublicApiService
- `subscribeAndWait` helper with payload support
- 7 public methods for each tool
- `ensureAuthenticated` check
- `sleep` helper for polling

### Step 5: Create MarketDataToolRegistry.spec.ts (RED Phase)

Tests for tool registration and handler behavior.

### Step 6: Create MarketDataToolRegistry.ts (GREEN Phase)

Register all 7 tools with proper descriptions and input schemas.

### Step 7: Update index files

Export new modules from services/index.ts and tools/index.ts.

### Step 8: Update TradeRepublicMcpServer.ts

Integrate MarketDataService and MarketDataToolRegistry.

### Step 9: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Key Technical Details

### WebSocket Topics Summary

| Tool | Topic | Payload |
|------|-------|---------|
| get_price | ticker | `{ id: "ISIN.EXCHANGE" }` |
| get_price_history | aggregateHistory | `{ id: "ISIN.EXCHANGE", range: "1d" }` |
| get_order_book | ticker | `{ id: "ISIN.EXCHANGE" }` |
| search_assets | neonSearch | `{ data: { q: "query" } }` |
| get_asset_info | instrument | `{ id: "ISIN" }` |
| get_market_status | ticker | `{ id: "ISIN.EXCHANGE" }` |
| wait_for_market | N/A | Polls getMarketStatus |

### Default Values

- Exchange: `LSX` (Lang & Schwarz)
- Subscription timeout: 30 seconds
- wait_for_market timeout: 60 seconds
- wait_for_market poll interval: 5 seconds

### Error Handling

1. Authentication check (ensureAuthenticated)
2. Timeout (30s default for subscriptions)
3. API errors (MESSAGE_CODE.E)
4. Zod validation errors
5. Automatic cleanup on all paths

### Differences from PortfolioService

1. `subscribeAndWait` accepts payload parameter (not just topic)
2. Response schemas do NOT use `.passthrough()` per requirements
3. Market status derived from ticker data availability
4. wait_for_market uses polling pattern
