# Task 08: External Data Services & Tools - Implementation Plan (Agent 2)

## Overview

Implement NewsService, SentimentService and `get_news`, `get_sentiment`, `get_fundamentals` tools using **completely free** data sources that require **NO API keys** and **NO registration**.

## 1. Data Source Selection

### Critical Requirement: COMPLETELY FREE Data Sources

| Service | Data Source | Library | Why |
|---------|-------------|---------|-----|
| News | Yahoo Finance | `yahoo-finance2` | Free, no API key, TypeScript native, includes news in search results |
| Fundamentals | Yahoo Finance | `yahoo-finance2` | Free, quoteSummary with 32 modules for financial data |
| Sentiment | Local AFINN | `sentiment` | Free, local processing, no API calls, AFINN-165 wordlist |

### Why Yahoo Finance (`yahoo-finance2`)?

1. **Truly Free**: No API key, no registration, no rate limit tiers
2. **TypeScript Native**: Full type definitions included
3. **Battle-tested**: 32,603 weekly downloads, maintained since 2013
4. **Comprehensive Data**: News, fundamentals, recommendations, earnings
5. **Node.js Compatible**: Works with Node v20+

### Why `sentiment` for Sentiment Analysis?

1. **Truly Free**: Works entirely offline, no API calls
2. **Fast**: AFINN-165 based, nearly twice as fast as alternatives
3. **Simple**: One-line sentiment scoring
4. **No External Dependencies**: Process news headlines locally

## 2. Architecture

### Service Integration

```
TradeRepublicMcpServer
    ├── PortfolioToolRegistry (existing)
    ├── MarketDataToolRegistry (existing)
    ├── TechnicalAnalysisToolRegistry (existing)
    └── ExternalDataToolRegistry (new)
            ├── NewsService (new - fetches news via yahoo-finance2)
            ├── SentimentService (new - analyzes text via AFINN-165)
            └── FundamentalsService (new - fetches data via yahoo-finance2)
```

### Design Principles

1. **YAGNI/KISS**: Minimal implementation - only what the tools need
2. **Separation of Concerns**: Each service handles one responsibility
3. **Dependency Injection**: Services are injectable for testing
4. **No External API Keys**: All data sources are completely free
5. **Local Sentiment**: Sentiment analysis runs locally, not via external API

## 3. File Structure

### New Files

```
src/server/
├── services/
│   ├── NewsService.ts
│   ├── NewsService.spec.ts
│   ├── NewsService.request.ts
│   ├── NewsService.response.ts
│   ├── NewsService.types.ts
│   │
│   ├── SentimentService.ts
│   ├── SentimentService.spec.ts
│   ├── SentimentService.request.ts
│   ├── SentimentService.response.ts
│   ├── SentimentService.types.ts
│   │
│   ├── FundamentalsService.ts
│   ├── FundamentalsService.spec.ts
│   ├── FundamentalsService.request.ts
│   ├── FundamentalsService.response.ts
│   └── FundamentalsService.types.ts
│
├── tools/
│   ├── ExternalDataToolRegistry.ts
│   └── ExternalDataToolRegistry.spec.ts
│
└── utils/
    ├── SymbolMapper.ts
    └── SymbolMapper.spec.ts
```

### Modified Files

```
src/server/services/index.ts
src/server/tools/index.ts
src/server/TradeRepublicMcpServer.ts
src/server/TradeRepublicMcpServer.spec.ts
package.json
```

## 4. Dependencies

### New Runtime Dependencies

```json
{
  "dependencies": {
    "yahoo-finance2": "^2.14.0",
    "sentiment": "^5.0.2"
  }
}
```

### New Dev Dependencies

```json
{
  "devDependencies": {
    "@types/sentiment": "^5.0.4"
  }
}
```

## 5. Symbol Mapping Utility

Since Trade Republic uses ISINs but Yahoo Finance uses ticker symbols, we need a mapper.

```typescript
// src/server/utils/SymbolMapper.ts

import yahooFinance from 'yahoo-finance2';
import { z } from 'zod';

export class SymbolMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SymbolMapperError';
  }
}

export const IsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/, 'Invalid ISIN format');

export class SymbolMapper {
  private readonly cache: Map<string, string> = new Map();

  public async isinToSymbol(isin: string): Promise<string> {
    IsinSchema.parse(isin);

    const cached = this.cache.get(isin);
    if (cached) {
      return cached;
    }

    const results = await yahooFinance.search(isin, { quotesCount: 5 });

    if (results.quotes && results.quotes.length > 0) {
      const symbol = results.quotes[0].symbol;
      this.cache.set(isin, symbol);
      return symbol;
    }

    throw new SymbolMapperError(`No symbol found for ISIN: ${isin}`);
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
```

## 6. NewsService Implementation

### Request Schema

