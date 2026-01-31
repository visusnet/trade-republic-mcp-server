# Task 07: Technical Analysis Service & Tools - Final Implementation Plan

## Verification Status: APPROVED WITH CORRECTIONS

**Verified by:** Sub-agent verification pass 1 and 2
**Date:** 2026-01-31
**Result:** Plan is largely correct with issues identified and corrected below.

---

## Issues Found and Corrections

### Issue 1: TimeRangeSchema is not exported (CRITICAL)

**Problem:** The combined plan references importing `TimeRangeSchema` from `MarketDataService.request.ts`, but this schema is not exported (marked as `@internal`).

**Evidence:** In `/Users/rosea/Development/trade-republic-bot/src/server/services/MarketDataService.request.ts`, line 17:
```typescript
/**
 * Time range options for price history requests.
 * @internal
 */
const TimeRangeSchema = z.enum([...]);
```

**Correction:** Either:
1. Export `TimeRangeSchema` from `MarketDataService.request.ts`, OR
2. Define a duplicate `TimeRangeSchema` in `TechnicalAnalysisService.request.ts`

**Recommendation:** Export `TimeRangeSchema` from `MarketDataService.request.ts` to avoid duplication. Update the file by changing `const` to `export const`.

### Issue 2: Stochastic Oscillator Parameters (MINOR)

**Problem:** The plan lists Stochastic with parameters `(14,3,3)` but the library actually uses `period` and `signalPeriod` (two parameters, not three).

**Evidence:** From coinbase-mcp-server `TechnicalIndicatorsService.ts`:
```typescript
const stochValues = Stochastic.calculate({
  high,
  low,
  close,
  period: kPeriod,
  signalPeriod: dPeriod,
});
```

**Correction:** Stochastic uses `(kPeriod=14, dPeriod=3)` - only two period parameters.

### Issue 3: VWAP Does Not Have a Period Parameter (MINOR)

**Problem:** The plan doesn't clarify that VWAP has no configurable period.

**Evidence:** From coinbase-mcp-server:
```typescript
const vwapValues = VWAP.calculate({
  high,
  low,
  close,
  volume,
});
```

**Correction:** VWAP is calculated without a period - it uses all available data. The `period` field in `IndicatorConfigSchema` should be ignored for VWAP.

### Issue 4: Bollinger Bands %B Field Name (MINOR)

**Problem:** The plan uses `percentB` but the library returns `pb`.

**Evidence:** From coinbase-mcp-server:
```typescript
const bbValues: BollingerBandsValue[] = rawBbValues.map((bb) => ({
  middle: bb.middle,
  upper: bb.upper,
  lower: bb.lower,
  pb: bb.pb,  // <-- library uses 'pb', not 'percentB'
  bandwidth: (bb.upper - bb.lower) / bb.middle,
}));
```

**Correction:** Either rename to `pb` in the response schema, or map `pb` to `percentB` in the service.

### Issue 5: Missing DEFAULT_EXCHANGE Import (MINOR)

**Problem:** The request schema imports `DEFAULT_EXCHANGE` from `MarketDataService.request.ts`. This is currently exported, so this is correct. Verified.

### Issue 6: OBV Does Not Have a Period Parameter (MINOR)

**Problem:** Same as VWAP - OBV has no configurable period.

**Evidence:** From coinbase-mcp-server:
```typescript
const obvValues = OBV.calculate({
  close,
  volume,
});
```

**Correction:** OBV should ignore the `period` field in `IndicatorConfigSchema`.

### Issue 7: Missing Public Visibility Modifiers (CRITICAL)

**Problem:** The codebase enforces explicit `public` visibility modifiers (per commit `5ea7af2`). The combined plan does not show these modifiers in class method signatures.

**Correction:** All public methods in `TechnicalIndicatorsService`, `TechnicalAnalysisService`, and `TechnicalAnalysisToolRegistry` MUST have explicit `public` visibility modifiers.

### Issue 8: Missing Logger Mock Pattern (MODERATE)

