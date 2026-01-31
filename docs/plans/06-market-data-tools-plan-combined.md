# Task 06: Market Data Tools - Combined Plan

## Overview

Implement seven market data MCP tools:
- `get_price` - Current bid/ask/last prices
- `get_price_history` - Historical OHLCV data
- `get_order_book` - Bid/ask order book (top-of-book only)
- `search_assets` - Search for tradable assets
- `get_asset_info` - Detailed instrument information
- `get_market_status` - Check if market is open
- `wait_for_market` - Wait until market opens

## Trade Republic API Topics

| Tool | WebSocket Topic | Payload |
|------|-----------------|---------|
| get_price | `ticker` | `{ id: "ISIN.EXCHANGE" }` |
| get_price_history | `aggregateHistory` | `{ id: "ISIN.EXCHANGE", range: "1d" }` |
| get_order_book | `ticker` | `{ id: "ISIN.EXCHANGE" }` |
| search_assets | `neonSearch` | `{ data: { q: "query" } }` |
| get_asset_info | `instrument` | `{ id: "ISIN" }` |
| get_market_status | `ticker` | Derive from bid/ask availability |
| wait_for_market | N/A | Polls getMarketStatus |

## Architecture

```
TradeRepublicMcpServer
    ├── PortfolioToolRegistry (existing)
    └── MarketDataToolRegistry (new)
            └── MarketDataService (new)
                    └── TradeRepublicApiService (existing)
```

## File Structure

### New Files
- `src/server/services/MarketDataService.ts`
- `src/server/services/MarketDataService.spec.ts`
- `src/server/services/MarketDataService.request.ts`
- `src/server/services/MarketDataService.response.ts`
- `src/server/tools/MarketDataToolRegistry.ts`
- `src/server/tools/MarketDataToolRegistry.spec.ts`

### Modified Files
- `src/server/services/index.ts`
- `src/server/services/index.spec.ts`
- `src/server/tools/index.ts`
- `src/server/TradeRepublicMcpServer.ts`
- `src/server/TradeRepublicMcpServer.spec.ts`

---

## Implementation Steps

### Step 1: Create MarketDataService.request.ts

```typescript
import { z } from 'zod';

/** Valid time ranges for price history */
export const TimeRangeSchema = z.enum(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'max']);
export type TimeRange = z.output<typeof TimeRangeSchema>;

/** Default exchange - Lang & Schwarz */
const DEFAULT_EXCHANGE = 'LSX';

export const GetPriceRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetPriceRequest = z.output<typeof GetPriceRequestSchema>;

export const GetPriceHistoryRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range: 1d, 5d, 1m, 3m, 6m, 1y, 5y, max'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetPriceHistoryRequest = z.output<typeof GetPriceHistoryRequestSchema>;

export const GetOrderBookRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetOrderBookRequest = z.output<typeof GetOrderBookRequestSchema>;

export const SearchAssetsRequestSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  limit: z.number().int().min(1).max(50).default(10).optional().describe('Max results (default: 10)'),
});
export type SearchAssetsRequest = z.output<typeof SearchAssetsRequestSchema>;

export const GetAssetInfoRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
});
export type GetAssetInfoRequest = z.output<typeof GetAssetInfoRequestSchema>;

export const GetMarketStatusRequestSchema = z.object({
  isin: z.string().describe('ISIN to check market status'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetMarketStatusRequest = z.output<typeof GetMarketStatusRequestSchema>;

export const WaitForMarketRequestSchema = z.object({
  isin: z.string().describe('ISIN to monitor'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000).optional()
    .describe('Timeout ms (default: 60000, max: 300000)'),
  pollIntervalMs: z.number().int().min(1000).max(30000).default(5000).optional()
    .describe('Poll interval ms (default: 5000)'),
});
export type WaitForMarketRequest = z.output<typeof WaitForMarketRequestSchema>;
```

---

### Step 2: Create MarketDataService.response.ts

NO `.passthrough()`. Use transforms for normalization.

