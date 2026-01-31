# Task 08: External Data Services & Tools - Final Implementation Plan

## Overview

Implement NewsService, SentimentService, FundamentalsService and MCP tools (`get_news`, `get_sentiment`, `get_fundamentals`) using **completely FREE** data sources.

## Data Source Verification (ADR)

### yahoo-finance2 (v2.14.0)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Free | ✅ VERIFIED | MIT License, no paid tiers |
| No API Key | ✅ VERIFIED | Uses unofficial Yahoo Finance endpoints |
| No Registration | ✅ VERIFIED | Works immediately after install |
| Rate Limits | ⚠️ IMPLICIT | Yahoo may throttle excessive requests |

**Known Limitations:**
- Yahoo Finance may rate limit aggressive requests
- Some international instruments have limited data
- Data accuracy depends on Yahoo's sources

### sentiment (v5.0.2)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Free | ✅ VERIFIED | MIT License |
| No API Key | ✅ VERIFIED | Works entirely offline |
| No Registration | ✅ VERIFIED | Local processing only |
| Rate Limits | ✅ N/A | No network calls |

**Capabilities:**
- AFINN-165 wordlist (2,477 words with sentiment scores)
- Local processing, works offline
- Returns positive/negative word identification

## Architecture

```
TradeRepublicMcpServer
    └── ExternalDataToolRegistry
            ├── NewsService (yahoo-finance2 search)
            ├── SentimentService (local AFINN-165)
            └── FundamentalsService (yahoo-finance2 quoteSummary)
                    └── SymbolMapper (ISIN → Yahoo symbol)
```

### Design Decision: SymbolMapper in services/

**Rationale:** While SymbolMapper is a utility, placing it in `services/` maintains consistency with the existing flat structure. The codebase doesn't have a `utils/` directory, and creating one for a single file adds unnecessary complexity (YAGNI).

## File Structure

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

Maps ISINs to Yahoo Finance symbols with caching.

```typescript
export class SymbolMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SymbolMapperError';
  }
}

// ISIN format: 2 letter country code + 9 alphanumeric + 1 check digit
export const IsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/);

export class SymbolMapper {
  private readonly cache: Map<string, string> = new Map();

  public async isinToSymbol(isin: string): Promise<string>;
  public clearCache(): void;
}
```

### 2. NewsService

**Request Schema:**
```typescript
export const GetNewsRequestSchema = z.object({
  isin: z
    .string()
    .describe('ISIN of the instrument'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of news articles (default: 10, max: 50)'),
});
```

**Response Schema:**
```typescript
export const NewsArticleSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  link: z.string().url(),
  publishedAt: z.string(),
  thumbnail: z.string().url().optional(),
});

export const GetNewsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  articles: z.array(NewsArticleSchema),
  totalCount: z.number(),
  timestamp: z.string(),
});
```

### 3. SentimentService

**Request Schema:**
```typescript
export const GetSentimentRequestSchema = z.object({
  isin: z
    .string()
    .optional()
    .describe('ISIN to analyze news sentiment for'),
  text: z
    .string()
    .optional()
    .describe('Custom text to analyze'),
  newsLimit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .describe('Number of news articles to analyze (default: 5)'),
}).refine(data => data.isin !== undefined || data.text !== undefined, {
  message: 'Either isin or text must be provided',
});
```

**Response Schema:**
```typescript
export const SentimentDirectionSchema = z.enum(['positive', 'negative', 'neutral']);
export const SentimentConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const TextSentimentSchema = z.object({
  text: z.string(),
  score: z.number(),
  comparative: z.number(),
  direction: SentimentDirectionSchema,
  positiveWords: z.array(z.string()),
  negativeWords: z.array(z.string()),
});

export const GetSentimentResponseSchema = z.object({
  isin: z.string().optional(),
  symbol: z.string().optional(),
  overallScore: z.number().min(-100).max(100),
  overallDirection: SentimentDirectionSchema,
  confidence: SentimentConfidenceSchema,
  analysis: z.array(TextSentimentSchema),
  summary: z.string(),
  timestamp: z.string(),
});
```

