# Task 08: External Data Services & Tools - Implementation Plan (Agent 1)

## 1. Overview

This plan covers the implementation of three external data tools (`get_news`, `get_sentiment`, `get_fundamentals`) and their supporting services using the **yahoo-finance2** npm package as the sole data source.

## 2. Data Source Selection

### 2.1 Why yahoo-finance2

The [yahoo-finance2](https://github.com/gadicc/yahoo-finance2) npm package is selected because:

| Requirement | yahoo-finance2 |
|------------|----------------|
| Completely free | YES - No cost |
| No API key required | YES |
| No registration required | YES |
| News data | YES - via `insights` module (significant developments) |
| Sentiment data | YES - via `quoteSummary.recommendationTrend` and `financialData` |
| Fundamentals data | YES - via `quoteSummary` (earnings, financialData, etc.) |
| TypeScript support | YES - Full TypeScript types |
| Active maintenance | YES - Maintained since 2013 |

### 2.2 Data Available

From the yahoo-finance2 package:

1. **News/Insights** (`insights` module):
   - Significant developments (sigDevs): earnings reports, corporate events
   - Technical outlook from Trading Central
   - Research reports references

2. **Sentiment** (`quoteSummary.recommendationTrend` + `quoteSummary.financialData`):
   - Analyst recommendations: strongBuy, buy, hold, sell, strongSell counts
   - Recommendation trends over time (0m, -1m, -2m, -3m)
   - Target prices (high, low, mean, median)
   - Number of analyst opinions

3. **Fundamentals** (`quoteSummary` modules):
   - `financialData`: Revenue, profit margins, cash flow, debt ratios
   - `earnings`: EPS, quarterly earnings history
   - `earningsTrend`: Future earnings estimates
   - `defaultKeyStatistics`: P/E ratio, PEG ratio, beta, market cap

### 2.3 ISIN to Symbol Mapping

Trade Republic uses ISINs (e.g., `DE0007164600`) but Yahoo Finance uses stock symbols (e.g., `SAP`).

**Solution**: Use the existing `MarketDataService.getAssetInfo()` which returns a `symbol` field.

## 3. Architecture Design

### 3.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ExternalDataToolRegistry                  │
│  (registers get_news, get_sentiment, get_fundamentals)      │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
┌─────────────────────┐   ┌───────────────────────┐
│   ExternalDataService│   │   MarketDataService   │
│  (News + Sentiment)  │   │  (ISIN to Symbol)     │
└─────────┬───────────┘   └───────────────────────┘
          │
          ▼
┌─────────────────────┐
│  YahooFinanceClient │
│  (wrapper around    │
│   yahoo-finance2)   │
└─────────────────────┘
```

**Design Decisions:**

1. **Single ExternalDataService**: Combines news, sentiment, and fundamentals since they use the same underlying data source (yahoo-finance2). This follows KISS and YAGNI principles.

2. **YahooFinanceClient wrapper**: Abstracts the yahoo-finance2 library to:
   - Enable dependency injection for testing
   - Handle errors consistently
   - Provide clean TypeScript interfaces

3. **MarketDataService integration**: Reuse existing service for ISIN-to-symbol mapping.

### 3.2 File Structure

```
src/server/services/
├── ExternalDataService.ts           # Main service implementation
├── ExternalDataService.request.ts   # Request Zod schemas
├── ExternalDataService.response.ts  # Response Zod schemas
├── ExternalDataService.types.ts     # Internal types and errors
├── ExternalDataService.spec.ts      # Unit tests
├── YahooFinanceClient.ts            # Yahoo Finance wrapper
├── YahooFinanceClient.types.ts      # Yahoo Finance types
└── YahooFinanceClient.spec.ts       # Yahoo client tests

src/server/tools/
├── ExternalDataToolRegistry.ts      # Tool registration
├── ExternalDataToolRegistry.spec.ts # Tool registry tests
└── index.ts                         # Export updated
```

## 4. Detailed Implementation

### 4.1 YahooFinanceClient

**File**: `src/server/services/YahooFinanceClient.ts`

```typescript
import type YahooFinance from 'yahoo-finance2';

export class YahooFinanceClient {
  constructor(private readonly yahooFinance: typeof YahooFinance) {}

  public async getInsights(symbol: string): Promise<InsightsResult> {
    return this.yahooFinance.insights(symbol, {
      lang: 'en-US',
      region: 'US',
    });
  }

  public async getQuoteSummary(
    symbol: string,
    modules: QuoteSummaryModule[],
  ): Promise<QuoteSummaryResult> {
    return this.yahooFinance.quoteSummary(symbol, { modules });
  }
}
```

### 4.2 ExternalDataService Request Schemas

**File**: `src/server/services/ExternalDataService.request.ts`

```typescript
import { z } from 'zod';

export const GetNewsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .describe('Maximum number of news items to return (default: 5, max: 20)'),
});
export type GetNewsRequest = z.output<typeof GetNewsRequestSchema>;