```typescript
import { z } from 'zod';

/** Convert string numbers to numbers */
const numericString = z.union([z.number(), z.string()]).transform((v) =>
  typeof v === 'string' ? parseFloat(v) : v
);

/** Internal ticker response from API */
const TickerApiSchema = z.object({
  bid: z.object({ price: numericString, size: numericString.optional() }),
  ask: z.object({ price: numericString, size: numericString.optional() }),
  last: z.object({ price: numericString, time: z.string().optional() }).optional(),
  open: z.object({ price: numericString }).optional(),
  pre: z.object({ price: numericString }).optional(),
  qualityId: z.string().optional(),
});
export const TickerApiResponseSchema = TickerApiSchema;

export const GetPriceResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  bid: z.number(),
  ask: z.number(),
  last: z.number().optional(),
  spread: z.number(),
  spreadPercent: z.number(),
  timestamp: z.string(),
});
export type GetPriceResponse = z.output<typeof GetPriceResponseSchema>;

const CandleSchema = z.object({
  time: z.number(),
  open: numericString,
  high: numericString,
  low: numericString,
  close: numericString,
  volume: numericString.optional(),
});

export const AggregateHistoryApiSchema = z.object({
  aggregates: z.array(CandleSchema),
  resolution: z.number().optional(),
});

export const GetPriceHistoryResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  candles: z.array(z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number().optional(),
  })),
  resolution: z.number().optional(),
});
export type GetPriceHistoryResponse = z.output<typeof GetPriceHistoryResponseSchema>;

export const GetOrderBookResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  bids: z.array(z.object({ price: z.number(), size: z.number().optional() })),
  asks: z.array(z.object({ price: z.number(), size: z.number().optional() })),
  spread: z.number(),
  midPrice: z.number(),
  timestamp: z.string(),
});
export type GetOrderBookResponse = z.output<typeof GetOrderBookResponseSchema>;

const SearchResultSchema = z.object({
  isin: z.string(),
  name: z.string(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const NeonSearchApiSchema = z.object({
  results: z.array(z.object({
    isin: z.string(),
    name: z.string(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })),
});

export const SearchAssetsResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  totalCount: z.number(),
});
export type SearchAssetsResponse = z.output<typeof SearchAssetsResponseSchema>;

export const InstrumentApiSchema = z.object({
  isin: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  intlSymbol: z.string().optional(),
  homeSymbol: z.string().optional(),
  typeId: z.string().optional(),
  wkn: z.string().optional(),
  company: z.object({
    name: z.string(),
    description: z.string().optional(),
    countryOfOrigin: z.string().optional(),
  }).optional(),
  exchanges: z.array(z.object({
    exchangeId: z.string(),
    name: z.string().optional(),
  })).optional(),
  tags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});

export const GetAssetInfoResponseSchema = z.object({
  isin: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  symbol: z.string().optional(),
  type: z.string().optional(),
  wkn: z.string().optional(),
  company: z.object({
    name: z.string(),
    description: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  exchanges: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
  tags: z.array(z.string()).optional(),
});
export type GetAssetInfoResponse = z.output<typeof GetAssetInfoResponseSchema>;

export const MarketStatusSchema = z.enum(['open', 'closed', 'pre-market', 'post-market', 'unknown']);
export type MarketStatus = z.output<typeof MarketStatusSchema>;

export const GetMarketStatusResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  status: MarketStatusSchema,
  isOpen: z.boolean(),
  hasBid: z.boolean(),
  hasAsk: z.boolean(),
  timestamp: z.string(),
});
export type GetMarketStatusResponse = z.output<typeof GetMarketStatusResponseSchema>;

export const WaitForMarketResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  isOpen: z.boolean(),
  waitedMs: z.number(),
  timedOut: z.boolean(),
  timestamp: z.string(),
});
export type WaitForMarketResponse = z.output<typeof WaitForMarketResponseSchema>;
```

---

### Step 3: Create MarketDataService.spec.ts (RED)

Test categories per method:
1. Authentication check
2. Topic subscription with correct payload
3. Success response handling
4. API error handling (MESSAGE_CODE.E)
5. Timeout handling
6. Cleanup verification
7. WebSocket error handling
8. Invalid response format

Estimated: ~80-100 test cases

---

### Step 4: Create MarketDataService.ts (GREEN)

Follow PortfolioService pattern with `subscribeAndWait` that accepts payload.

Key methods:
- `public async getPrice(request)` - Subscribe to `ticker` topic
- `public async getPriceHistory(request)` - Subscribe to `aggregateHistory` topic
- `public async getOrderBook(request)` - Subscribe to `ticker` topic
- `public async searchAssets(request)` - Subscribe to `neonSearch` topic
- `public async getAssetInfo(request)` - Subscribe to `instrument` topic
- `public async getMarketStatus(request)` - Derive from ticker data
- `public async waitForMarket(request)` - Poll getMarketStatus

---

### Step 5: Create MarketDataToolRegistry.spec.ts (RED)

Test cases:
- Register 7 tools with correct metadata
- Each handler calls service method
- Success/error result formatting

---

### Step 6: Create MarketDataToolRegistry.ts (GREEN)

Register all 7 tools with descriptions and input schemas.

---

### Step 7: Update index files

- `services/index.ts` - Export MarketDataService and schemas
- `services/index.spec.ts` - Test new exports
- `tools/index.ts` - Export MarketDataToolRegistry

---

### Step 8: Update TradeRepublicMcpServer.ts

Integrate MarketDataService and MarketDataToolRegistry similar to Portfolio.

---

### Step 9: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

---

## Key Technical Details

- **Default Exchange**: LSX (Lang & Schwarz)
- **Ticker ID Format**: `{ISIN}.{EXCHANGE}`
- **Subscription timeout**: 30 seconds
- **wait_for_market defaults**: 60s timeout, 5s poll interval
- **NO `.passthrough()`** in any schema
- **Explicit `public`** on all public methods