**Problem:** The test files in the codebase use a specific logger mock pattern (see `MarketDataService.spec.ts` lines 4-10). The combined plan doesn't specify this pattern for test setup.

**Evidence:** From existing test files:
```typescript
import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));
```

**Correction:** All test files for new services MUST use this logger mock pattern.

### Issue 9: Division by Zero in Score Calculation (CRITICAL)

**Problem:** The signal aggregation logic has a potential division by zero when `bullishScore + bearishScore = 0`.

**Evidence:** From combined plan line 381:
```typescript
const score = ((bullishScore - bearishScore) / (bullishScore + bearishScore)) * 100;
```

**Correction:** Add explicit handling:
```typescript
const totalScore = bullishScore + bearishScore;
const score = totalScore === 0 ? 0 : ((bullishScore - bearishScore) / totalScore) * 100;
```

### Issue 10: TechnicalIndicatorsService Should Not Be Exported (MODERATE)

**Problem:** The combined plan doesn't clarify that `TechnicalIndicatorsService` should be an internal implementation detail, not exported from `services/index.ts`.

**Correction:** `TechnicalIndicatorsService` is a pure calculation service used only internally by `TechnicalAnalysisService`. It should NOT be exported from `services/index.ts` to keep the API surface clean.

### Issue 11: Missing Dependency Injection Pattern (MODERATE)

**Problem:** The combined plan doesn't show how `TechnicalAnalysisService` receives `MarketDataService` as a dependency.

**Correction:** Constructor should be:
```typescript
export class TechnicalAnalysisService {
  constructor(private readonly marketDataService: MarketDataService) {}
}
```

### Issue 12: Missing Error Export (MINOR)

**Problem:** `TechnicalAnalysisError` needs to be exported from `services/index.ts` for consumers.

**Correction:** Add to `services/index.ts`:
```typescript
export { TechnicalAnalysisError } from './TechnicalAnalysisService.types';
```

---

## Corrected Plan

### 1. Library Selection

**Decision: `@thuantan2060/technicalindicators`**

Rationale:
1. Security-fixed fork that resolved 31 vulnerabilities
2. Already proven in reference `coinbase-mcp-server` project
3. Native TypeScript support with full type definitions
4. 100+ indicators available
5. Cross-platform (no native dependencies)

**Installation:**
```bash
npm install @thuantan2060/technicalindicators
```

---

### 2. Architecture

```
TradeRepublicMcpServer
    └── TechnicalAnalysisToolRegistry (new)
            └── TechnicalAnalysisService (new - orchestration)
                    ├── MarketDataService (existing - fetches candles)
                    └── TechnicalIndicatorsService (new - pure calculations)
```

**Key Principles:**
- `TechnicalIndicatorsService`: Pure, stateless indicator calculations from candle arrays
- `TechnicalAnalysisService`: Orchestrates data fetching, indicator calculation, and signal aggregation
- Server-side processing: Only computed values returned (no raw candle data)

---

### 3. File Structure

**New Files:**
```
src/server/services/
  TechnicalIndicatorsService.ts           # Pure indicator calculations
  TechnicalIndicatorsService.spec.ts      # Unit tests (~60 tests)
  TechnicalAnalysisService.ts             # Orchestration service
  TechnicalAnalysisService.spec.ts        # Unit tests (~40 tests)
  TechnicalAnalysisService.request.ts     # Request schemas
  TechnicalAnalysisService.response.ts    # Response schemas
  TechnicalAnalysisService.types.ts       # Internal types

src/server/tools/
  TechnicalAnalysisToolRegistry.ts        # Tool registry
  TechnicalAnalysisToolRegistry.spec.ts   # Unit tests (~12 tests)
```

**Modified Files:**
```
src/server/services/index.ts              # Export new services
src/server/services/index.spec.ts         # Test exports
src/server/services/MarketDataService.request.ts  # Export TimeRangeSchema
src/server/tools/index.ts                 # Export new registry
src/server/TradeRepublicMcpServer.ts      # Integrate services
src/server/TradeRepublicMcpServer.spec.ts # Integration tests
package.json                              # Add dependency
```