export const GetSentimentRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
});
export type GetSentimentRequest = z.output<typeof GetSentimentRequestSchema>;

export const GetFundamentalsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
});
export type GetFundamentalsRequest = z.output<typeof GetFundamentalsRequestSchema>;
```

### 4.3 ExternalDataService Response Schemas

**File**: `src/server/services/ExternalDataService.response.ts`

```typescript
import { z } from 'zod';

export const NewsItemSchema = z.object({
  headline: z.string(),
  date: z.string(),
  source: z.string().optional(),
  url: z.string().optional(),
});
export type NewsItem = z.output<typeof NewsItemSchema>;

export const GetNewsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  items: z.array(NewsItemSchema),
  timestamp: z.string(),
});
export type GetNewsResponse = z.output<typeof GetNewsResponseSchema>;

export const SentimentDirectionSchema = z.enum([
  'bullish',
  'bearish',
  'neutral',
]);
export type SentimentDirection = z.output<typeof SentimentDirectionSchema>;

export const RecommendationBreakdownSchema = z.object({
  strongBuy: z.number(),
  buy: z.number(),
  hold: z.number(),
  sell: z.number(),
  strongSell: z.number(),
  total: z.number(),
});
export type RecommendationBreakdown = z.output<typeof RecommendationBreakdownSchema>;

export const GetSentimentResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  overall: SentimentDirectionSchema,
  score: z.number().min(-100).max(100),
  confidence: z.number().min(0).max(100),
  recommendations: RecommendationBreakdownSchema,
  targetPrice: z
    .object({
      high: z.number().nullable(),
      low: z.number().nullable(),
      mean: z.number().nullable(),
      median: z.number().nullable(),
    })
    .optional(),
  analystCount: z.number().optional(),
  timestamp: z.string(),
});
export type GetSentimentResponse = z.output<typeof GetSentimentResponseSchema>;

export const GetFundamentalsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  valuation: z
    .object({
      marketCap: z.number().nullable(),
      enterpriseValue: z.number().nullable(),
      trailingPE: z.number().nullable(),
      forwardPE: z.number().nullable(),
      pegRatio: z.number().nullable(),
      priceToBook: z.number().nullable(),
    })
    .optional(),
  profitability: z
    .object({
      grossMargins: z.number().nullable(),
      operatingMargins: z.number().nullable(),
      profitMargins: z.number().nullable(),
      revenueGrowth: z.number().nullable(),
    })
    .optional(),
  financials: z
    .object({
      totalRevenue: z.number().nullable(),
      grossProfits: z.number().nullable(),
      freeCashflow: z.number().nullable(),
      operatingCashflow: z.number().nullable(),
      totalDebt: z.number().nullable(),
      totalCash: z.number().nullable(),
      debtToEquity: z.number().nullable(),
    })
    .optional(),
  shares: z
    .object({
      sharesOutstanding: z.number().nullable(),
      floatShares: z.number().nullable(),
      shortRatio: z.number().nullable(),
    })
    .optional(),
  risk: z
    .object({
      beta: z.number().nullable(),
    })
    .optional(),
  earnings: z
    .object({
      currentQuarterEstimate: z.number().nullable(),
      nextEarningsDate: z.string().nullable(),
    })
    .optional(),
  timestamp: z.string(),
});
export type GetFundamentalsResponse = z.output<typeof GetFundamentalsResponseSchema>;
```

### 4.4 ExternalDataService Types

**File**: `src/server/services/ExternalDataService.types.ts`

```typescript
export class ExternalDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalDataError';
  }
}

