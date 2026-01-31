# Task 06: Market Data Tools - Final Implementation Plan

## Overview

Implement seven market data MCP tools:
- `get_price` - Current bid/ask/last prices
- `get_price_history` - Historical OHLCV data
- `get_order_book` - Bid/ask order book (top-of-book only)
- `search_assets` - Search for tradable assets
- `get_asset_info` - Detailed instrument information
- `get_market_status` - Check if market is open
- `wait_for_market` - Wait until market opens

## Verification Notes Applied

From verification agents:
1. **Allow `.passthrough()`** - Consistent with PortfolioService pattern and retrospective Issue 006
2. **`subscribeAndWait` needs payload** - Extended signature shown below
3. **Use `.default().optional()` pattern** - For optional parameters with defaults

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
- `src/server/services/index.ts` - Export MarketDataService
- `src/server/services/index.spec.ts` - Test new exports
- `src/server/tools/index.ts` - Export MarketDataToolRegistry
- `src/server/TradeRepublicMcpServer.ts` - Integrate MarketDataService
- `src/server/TradeRepublicMcpServer.spec.ts` - Test integration

---

## Implementation Steps

### Step 1: Create MarketDataService.request.ts

```typescript
import { z } from 'zod';

export const TimeRangeSchema = z.enum(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'max']);
export type TimeRange = z.output<typeof TimeRangeSchema>;

const DEFAULT_EXCHANGE = 'LSX';

export const GetPriceRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetPriceRequest = z.output<typeof GetPriceRequestSchema>;

export const GetPriceHistoryRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range'),
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
  limit: z.number().int().min(1).max(50).default(10).optional().describe('Max results'),
});
export type SearchAssetsRequest = z.output<typeof SearchAssetsRequestSchema>;

export const GetAssetInfoRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
});
export type GetAssetInfoRequest = z.output<typeof GetAssetInfoRequestSchema>;

export const GetMarketStatusRequestSchema = z.object({
  isin: z.string().describe('ISIN to check'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
});
export type GetMarketStatusRequest = z.output<typeof GetMarketStatusRequestSchema>;

export const WaitForMarketRequestSchema = z.object({
  isin: z.string().describe('ISIN to monitor'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional().describe('Exchange (default: LSX)'),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000).optional()
    .describe('Timeout ms (default: 60000)'),
  pollIntervalMs: z.number().int().min(1000).max(30000).default(5000).optional()
    .describe('Poll interval ms (default: 5000)'),
});
export type WaitForMarketRequest = z.output<typeof WaitForMarketRequestSchema>;
```

---

### Step 2: Create MarketDataService.response.ts

Use `.passthrough()` consistent with PortfolioService pattern.

```typescript
import { z } from 'zod';

const numericString = z.union([z.number(), z.string()]).transform((v) =>
  typeof v === 'string' ? parseFloat(v) : v
);

// Internal API response schemas
export const TickerApiResponseSchema = z.object({
  bid: z.object({ price: numericString, size: numericString.optional() }),
  ask: z.object({ price: numericString, size: numericString.optional() }),
  last: z.object({ price: numericString, time: z.string().optional() }).optional(),
  open: z.object({ price: numericString }).optional(),
  pre: z.object({ price: numericString }).optional(),
  qualityId: z.string().optional(),
}).passthrough();

export const AggregateHistoryApiSchema = z.object({
  aggregates: z.array(z.object({
    time: z.number(),
    open: numericString,
    high: numericString,
    low: numericString,
    close: numericString,
    volume: numericString.optional(),
  })),
  resolution: z.number().optional(),
}).passthrough();

export const NeonSearchApiSchema = z.object({
  results: z.array(z.object({
    isin: z.string(),
    name: z.string(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })),
}).passthrough();

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
}).passthrough();

// Output response schemas
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

export const SearchAssetsResponseSchema = z.object({
  results: z.array(z.object({
    isin: z.string(),
    name: z.string(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })),
  totalCount: z.number(),
});
export type SearchAssetsResponse = z.output<typeof SearchAssetsResponseSchema>;

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

Test cases per method (total ~90-110 tests):

**getPrice** (~12 tests):
- Should throw if not authenticated
- Should subscribe to ticker topic with correct ID format (ISIN.EXCHANGE)
- Should resolve with price data on success
- Should calculate spread correctly
- Should calculate spreadPercent correctly
- Should reject on API error (code E)
- Should reject on timeout
- Should handle missing last price
- Should use default exchange (LSX) when not provided
- Should cleanup on success
- Should cleanup on error
- Should cleanup on timeout

**getPriceHistory** (~10 tests):
- Should throw if not authenticated
- Should subscribe to aggregateHistory topic with range
- Should resolve with candle data
- Should validate all TimeRange values
- Should reject on API error
- Should reject on timeout
- Should handle empty candles array
- Should cleanup properly

**getOrderBook** (~10 tests):
- Should throw if not authenticated
- Should subscribe to ticker topic
- Should resolve with bids/asks
- Should calculate spread and midPrice
- Should handle missing sizes
- Should cleanup properly

**searchAssets** (~10 tests):
- Should throw if not authenticated
- Should subscribe to neonSearch topic
- Should resolve with results
- Should respect limit parameter
- Should handle empty results
- Should cleanup properly

**getAssetInfo** (~10 tests):
- Should throw if not authenticated
- Should subscribe to instrument topic
- Should resolve with instrument details
- Should transform company fields correctly
- Should transform exchange fields correctly
- Should handle missing optional fields
- Should cleanup properly

**getMarketStatus** (~12 tests):
- Should throw if not authenticated
- Should derive status from ticker data
- Should return isOpen: true when bid/ask available
- Should return isOpen: false when no bid/ask
- Should return 'pre-market' status when pre price available
- Should return 'closed' status when no prices
- Should handle ticker errors gracefully
- Should cleanup properly

**waitForMarket** (~15 tests):
- Should throw if not authenticated
- Should resolve immediately if market is open
- Should poll until market opens
- Should respect pollIntervalMs
- Should timeout after timeoutMs
- Should return timedOut: true on timeout
- Should return waitedMs accurately
- Should use default timeout (60s)
- Should use default pollInterval (5s)
- Should cleanup subscriptions between polls

---

### Step 4: Create MarketDataService.ts (GREEN)

```typescript
import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
// ... imports