---

### 4. Indicators to Support

**Core Indicators (10 - following YAGNI):**

| Category | Indicators |
|----------|------------|
| Momentum | RSI, MACD, Stochastic, ADX |
| Trend | SMA, EMA |
| Volatility | Bollinger Bands, ATR |
| Volume | OBV, VWAP |

*Additional indicators can be added in future tasks.*

---

### 5. Schemas

#### 5.1 Request Schemas (CORRECTED)

```typescript
// TechnicalAnalysisService.request.ts
import { z } from 'zod';
import { TimeRangeSchema, DEFAULT_EXCHANGE } from './MarketDataService.request';

export const IndicatorTypeSchema = z.enum([
  'RSI',           // Relative Strength Index
  'MACD',          // Moving Average Convergence Divergence
  'BOLLINGER',     // Bollinger Bands
  'SMA',           // Simple Moving Average
  'EMA',           // Exponential Moving Average
  'ADX',           // Average Directional Index
  'STOCHASTIC',    // Stochastic Oscillator
  'ATR',           // Average True Range
  'OBV',           // On-Balance Volume (no period)
  'VWAP',          // Volume Weighted Average Price (no period)
]);
export type IndicatorType = z.output<typeof IndicatorTypeSchema>;

export const IndicatorConfigSchema = z.object({
  type: IndicatorTypeSchema.describe('Indicator type'),
  period: z.number().int().min(2).max(200).optional()
    .describe('Period for the indicator (ignored for OBV/VWAP, default varies by indicator)'),
});
export type IndicatorConfig = z.output<typeof IndicatorConfigSchema>;

export const GetIndicatorsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range for historical data'),
  indicators: z.array(IndicatorConfigSchema).min(1).max(10)
    .describe('Indicators to calculate'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional()
    .describe('Exchange (default: LSX)'),
});
export type GetIndicatorsRequest = z.output<typeof GetIndicatorsRequestSchema>;

export const GetDetailedAnalysisRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.default('3m').optional()
    .describe('Time range for analysis (default: 3m)'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional()
    .describe('Exchange (default: LSX)'),
});
export type GetDetailedAnalysisRequest = z.output<typeof GetDetailedAnalysisRequestSchema>;
```

#### 5.2 Response Schemas (CORRECTED)

```typescript
// TechnicalAnalysisService.response.ts
import { z } from 'zod';

export const SignalStrengthSchema = z.enum(['strong', 'moderate', 'weak']);
export const SignalDirectionSchema = z.enum(['buy', 'sell', 'hold']);

export const IndicatorResultSchema = z.object({
  type: z.string(),
  period: z.number().optional(),
  value: z.number().nullable(),
  // For multi-value indicators (MACD, Bollinger, Stochastic)
  components: z.record(z.string(), z.number().nullable()).optional(),
});

export const GetIndicatorsResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  candleCount: z.number(),
  indicators: z.array(IndicatorResultSchema),
  timestamp: z.string(),
});

export const IndicatorSignalSchema = z.object({
  indicator: z.string(),
  signal: SignalDirectionSchema,
  strength: SignalStrengthSchema,
  reason: z.string(),
  value: z.number().nullable(),
});

export const AnalysisSummarySchema = z.object({
  overallSignal: SignalDirectionSchema,
  confidence: z.number().min(0).max(100),
  score: z.number().min(-100).max(100),
  bullishCount: z.number(),
  bearishCount: z.number(),
  neutralCount: z.number(),
});

export const TrendInfoSchema = z.object({
  direction: z.enum(['uptrend', 'downtrend', 'sideways']),
  strength: SignalStrengthSchema,
  sma20: z.number().nullable(),
  sma50: z.number().nullable(),
});

export const GetDetailedAnalysisResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  currentPrice: z.number(),
  summary: AnalysisSummarySchema,
  trend: TrendInfoSchema,
  signals: z.array(IndicatorSignalSchema),
  indicators: z.object({
    rsi: z.number().nullable(),
    macd: z.object({
      macd: z.number().nullable(),
      signal: z.number().nullable(),
      histogram: z.number().nullable(),
    }),
    bollingerBands: z.object({
      upper: z.number().nullable(),
      middle: z.number().nullable(),
      lower: z.number().nullable(),
      pb: z.number().nullable(),  // CORRECTED: library uses 'pb' not 'percentB'
    }),
    stochastic: z.object({
      k: z.number().nullable(),
      d: z.number().nullable(),
    }),
    adx: z.number().nullable(),
    atr: z.number().nullable(),
  }),
  timestamp: z.string(),
});
```