export class SymbolNotFoundError extends ExternalDataError {
  constructor(isin: string) {
    super(`Could not find symbol for ISIN: ${isin}`);
    this.name = 'SymbolNotFoundError';
  }
}

export class DataSourceUnavailableError extends ExternalDataError {
  constructor(source: string, details?: string) {
    super(`Data source unavailable: ${source}${details ? ` - ${details}` : ''}`);
    this.name = 'DataSourceUnavailableError';
  }
}
```

### 4.5 ExternalDataService Implementation

**File**: `src/server/services/ExternalDataService.ts`

The service implements three main methods:
- `getNews()` - Fetches news/significant developments from Yahoo Finance insights
- `getSentiment()` - Calculates sentiment from analyst recommendations
- `getFundamentals()` - Retrieves fundamental financial metrics

Key implementation details:
- Uses `MarketDataService.getAssetInfo()` to resolve ISIN to Yahoo symbol
- Weighted sentiment calculation: strongBuy=2, buy=1, hold=0, sell=-1, strongSell=-2
- Normalizes sentiment score to -100 to 100 range
- Sentiment thresholds: >20 = bullish, <-20 = bearish, else neutral
- Handles missing data gracefully with nullable fields

### 4.6 ExternalDataToolRegistry

**File**: `src/server/tools/ExternalDataToolRegistry.ts`

Registers three tools:
- `get_news` - Get recent news and significant developments
- `get_sentiment` - Get market sentiment analysis based on analyst recommendations
- `get_fundamentals` - Get fundamental financial data

## 5. Test Strategy

### 5.1 Test Files

- `YahooFinanceClient.spec.ts` - Yahoo client wrapper tests
- `ExternalDataService.spec.ts` - Main service tests
- `ExternalDataToolRegistry.spec.ts` - Tool registry tests

### 5.2 Test Coverage

| Component | Test Cases |
|-----------|------------|
| YahooFinanceClient | ~6 tests |
| ExternalDataService.getNews | ~8 tests |
| ExternalDataService.getSentiment | ~10 tests |
| ExternalDataService.getFundamentals | ~10 tests |
| ExternalDataService error handling | ~4 tests |
| ExternalDataToolRegistry | ~12 tests |
| **Total** | **~50 tests** |

## 6. TDD Implementation Order

### Phase 1: YahooFinanceClient
1. Write tests for `getInsights()` - RED
2. Implement `getInsights()` - GREEN
3. Write tests for `getQuoteSummary()` - RED
4. Implement `getQuoteSummary()` - GREEN

### Phase 2: ExternalDataService - getNews
1. Write tests for success case - RED
2. Implement `getNews()` - GREEN
3. Write tests for error cases - RED
4. Implement error handling - GREEN

### Phase 3: ExternalDataService - getSentiment
1. Write tests for bullish/bearish/neutral cases - RED
2. Implement sentiment calculation - GREEN
3. Write tests for edge cases - RED
4. Implement edge case handling - GREEN

### Phase 4: ExternalDataService - getFundamentals
1. Write tests for success case - RED
2. Implement `getFundamentals()` - GREEN
3. Write tests for missing data - RED
4. Implement null handling - GREEN

### Phase 5: ExternalDataToolRegistry
1. Write tests for tool registration - RED
2. Implement registry - GREEN
3. Write tests for tool handlers - RED
4. Verify integration - GREEN

### Phase 6: Integration
1. Update `TradeRepublicMcpServer`
2. Update exports in index files
3. Run full test suite
4. Verify 100% coverage

## 7. Package.json Updates

```json
{
  "dependencies": {
    "yahoo-finance2": "^3.11.2"
  }
}
```

## 8. Success Criteria

- [ ] All 3 tools registered and working (`get_news`, `get_sentiment`, `get_fundamentals`)
- [ ] 100% test coverage
- [ ] No API keys or registration required
- [ ] Proper error handling with descriptive messages
- [ ] TypeScript types for all inputs/outputs
- [ ] Zod validation for all request/response schemas
- [ ] Integration with existing MarketDataService for symbol resolution