**Sentiment Calculation:**
```typescript
// Thresholds based on AFINN comparative scores
const POSITIVE_THRESHOLD = 0.1;  // Score > 0.1 → positive
const NEGATIVE_THRESHOLD = -0.1; // Score < -0.1 → negative
// Score between -0.1 and 0.1 → neutral

// Normalization: AFINN comparative scores typically range -5 to +5
// Map to -100 to +100: clamp(score, -5, 5) * 20

// Confidence calculation:
// - high: agreement >= 75% AND intensity > 3
// - medium: agreement >= 50% AND intensity > 1
// - low: otherwise
```

**Finance-Specific Word List:**

The sentiment library supports custom word scores. We enhance it with finance-specific vocabulary:

```typescript
// src/server/services/SentimentService.wordlist.ts
export const FINANCE_SENTIMENT_WORDS: Record<string, number> = {
  // Positive financial terms (+1 to +5)
  'bullish': 3,
  'outperform': 3,
  'upgrade': 3,
  'upgraded': 3,
  'beat': 2,
  'beats': 2,
  'exceeds': 2,
  'exceeded': 2,
  'growth': 2,
  'profit': 2,
  'profitable': 2,
  'dividend': 2,
  'buyback': 2,
  'acquisition': 1,
  'expansion': 2,
  'record': 2,
  'surge': 3,
  'surges': 3,
  'rally': 3,
  'rallies': 3,
  'breakout': 2,
  'soar': 3,
  'soars': 3,
  'gains': 2,
  'upside': 2,
  'momentum': 1,
  'optimistic': 2,
  'rebound': 2,
  'recovery': 2,

  // Negative financial terms (-1 to -5)
  'bearish': -3,
  'underperform': -3,
  'downgrade': -3,
  'downgraded': -3,
  'miss': -2,
  'misses': -2,
  'missed': -2,
  'loss': -2,
  'losses': -2,
  'debt': -1,
  'lawsuit': -2,
  'fraud': -4,
  'bankruptcy': -5,
  'bankrupt': -5,
  'default': -4,
  'defaults': -4,
  'recession': -3,
  'layoffs': -2,
  'layoff': -2,
  'decline': -2,
  'declines': -2,
  'plunge': -3,
  'plunges': -3,
  'crash': -4,
  'crashes': -4,
  'selloff': -2,
  'sell-off': -2,
  'downturn': -2,
  'slump': -2,
  'slumps': -2,
  'warning': -2,
  'warns': -2,
  'disappointing': -2,
  'disappoints': -2,
  'weak': -2,
  'weakness': -2,
  'concern': -1,
  'concerns': -1,
  'risk': -1,
  'risks': -1,
  'volatile': -1,
  'volatility': -1,

  // Trading-specific terms
  'short': -1,      // shorting stock (bearish)
  'shorts': -1,
  'put': -1,        // put options (bearish bet)
  'puts': -1,
  'call': 1,        // call options (bullish bet)
  'calls': 1,
  'hold': 0,        // analyst rating (neutral)
  'buy': 2,         // analyst rating
  'sell': -2,       // analyst rating
};
```

Usage in SentimentService:
```typescript
import Sentiment from 'sentiment';
import { FINANCE_SENTIMENT_WORDS } from './SentimentService.wordlist';

const sentiment = new Sentiment();
const result = sentiment.analyze(text, { extras: FINANCE_SENTIMENT_WORDS });
```

### 4. FundamentalsService

**Request Schema:**
```typescript
export const FundamentalsModuleSchema = z.enum([
  'profile',
  'financials',
  'earnings',
  'valuation',
  'recommendations',
]);

export const GetFundamentalsRequestSchema = z.object({
  isin: z
    .string()
    .describe('ISIN of the instrument'),
  modules: z
    .array(FundamentalsModuleSchema)
    .min(1)
    .default(['profile', 'financials', 'valuation'])
    .optional()
    .describe('Data modules to fetch'),
});
```

**Response includes:**
- **profile**: name, sector, industry, country, website, employees
- **financials**: revenue, margins, cash flow, debt ratios
- **earnings**: EPS, earnings dates, estimates
- **valuation**: P/E, P/B, EV ratios
- **recommendations**: analyst targets and ratings