```typescript
// src/server/services/NewsService.request.ts

import { z } from 'zod';

export const GetNewsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument to get news for'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of news articles to return (default: 10, max: 50)'),
});
export type GetNewsRequest = z.output<typeof GetNewsRequestSchema>;
```

### Response Schema

```typescript
// src/server/services/NewsService.response.ts

import { z } from 'zod';

export const NewsArticleSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  link: z.string().url(),
  publishedAt: z.string(),
  type: z.string().optional(),
  thumbnail: z.string().url().optional(),
});
export type NewsArticle = z.output<typeof NewsArticleSchema>;

export const GetNewsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  articles: z.array(NewsArticleSchema),
  totalCount: z.number(),
  timestamp: z.string(),
});
export type GetNewsResponse = z.output<typeof GetNewsResponseSchema>;
```

## 7. SentimentService Implementation

### Key Design: Local AFINN-165 Analysis

The SentimentService uses the `sentiment` npm package which implements AFINN-165 wordlist for local sentiment analysis. This means:
- No API calls required
- Works offline
- Fast processing
- Completely free

### Request Schema

```typescript
// src/server/services/SentimentService.request.ts

import { z } from 'zod';

export const GetSentimentRequestSchema = z.object({
  isin: z
    .string()
    .optional()
    .describe('ISIN of the instrument to analyze news sentiment for'),
  text: z
    .string()
    .optional()
    .describe('Custom text to analyze sentiment (alternative to ISIN)'),
  newsLimit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .describe('Number of news articles to analyze when using ISIN (default: 5)'),
}).refine(
  (data) => data.isin !== undefined || data.text !== undefined,
  { message: 'Either isin or text must be provided' }
);
export type GetSentimentRequest = z.output<typeof GetSentimentRequestSchema>;
```

### Response Schema

```typescript
// src/server/services/SentimentService.response.ts

import { z } from 'zod';

export const SentimentDirectionSchema = z.enum(['positive', 'negative', 'neutral']);
export type SentimentDirection = z.output<typeof SentimentDirectionSchema>;

export const SentimentConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type SentimentConfidence = z.output<typeof SentimentConfidenceSchema>;

export const TextSentimentSchema = z.object({
  text: z.string(),
  score: z.number(),
  comparative: z.number(),
  direction: SentimentDirectionSchema,
  positiveWords: z.array(z.string()),
  negativeWords: z.array(z.string()),
});
export type TextSentiment = z.output<typeof TextSentimentSchema>;

export const GetSentimentResponseSchema = z.object({
  isin: z.string().optional(),
  symbol: z.string().optional(),
  overallScore: z.number(), // -100 to 100 normalized score
  overallDirection: SentimentDirectionSchema,
  confidence: SentimentConfidenceSchema,
  analysis: z.array(TextSentimentSchema),
  summary: z.string(),
  timestamp: z.string(),
});
export type GetSentimentResponse = z.output<typeof GetSentimentResponseSchema>;
```

### Sentiment Calculation

```typescript
// Sentiment thresholds
const POSITIVE_THRESHOLD = 0.1;
const NEGATIVE_THRESHOLD = -0.1;

// Direction calculation
private scoreToDirection(comparative: number): SentimentDirection {
  if (comparative > POSITIVE_THRESHOLD) return 'positive';
  if (comparative < NEGATIVE_THRESHOLD) return 'negative';
  return 'neutral';
}

// Normalize to -100 to 100
private normalizeScore(comparative: number): number {
  const clamped = Math.max(-5, Math.min(5, comparative));
  return Math.round(clamped * 20);
}
```

## 8. FundamentalsService Implementation

### Request Schema

```typescript
// src/server/services/FundamentalsService.request.ts

import { z } from 'zod';

export const GetFundamentalsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument to get fundamentals for'),
  modules: z
    .array(
      z.enum([
        'profile',
        'financials',
        'earnings',
        'valuation',
        'recommendations',
      ])
    )
    .min(1)
    .default(['profile', 'financials', 'valuation'])
    .optional()
    .describe('Fundamental data modules to fetch'),
});
export type GetFundamentalsRequest = z.output<typeof GetFundamentalsRequestSchema>;
```

### Response Schema