---

### 6. Implementation Steps (TDD)

#### Phase 1: Setup
1. Install `@thuantan2060/technicalindicators`
2. **Export `TimeRangeSchema`** from `MarketDataService.request.ts` (change `const` to `export const`)
3. Create empty file structure
4. Create request/response schemas

#### Phase 2: TechnicalIndicatorsService (Pure Calculations)

Implement each indicator with TDD:

| Indicator | Default Period | Library Parameters | Test Cases |
|-----------|---------------|-------------------|------------|
| RSI | 14 | `period`, `values` | insufficient data, valid calculation, range 0-100 |
| MACD | 12,26,9 | `fastPeriod`, `slowPeriod`, `signalPeriod`, `values` | insufficient data, macd/signal/histogram components |
| Bollinger | 20, 2sigma | `period`, `stdDev`, `values` | upper/middle/lower bands, pb calculation |
| SMA | 20 | `period`, `values` | basic calculation, custom period |
| EMA | 20 | `period`, `values` | basic calculation, custom period |
| ADX | 14 | `period`, `high`, `low`, `close` | ADX/+DI/-DI components, range 0-100 |
| Stochastic | 14,3 | `period`, `signalPeriod`, `high`, `low`, `close` | %K/%D components |
| ATR | 14 | `period`, `high`, `low`, `close` | positive value |
| OBV | N/A | `close`, `volume` | requires volume data, no period |
| VWAP | N/A | `high`, `low`, `close`, `volume` | requires volume data, no period |

#### Phase 3: TechnicalAnalysisService (Orchestration)

1. `getIndicators(request)`:
   - Fetch candles from MarketDataService
   - Calculate requested indicators
   - Return formatted response

2. `getDetailedAnalysis(request)`:
   - Fetch candles from MarketDataService
   - Calculate all indicators
   - Generate signals per indicator
   - Aggregate into overall signal with confidence

#### Phase 4: Signal Generation Logic

```typescript
// Signal rules

// RSI
if (rsi < 30) signal = 'buy', strength = 'strong', reason = 'oversold';
if (rsi > 70) signal = 'sell', strength = 'strong', reason = 'overbought';

// MACD (histogram crossover)
if (histogram > 0 && prevHistogram <= 0) signal = 'buy', reason = 'bullish crossover';
if (histogram < 0 && prevHistogram >= 0) signal = 'sell', reason = 'bearish crossover';

// Bollinger Bands (using pb from library)
if (pb < 0) signal = 'buy', strength = 'strong', reason = 'below lower band';
if (pb > 1) signal = 'sell', strength = 'strong', reason = 'above upper band';

// Overall signal calculation (weighted)
const weights = { strong: 2, moderate: 1, weak: 0.5 };
let bullishScore = 0, bearishScore = 0;
for (signal of signals) {
  if (signal.signal === 'buy') bullishScore += weights[signal.strength];
  if (signal.signal === 'sell') bearishScore += weights[signal.strength];
}
// CORRECTED: Handle division by zero
const totalScore = bullishScore + bearishScore;
const score = totalScore === 0 ? 0 : ((bullishScore - bearishScore) / totalScore) * 100;
const overallSignal = score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold';
```

#### Phase 5: TechnicalAnalysisToolRegistry

Register two tools:
- `get_indicators`: Calculate specific indicators on demand
- `get_detailed_analysis`: Comprehensive analysis with signals

