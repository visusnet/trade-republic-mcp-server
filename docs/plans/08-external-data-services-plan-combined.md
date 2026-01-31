# Task 08: External Data Services & Tools - Combined Implementation Plan

## Overview

This combined plan merges the approaches from Plan 1 and Plan 2 for implementing NewsService, SentimentService, FundamentalsService and MCP tools using **completely FREE** data sources (no API keys, no registration).

## Key Decisions

### Data Sources (Both Plans Agree)

| Service | Data Source | Library | Rationale |
|---------|-------------|---------|-----------|
| News | Yahoo Finance | `yahoo-finance2` | Free, no API key, TypeScript native |
| Fundamentals | Yahoo Finance | `yahoo-finance2` | Free, quoteSummary with comprehensive data |
| Sentiment | Local AFINN-165 | `sentiment` | Free, local processing, no API calls |

### Architecture Decision: Three Separate Services (Plan 2)

Plan 1 proposed a single `ExternalDataService`. Plan 2 proposed three separate services.

**Decision:** Use Plan 2's three separate services for better separation of concerns:
- `NewsService` - Fetches news via yahoo-finance2
- `SentimentService` - Analyzes text via local AFINN-165
- `FundamentalsService` - Fetches fundamentals via yahoo-finance2

### Sentiment Analysis: Local AFINN-165 (Plan 2)

Plan 1 calculated sentiment from Yahoo Finance analyst recommendations.
Plan 2 uses the `sentiment` npm package with AFINN-165 wordlist.

**Decision:** Use Plan 2's approach with `sentiment` package because:
- More flexible (can analyze any text, not just instruments with analyst coverage)
- Works offline with no API calls
- Provides word-level analysis (positive/negative words identified)

### File Structure: Flat in services/ (Plan 1)

Plan 2 proposed putting SymbolMapper in `utils/`.

**Decision:** Keep everything in `services/` for consistency with existing codebase:

```
src/server/services/
├── SymbolMapper.ts
├── SymbolMapper.spec.ts
├── NewsService.ts
├── NewsService.spec.ts
├── NewsService.request.ts
├── NewsService.response.ts
├── NewsService.types.ts
├── SentimentService.ts
├── SentimentService.spec.ts
├── SentimentService.request.ts
├── SentimentService.response.ts
├── SentimentService.types.ts
├── FundamentalsService.ts
├── FundamentalsService.spec.ts
├── FundamentalsService.request.ts
├── FundamentalsService.response.ts
└── FundamentalsService.types.ts

src/server/tools/
├── ExternalDataToolRegistry.ts
└── ExternalDataToolRegistry.spec.ts
```

## Dependencies

```json
{
  "dependencies": {
    "yahoo-finance2": "^2.14.0",
    "sentiment": "^5.0.2"
  },
  "devDependencies": {
    "@types/sentiment": "^5.0.4"
  }
}
```

## Implementation Details

### 1. SymbolMapper

Converts ISINs to Yahoo Finance symbols with caching.

```typescript
export class SymbolMapper {
  private readonly cache: Map<string, string> = new Map();

  public async isinToSymbol(isin: string): Promise<string>;
  public clearCache(): void;
}
```

### 2. NewsService

Fetches news from Yahoo Finance search results.

**Request:**
```typescript
export const GetNewsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  limit: z.number().int().min(1).max(50).default(10).optional(),
});
```

**Response:**
```typescript
export const GetNewsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  articles: z.array(z.object({
    title: z.string(),
    publisher: z.string(),
    link: z.string().url(),
    publishedAt: z.string(),
    thumbnail: z.string().url().optional(),
  })),
  totalCount: z.number(),
  timestamp: z.string(),
});
```

### 3. SentimentService

Analyzes sentiment using local AFINN-165 wordlist.

**Request:**
```typescript
export const GetSentimentRequestSchema = z.object({
  isin: z.string().optional().describe('ISIN to analyze news sentiment for'),
  text: z.string().optional().describe('Custom text to analyze'),
  newsLimit: z.number().int().min(1).max(20).default(5).optional(),
}).refine(data => data.isin || data.text, {
  message: 'Either isin or text must be provided',
});
```

**Response:**
```typescript
export const GetSentimentResponseSchema = z.object({
  isin: z.string().optional(),
  symbol: z.string().optional(),
  overallScore: z.number().min(-100).max(100),
  overallDirection: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.enum(['high', 'medium', 'low']),
  analysis: z.array(z.object({
    text: z.string(),
    score: z.number(),
    comparative: z.number(),
    direction: z.enum(['positive', 'negative', 'neutral']),
    positiveWords: z.array(z.string()),
    negativeWords: z.array(z.string()),
  })),
  summary: z.string(),
  timestamp: z.string(),
});
```

**Sentiment Calculation:**
- Score > 0.1 → positive
- Score < -0.1 → negative
- Otherwise → neutral
- Normalized to -100 to 100 range

### 4. FundamentalsService

Fetches fundamental data from Yahoo Finance quoteSummary.

**Request:**
```typescript
export const GetFundamentalsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  modules: z.array(z.enum([
    'profile', 'financials', 'earnings', 'valuation', 'recommendations'
  ])).min(1).default(['profile', 'financials', 'valuation']).optional(),
});
```

**Response includes:**
- Profile: name, sector, industry, country, website, employees
- Financials: revenue, margins, cash flow, debt ratios
- Earnings: EPS, earnings dates, estimates
- Valuation: P/E, P/B, EV ratios
- Recommendations: analyst targets and ratings

### 5. ExternalDataToolRegistry

Registers three tools:
- `get_news` - Get latest news articles
- `get_sentiment` - Analyze sentiment of news or text
- `get_fundamentals` - Get fundamental financial data

All tools: **No authentication required**

## TDD Implementation Order

### Phase 1: Setup
```bash
npm install yahoo-finance2 sentiment
npm install -D @types/sentiment
```

### Phase 2: SymbolMapper
1. Write tests (~10 tests)
2. Implement
3. Refactor

### Phase 3: NewsService
1. Create request/response schemas
2. Write tests (~15 tests)
3. Implement
4. Refactor

### Phase 4: SentimentService
1. Create request/response schemas
2. Write tests (~25 tests)
3. Implement
4. Refactor

### Phase 5: FundamentalsService
1. Create request/response schemas
2. Write tests (~20 tests)
3. Implement
4. Refactor

### Phase 6: ExternalDataToolRegistry
1. Write tests (~12 tests)
2. Implement
3. Refactor

### Phase 7: Integration
1. Update service exports
2. Update tool exports
3. Update TradeRepublicMcpServer
4. Integration tests (~5 tests)

### Phase 8: Verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Test Count Estimate

| Component | Tests |
|-----------|-------|
| SymbolMapper | ~10 |
| NewsService | ~15 |
| SentimentService | ~25 |
| FundamentalsService | ~20 |
| ExternalDataToolRegistry | ~12 |
| Integration | ~5 |
| **Total** | **~87** |

## Success Criteria

1. All 3 tools registered and working
2. 100% test coverage
3. **No API keys or registration required**
4. Local sentiment analysis working
5. Proper error handling
6. TypeScript types for all inputs/outputs
7. Zod validation for all schemas
8. All public methods have explicit `public` visibility modifier