```typescript
// src/server/services/FundamentalsService.response.ts

import { z } from 'zod';

export const CompanyProfileSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  fullTimeEmployees: z.number().nullable(),
});

export const FinancialMetricsSchema = z.object({
  marketCap: z.number().nullable(),
  revenue: z.number().nullable(),
  revenueGrowth: z.number().nullable(),
  grossProfit: z.number().nullable(),
  grossMargin: z.number().nullable(),
  operatingMargin: z.number().nullable(),
  profitMargin: z.number().nullable(),
  ebitda: z.number().nullable(),
  netIncome: z.number().nullable(),
  freeCashFlow: z.number().nullable(),
  totalCash: z.number().nullable(),
  totalDebt: z.number().nullable(),
  debtToEquity: z.number().nullable(),
  currentRatio: z.number().nullable(),
  returnOnEquity: z.number().nullable(),
  returnOnAssets: z.number().nullable(),
});

export const ValuationMetricsSchema = z.object({
  trailingPE: z.number().nullable(),
  forwardPE: z.number().nullable(),
  priceToBook: z.number().nullable(),
  priceToSales: z.number().nullable(),
  enterpriseValue: z.number().nullable(),
  evToRevenue: z.number().nullable(),
  evToEbitda: z.number().nullable(),
  bookValue: z.number().nullable(),
});

export const RecommendationsSchema = z.object({
  targetMeanPrice: z.number().nullable(),
  targetHighPrice: z.number().nullable(),
  targetLowPrice: z.number().nullable(),
  recommendationMean: z.number().nullable(),
  recommendationKey: z.string().nullable(),
  numberOfAnalysts: z.number().nullable(),
});

export const GetFundamentalsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  profile: CompanyProfileSchema.optional(),
  financials: FinancialMetricsSchema.optional(),
  earnings: EarningsDataSchema.optional(),
  valuation: ValuationMetricsSchema.optional(),
  recommendations: RecommendationsSchema.optional(),
  timestamp: z.string(),
});
```

## 9. ExternalDataToolRegistry

```typescript
// src/server/tools/ExternalDataToolRegistry.ts

export class ExternalDataToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly newsService: NewsService,
    private readonly sentimentService: SentimentService,
    private readonly fundamentalsService: FundamentalsService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_news',
      {
        title: 'Get News',
        description: 'Get latest news articles for an instrument. No authentication required.',
        inputSchema: GetNewsRequestSchema.shape,
      },
      this.newsService.getNews.bind(this.newsService),
    );

    this.registerTool(
      'get_sentiment',
      {
        title: 'Get Sentiment',
        description: 'Analyze sentiment of news or custom text. Uses local AFINN-165. No authentication required.',
        inputSchema: GetSentimentRequestSchema.shape,
      },
      this.sentimentService.getSentiment.bind(this.sentimentService),
    );

    this.registerTool(
      'get_fundamentals',
      {
        title: 'Get Fundamentals',
        description: 'Get fundamental financial data. No authentication required.',
        inputSchema: GetFundamentalsRequestSchema.shape,
      },
      this.fundamentalsService.getFundamentals.bind(this.fundamentalsService),
    );
  }
}
```

## 10. Test Strategy

### Test Count Estimate

| Component | Test Count |
|-----------|------------|
| SymbolMapper | ~10 |
| NewsService | ~15 |
| SentimentService | ~25 |
| FundamentalsService | ~20 |
| ExternalDataToolRegistry | ~12 |
| Integration tests | ~5 |
| **Total** | **~87** |

## 11. Implementation Steps (TDD Red-Green-Refactor)

### Phase 1: Setup
1. Install dependencies: `npm install yahoo-finance2 sentiment`
2. Install types: `npm install -D @types/sentiment`

### Phase 2: SymbolMapper (RED-GREEN-REFACTOR)
1. Write tests for SymbolMapper
2. Implement SymbolMapper
3. Refactor

### Phase 3: NewsService (RED-GREEN-REFACTOR)
1. Create schemas with tests
2. Write service tests
3. Implement service
4. Refactor

### Phase 4: SentimentService (RED-GREEN-REFACTOR)
1. Create schemas with tests
2. Write service tests
3. Implement service
4. Refactor

### Phase 5: FundamentalsService (RED-GREEN-REFACTOR)
1. Create schemas with tests
2. Write service tests
3. Implement service
4. Refactor

### Phase 6: ExternalDataToolRegistry (RED-GREEN-REFACTOR)
1. Write registry tests
2. Implement registry
3. Refactor

### Phase 7: Integration
1. Update exports
2. Update TradeRepublicMcpServer
3. Run full test suite

### Phase 8: Verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## 12. Key Design Decisions

### 1. Why Local Sentiment Analysis?

- **Truly Free**: No API calls, no rate limits
- **Fast**: AFINN-165 is simple and efficient
- **Reliable**: Works offline
- **Sufficient**: News headline sentiment doesn't need sophisticated NLP

### 2. Why Three Separate Services?

Agent 1 proposed a single `ExternalDataService`, but Agent 2 proposes three separate services:
- `NewsService` - Single responsibility: fetch news
- `SentimentService` - Single responsibility: analyze sentiment
- `FundamentalsService` - Single responsibility: fetch fundamentals

This follows the Single Responsibility Principle and makes testing easier.

### 3. Why SymbolMapper in utils/?

The SymbolMapper is a utility that could be used by other services, not just external data. Placing it in `utils/` makes it reusable.

## 13. Success Criteria

- [ ] All 3 tools registered and working
- [ ] 100% test coverage
- [ ] No API keys or registration required
- [ ] Local sentiment analysis working
- [ ] Proper error handling
- [ ] TypeScript types for all inputs/outputs
- [ ] Zod validation for all schemas