### 5. ExternalDataToolRegistry

```typescript
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
    // get_news, get_sentiment, get_fundamentals
    // All tools: "No authentication required."
  }
}
```

### 6. Integration in TradeRepublicMcpServer

```typescript
// In registerToolsForServer():
const symbolMapper = new SymbolMapper();
const newsService = new NewsService(symbolMapper);
const sentimentService = new SentimentService(newsService);
const fundamentalsService = new FundamentalsService(symbolMapper);

const externalDataToolRegistry = new ExternalDataToolRegistry(
  server,
  newsService,
  sentimentService,
  fundamentalsService,
);
externalDataToolRegistry.register();
```

## Error Handling

```typescript
// Base error for all external data operations
export class ExternalDataError extends Error { ... }

// Specific errors
export class SymbolMapperError extends Error { ... }
export class NewsServiceError extends Error { ... }
export class SentimentServiceError extends Error { ... }
export class FundamentalsServiceError extends Error { ... }
```

**Error Scenarios:**
- Invalid ISIN format → SymbolMapperError
- No Yahoo symbol found → SymbolMapperError
- Yahoo Finance timeout → Service-specific error
- Empty news results → Return empty array (not error)
- Sentiment with no words → Return score 0, direction neutral

## TDD Implementation Order

### Phase 1: Setup
```bash
npm install yahoo-finance2 sentiment
npm install -D @types/sentiment
```

### Phase 2: SymbolMapper (~10 tests)
- Valid ISIN → symbol mapping
- Invalid ISIN format → error
- Cache hit behavior
- Cache miss behavior
- Yahoo search returns no results → error
- clearCache() functionality

### Phase 3: NewsService (~15 tests)
- Fetch news for valid ISIN
- Default limit (10)
- Custom limit
- Empty results
- Symbol mapping failure
- Yahoo Finance error handling

### Phase 4: SentimentService (~30 tests)
- Analyze provided text
- Analyze news for ISIN
- Neither isin nor text → error
- Positive sentiment calculation
- Negative sentiment calculation
- Neutral sentiment calculation
- Exactly at threshold (0.1, -0.1)
- Empty text → error
- Text with no sentiment words → neutral
- Mixed sentiment (balanced)
- Confidence calculation (high/medium/low)
- Summary generation

### Phase 5: FundamentalsService (~25 tests)
- Fetch fundamentals for valid ISIN
- Default modules (profile, financials, valuation)
- Custom modules
- Single module
- All modules
- Null values in response
- Symbol mapping failure
- Yahoo Finance error handling

### Phase 6: ExternalDataToolRegistry (~15 tests)
- Registers get_news tool
- Registers get_sentiment tool
- Registers get_fundamentals tool
- Tool handler calls correct service method
- Error response formatting

### Phase 7: Integration (~5 tests)
- All services instantiate correctly
- Tool registry integrates with MCP server
- End-to-end flow works

### Phase 8: Verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Test Count Estimate

| Component | Tests |
|-----------|-------|
| SymbolMapper | ~10 |
| NewsService | ~15 |
| SentimentService | ~30 |
| FundamentalsService | ~25 |
| ExternalDataToolRegistry | ~15 |
| Integration | ~5 |
| **Total** | **~100** |

## Success Criteria

1. ✅ All 3 tools registered and working
2. ✅ 100% test coverage
3. ✅ **No API keys or registration required**
4. ✅ Local sentiment analysis working
5. ✅ Proper error handling with descriptive messages
6. ✅ TypeScript types for all inputs/outputs
7. ✅ Zod validation for all schemas
8. ✅ All public methods have explicit `public` visibility modifier
9. ✅ Logger integration with appropriate scopes
10. ✅ Follows existing service/tool patterns

## Verification Agent Findings (Addressed)

| Issue | Resolution |
|-------|------------|
| Data source verification | Added ADR section documenting free status |
| SymbolMapper location | Documented rationale for services/ |
| Zod schema patterns | Standardized .default().optional().describe() order |
| Test estimate too low | Increased from ~87 to ~100 tests |
| Edge case documentation | Added sentiment threshold documentation |
| Integration documentation | Added instantiation example |