const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;
const DEFAULT_EXCHANGE = 'LSX';

export class MarketDataService {
  public constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  public async getPrice(request: GetPriceRequest): Promise<GetPriceResponse> {
    // Subscribe to ticker, calculate spread
  }

  public async getPriceHistory(request: GetPriceHistoryRequest): Promise<GetPriceHistoryResponse> {
    // Subscribe to aggregateHistory
  }

  public async getOrderBook(request: GetOrderBookRequest): Promise<GetOrderBookResponse> {
    // Subscribe to ticker, format bids/asks
  }

  public async searchAssets(request: SearchAssetsRequest): Promise<SearchAssetsResponse> {
    // Subscribe to neonSearch
  }

  public async getAssetInfo(request: GetAssetInfoRequest): Promise<GetAssetInfoResponse> {
    // Subscribe to instrument
  }

  public async getMarketStatus(request: GetMarketStatusRequest): Promise<GetMarketStatusResponse> {
    // Subscribe to ticker, derive status
  }

  public async waitForMarket(request: WaitForMarketRequest): Promise<WaitForMarketResponse> {
    // Poll getMarketStatus until open or timeout
  }

  private subscribeAndWait<T>(
    topic: string,
    payload: object,
    schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } },
  ): Promise<T> {
    // Same pattern as PortfolioService but with payload parameter
  }

  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

### Step 5: Create MarketDataToolRegistry.spec.ts (RED)

Test cases (~28 tests, 4 per tool):
- Should register {tool} with correct metadata
- {tool} handler should call service method
- {tool} handler should return formatted success result
- {tool} handler should return error result on failure

---

### Step 6: Create MarketDataToolRegistry.ts (GREEN)

Register all 7 tools with `public register()` method.

---

### Step 7: Update services/index.ts

```typescript
// Add exports
export * from './MarketDataService.request';
export * from './MarketDataService.response';
export { MarketDataService } from './MarketDataService';
```

---

### Step 8: Update services/index.spec.ts

Add tests for new exports.

---

### Step 9: Update tools/index.ts

```typescript
export { MarketDataToolRegistry } from './MarketDataToolRegistry';
```

---

### Step 10: Update TradeRepublicMcpServer.ts

```typescript
import { MarketDataService } from './services/MarketDataService';
import { MarketDataToolRegistry } from './tools';

// In registerToolsForServer:
private registerToolsForServer(server: McpServer): void {
  if (this.apiService) {
    const portfolioService = new PortfolioService(this.apiService);
    const portfolioToolRegistry = new PortfolioToolRegistry(server, portfolioService);
    portfolioToolRegistry.register();

    const marketDataService = new MarketDataService(this.apiService);
    const marketDataToolRegistry = new MarketDataToolRegistry(server, marketDataService);
    marketDataToolRegistry.register();
  }
}
```

---

### Step 11: Update TradeRepublicMcpServer.spec.ts

Add tests for market data tools registration.

---

### Step 12: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

---

## Key Technical Details

- **Default Exchange**: LSX (Lang & Schwarz)
- **Ticker ID Format**: `{ISIN}.{EXCHANGE}`
- **Subscription timeout**: 30 seconds
- **wait_for_market defaults**: 60s timeout, 5s poll interval
- **`.passthrough()`**: Used on API response schemas (consistent with PortfolioService)
- **Explicit `public`**: On all public methods
