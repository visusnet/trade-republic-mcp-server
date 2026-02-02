# DISCREPANCY-025: Zod Schema Patterns Implementation Plan

## Prerequisites

- Read design: `docs/plans/2026-02-02-discrepancy-025-zod-schema-patterns-design.md`
- Read rules: `.claude/rules/zod.md`, `.claude/rules/testing.md`

## Phase 1: Rules File (DONE)

✅ Copy and adapt `.claude/rules/zod.md` from coinbase-mcp-server

## Phase 2: TechnicalAnalysisService

### Step 2.1: Convert interfaces to schemas

File: `src/server/services/TechnicalAnalysisService.types.ts`

Convert these interfaces to Zod schemas:
- `Candle` → `CandleSchema`
- `RSIResult` → `RSIResultSchema`
- `MACDResult` → `MACDResultSchema`
- `BollingerBandsResult` → `BollingerBandsResultSchema`
- `MovingAverageResult` → `MovingAverageResultSchema`
- `ADXResult` → `ADXResultSchema`
- `StochasticResult` → `StochasticResultSchema`
- `ATRResult` → `ATRResultSchema`
- `OBVResult` → `OBVResultSchema`
- `VWAPResult` → `VWAPResultSchema`

Each field must have `.describe()`.

### Step 2.2: Update imports

File: `src/server/services/TechnicalAnalysisService.ts`
- Types should still work (same names, derived from schemas)

### Step 2.3: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 3: TechnicalIndicatorsService

Uses types from TechnicalAnalysisService.types.ts - should work after Phase 2.

Verify tests still pass.

## Phase 4: RiskService

### Step 4.1: Convert interfaces to schemas

File: `src/server/services/RiskService.types.ts`

Convert:
- `VolatilityResult` → `VolatilityResultSchema`
- `VaRResult` → `VaRResultSchema`
- `MaxDrawdownResult` → `MaxDrawdownResultSchema`

### Step 4.2: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 5: SentimentService

### Step 5.1: Convert SentimentResult

File: `src/server/services/SentimentService.types.ts`
- Convert `SentimentResult` → `SentimentResultSchema`
- Remove `SentimentAnalyzeFn` interface

### Step 5.2: Remove Dependencies pattern

File: `src/server/services/SentimentService.ts`
- Remove `SentimentServiceDependencies` interface
- Change constructor to not accept deps
- Instantiate `Sentiment` directly: `private readonly sentiment = new Sentiment();`

### Step 5.3: Update tests

File: `src/server/services/SentimentService.spec.ts`
- Add `jest.mock('sentiment')` at top
- Remove manual dep injection
- Mock the Sentiment class methods

### Step 5.4: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 6: NewsService

### Step 6.1: Remove Dependencies pattern

File: `src/server/services/NewsService.types.ts`
- Remove `YahooFinanceSearchWithNewsFn` interface

File: `src/server/services/NewsService.ts`
- Remove `NewsServiceDependencies` interface
- Change constructor to not accept deps
- Import and use `yahooFinance` directly

### Step 6.2: Update tests

File: `src/server/services/NewsService.spec.ts`
- Add `jest.mock('yahoo-finance2')` at top
- Remove manual dep injection
- Mock yahooFinance.search

### Step 6.3: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 7: FundamentalsService

### Step 7.1: Remove Dependencies pattern

File: `src/server/services/FundamentalsService.types.ts`
- Remove `YahooQuoteSummaryResult` interface (if not used for validation)
- Remove `YahooQuoteSummaryFn` interface

File: `src/server/services/FundamentalsService.ts`
- Remove `FundamentalsServiceDependencies` interface
- Change constructor to not accept deps
- Import and use `yahooFinance` directly

### Step 7.2: Update tests

File: `src/server/services/FundamentalsService.spec.ts`
- Add `jest.mock('yahoo-finance2')` at top
- Remove manual dep injection
- Mock yahooFinance.quoteSummary

### Step 7.3: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 8: TradeRepublicApiService

### Step 8.1: Convert interfaces to schemas

File: `src/server/services/TradeRepublicApiService.types.ts`

Convert:
- `KeyPair` → `KeyPairSchema`
- `Credentials` → `CredentialsSchema`
- `SessionTokens` → `SessionTokensSchema`
- `StoredCookie` → `StoredCookieSchema`
- `WebSocketMessage` → `WebSocketMessageSchema`
- `SignedPayload` → `SignedPayloadSchema`

Keep as interfaces (external contracts):
- `WebSocket` (browser/undici interface)
- `WebSocketOptions`
- `WebSocket*Event` interfaces

### Step 8.2: Remove FileSystem interface

File: `src/server/services/TradeRepublicApiService.types.ts`
- Remove `FileSystem` interface

File: `src/server/services/index.ts`
- Remove `createTradeRepublicApiService` factory
- Remove `defaultFileSystem`
- Update exports

File: `src/server/services/TradeRepublicApiService.crypto.ts`
- Use `fs.promises` directly instead of injected FileSystem

### Step 8.3: Update tests

File: `src/server/services/TradeRepublicApiService.spec.ts`
- Use `jest.mock('fs')` or `jest.mock('fs/promises')`
- Remove FileSystem injection

File: `src/server/services/index.spec.ts`
- Remove tests for createTradeRepublicApiService factory
- Remove tests for defaultFileSystem

### Step 8.4: Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## Phase 9: Cleanup

### Step 9.1: Remove passthrough()

Search for any remaining `.passthrough()` calls and remove them.

### Step 9.2: Final verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

### Step 9.3: Mark discrepancy as resolved

Update `docs/discrepancies.md` to mark DISCREPANCY-025 as resolved.

## Notes

- Each phase should be committed separately
- If tests fail, the schema or implementation needs alignment
- All fields in schemas must have `.describe()` per zod.md rules
- Use `z.output<typeof Schema>` consistently for all types
