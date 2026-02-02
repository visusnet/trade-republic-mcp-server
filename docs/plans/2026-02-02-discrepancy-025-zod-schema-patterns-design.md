# DISCREPANCY-025: Zod Schema Patterns Design

## Problem

The codebase has many TypeScript interfaces manually defined instead of being derived from Zod schemas. This violates the coinbase-mcp-server pattern.

## Decision Summary

| Question | Decision |
|----------|----------|
| Passthrough | Strict - no passthrough allowed |
| Dependencies | Remove completely, use jest.mock |
| Approach | Service by service refactoring |

## Refactoring Order

1. ✅ Copy `zod.md` rules file
2. TechnicalAnalysisService - Candle, RSIResult, MACDResult, etc.
3. TechnicalIndicatorsService - Uses same types
4. RiskService - VolatilityResult, VaRResult, MaxDrawdownResult
5. SentimentService - SentimentResult, remove Dependencies
6. NewsService - Remove Dependencies
7. FundamentalsService - Remove Dependencies
8. TradeRepublicApiService - KeyPair, Credentials, SessionTokens, etc.

## Pattern: Interface to Schema

```typescript
// Before
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// After
export const CandleSchema = z.object({
  time: z.number().describe('Candle timestamp'),
  open: z.number().describe('Opening price'),
  high: z.number().describe('Highest price'),
  low: z.number().describe('Lowest price'),
  close: z.number().describe('Closing price'),
  volume: z.number().optional().describe('Trading volume'),
});
export type Candle = z.output<typeof CandleSchema>;
```

## Pattern: Remove Dependencies

```typescript
// Before
export interface SentimentServiceDependencies {
  analyze: SentimentAnalyzeFn;
}
export class SentimentService {
  constructor(
    private readonly newsService: NewsService,
    private readonly deps: SentimentServiceDependencies,
  ) {}
}

// After
import Sentiment from 'sentiment';
export class SentimentService {
  private readonly sentiment = new Sentiment();
  constructor(private readonly newsService: NewsService) {}
}

// Tests use jest.mock('sentiment')
```

## Files to Modify per Service

### TechnicalAnalysisService
- `TechnicalAnalysisService.types.ts` - Convert all interfaces to schemas
- `TechnicalAnalysisService.ts` - Update imports
- `TechnicalAnalysisService.spec.ts` - Update if needed

### TechnicalIndicatorsService
- Uses types from TechnicalAnalysisService.types.ts - should work after #2

### RiskService
- `RiskService.types.ts` - Convert VolatilityResult, VaRResult, MaxDrawdownResult
- `RiskService.ts` - Update imports
- `RiskService.spec.ts` - Update if needed

### SentimentService
- `SentimentService.types.ts` - Convert SentimentResult, remove SentimentAnalyzeFn
- `SentimentService.ts` - Remove deps, instantiate Sentiment directly
- `SentimentService.spec.ts` - Use jest.mock('sentiment')

### NewsService
- `NewsService.types.ts` - Remove YahooFinanceSearchWithNewsFn
- `NewsService.ts` - Remove deps, use yahoo-finance2 directly
- `NewsService.spec.ts` - Use jest.mock('yahoo-finance2')

### FundamentalsService
- `FundamentalsService.types.ts` - Remove YahooQuoteSummaryFn
- `FundamentalsService.ts` - Remove deps, use yahoo-finance2 directly
- `FundamentalsService.spec.ts` - Use jest.mock('yahoo-finance2')

### TradeRepublicApiService
- `TradeRepublicApiService.types.ts` - Convert KeyPair, Credentials, etc.
- Remove `createTradeRepublicApiService` factory
- Remove `FileSystem` interface, use jest.mock('fs')
- Update tests accordingly

## Verification

After each service:
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```