#### Phase 6: Integration

1. Update `services/index.ts` with exports:
   - Export `TechnicalAnalysisService`
   - Export `TechnicalAnalysisError`
   - Export request/response schemas
   - **DO NOT export `TechnicalIndicatorsService`** (internal only)
2. Update `tools/index.ts` with export
3. Update `TradeRepublicMcpServer.ts` to instantiate and register:
   ```typescript
   // TechnicalAnalysisService depends on MarketDataService
   const technicalAnalysisService = new TechnicalAnalysisService(marketDataService);
   const technicalAnalysisToolRegistry = new TechnicalAnalysisToolRegistry(
     server,
     technicalAnalysisService,
   );
   technicalAnalysisToolRegistry.register();
   ```

#### Phase 7: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

---

### 7. Error Handling

#### Error Types

```typescript
export class TechnicalAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechnicalAnalysisError';
  }
}
```

#### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Not authenticated | MarketDataService throws TradeRepublicError |
| Insufficient candles | Return null for affected indicators |
| Empty candles array | Throw TechnicalAnalysisError |
| Invalid indicator type | Zod validation rejects request |
| Missing volume data | Skip OBV/VWAP, include warning |

#### Minimum Data Requirements

| Indicator | Minimum Candles |
|-----------|-----------------|
| RSI (14) | 15 |
| MACD (12,26,9) | 35 |
| Bollinger (20) | 21 |
| SMA/EMA (n) | n + 1 |
| ADX (14) | 28 |
| Stochastic (14,3) | 17 |
| ATR (14) | 15 |

For detailed analysis: require **50+ candles** minimum.

---

### 8. Test Summary

| Component | Estimated Tests |
|-----------|-----------------|
| TechnicalIndicatorsService | ~60 |
| TechnicalAnalysisService | ~40 |
| TechnicalAnalysisToolRegistry | ~12 |
| Index exports | ~4 |
| Integration tests | ~4 |
| **Total** | **~120** |

---

### 9. Acceptance Criteria

1. All tests pass with 100% coverage
2. Lint and format checks pass
3. Knip reports no unused exports
4. Both tools registered and functional
5. Proper error handling for insufficient data
6. Accurate indicator calculations
7. Signal generation produces sensible recommendations
8. **All public methods have explicit `public` visibility modifier**
9. **Logger mock pattern used consistently in all test files**
10. **`TechnicalIndicatorsService` is NOT exported from `services/index.ts`**
11. **Division by zero handled in score calculation**

---

### 10. Pre-Implementation Checklist

Before starting implementation, ensure:

- [ ] `TimeRangeSchema` is exported from `MarketDataService.request.ts`
- [ ] `@thuantan2060/technicalindicators` is installed
- [ ] Understand that OBV and VWAP have no period parameter
- [ ] Understand that Stochastic uses `period` and `signalPeriod` (not three periods)
- [ ] Understand that Bollinger Bands library returns `pb` (not `percentB`)
- [ ] All public methods will have explicit `public` visibility modifier
- [ ] Test files will use the standard logger mock pattern
- [ ] `TechnicalIndicatorsService` will NOT be exported (internal only)
- [ ] `TechnicalAnalysisService` constructor takes `MarketDataService` as dependency

---

### 11. Additional Test Cases Required

Beyond the basic indicator tests, ensure coverage for:

**TechnicalIndicatorsService:**
- All-NaN input arrays return null
- Single candle (insufficient for any calculation) returns null
- Exactly minimum required candles works correctly
- Volume is `undefined` for OBV/VWAP returns null

**TechnicalAnalysisService:**
- Score calculation when `bullishScore + bearishScore = 0` returns score of 0
- Edge cases at threshold boundaries (score = 20 returns 'hold', score = 21 returns 'buy')
- All signals are null/insufficient data results in 'hold' with 0 confidence
- MarketDataService throws error - error propagates correctly

**TechnicalAnalysisToolRegistry:**
- Service method called with correct binding (`.bind()`)
- Error from service is caught and returned as tool error
