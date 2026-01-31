# Task 07: Technical Analysis Service & Tools - Combined Implementation Plan

## Overview

Implement TechnicalAnalysisService with two MCP tools (`get_indicators`, `get_detailed_analysis`) for calculating technical indicators and generating trading signals.

---

## 1. Library Selection

### Decision: `@thuantan2060/technicalindicators`

**Rationale (from Plan 2):**
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

## 2. Architecture

### Design (from Plan 2 - separation of concerns)

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

## 3. File Structure

### New Files
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

### Modified Files
```
src/server/services/index.ts              # Export new services
src/server/services/index.spec.ts         # Test exports
src/server/tools/index.ts                 # Export new registry
src/server/TradeRepublicMcpServer.ts      # Integrate services
src/server/TradeRepublicMcpServer.spec.ts # Integration tests
package.json                              # Add dependency
```

---

## 4. Indicators to Support

### Core Indicators (10 - following YAGNI)

| Category | Indicators |
|----------|------------|
| Momentum | RSI, MACD, Stochastic, ADX |
| Trend | SMA, EMA |
| Volatility | Bollinger Bands, ATR |
| Volume | OBV, VWAP |

*Additional indicators (CCI, Williams %R, Ichimoku, etc.) can be added in future tasks.*

---

## 5. Schemas

### 5.1 Request Schemas

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
  'OBV',           // On-Balance Volume
  'VWAP',          // Volume Weighted Average Price
]);
export type IndicatorType = z.output<typeof IndicatorTypeSchema>;

export const IndicatorConfigSchema = z.object({
  type: IndicatorTypeSchema.describe('Indicator type'),
  period: z.number().int().min(2).max(200).optional()
    .describe('Period for the indicator (default varies by indicator)'),
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

### 5.2 Response Schemas

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
      percentB: z.number().nullable(),
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

## 6. Implementation Steps (TDD)

### Phase 1: Setup
1. Install `@thuantan2060/technicalindicators`
2. Create empty file structure
3. Create request/response schemas

### Phase 2: TechnicalIndicatorsService (Pure Calculations)

Implement each indicator with TDD:

| Indicator | Default Period | Test Cases |
|-----------|---------------|------------|
| RSI | 14 | insufficient data, valid calculation, range 0-100 |
| MACD | 12,26,9 | insufficient data, macd/signal/histogram components |
| Bollinger | 20, 2σ | upper/middle/lower bands, %B calculation |
| SMA | 20 | basic calculation, custom period |
| EMA | 20 | basic calculation, custom period |
| ADX | 14 | ADX/+DI/-DI components, range 0-100 |
| Stochastic | 14,3,3 | %K/%D components |
| ATR | 14 | positive value |
| OBV | N/A | requires volume data |
| VWAP | N/A | requires volume data |

### Phase 3: TechnicalAnalysisService (Orchestration)

1. `getIndicators(request)`:
   - Fetch candles from MarketDataService
   - Calculate requested indicators
   - Return formatted response

2. `getDetailedAnalysis(request)`:
   - Fetch candles from MarketDataService
   - Calculate all indicators
   - Generate signals per indicator
   - Aggregate into overall signal with confidence

### Phase 4: Signal Generation Logic

```typescript
// Signal rules from Plan 1

// RSI
if (rsi < 30) signal = 'buy', strength = 'strong', reason = 'oversold';
if (rsi > 70) signal = 'sell', strength = 'strong', reason = 'overbought';

// MACD (histogram crossover)
if (histogram > 0 && prevHistogram <= 0) signal = 'buy', reason = 'bullish crossover';
if (histogram < 0 && prevHistogram >= 0) signal = 'sell', reason = 'bearish crossover';

// Bollinger Bands
if (percentB < 0) signal = 'buy', strength = 'strong', reason = 'below lower band';
if (percentB > 1) signal = 'sell', strength = 'strong', reason = 'above upper band';

// Overall signal calculation (weighted)
const weights = { strong: 2, moderate: 1, weak: 0.5 };
let bullishScore = 0, bearishScore = 0;
for (signal of signals) {
  if (signal.signal === 'buy') bullishScore += weights[signal.strength];
  if (signal.signal === 'sell') bearishScore += weights[signal.strength];
}
const score = ((bullishScore - bearishScore) / (bullishScore + bearishScore)) * 100;
const overallSignal = score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold';
```

### Phase 5: TechnicalAnalysisToolRegistry

Register two tools:
- `get_indicators`: Calculate specific indicators on demand
- `get_detailed_analysis`: Comprehensive analysis with signals

### Phase 6: Integration

1. Update `services/index.ts` with exports
2. Update `tools/index.ts` with export
3. Update `TradeRepublicMcpServer.ts` to instantiate and register

### Phase 7: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

---

## 7. Error Handling

### Error Types

```typescript
export class TechnicalAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechnicalAnalysisError';
  }
}
```

### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Not authenticated | MarketDataService throws TradeRepublicError |
| Insufficient candles | Return null for affected indicators |
| Empty candles array | Throw TechnicalAnalysisError |
| Invalid indicator type | Zod validation rejects request |
| Missing volume data | Skip OBV/VWAP, include warning |

### Minimum Data Requirements

| Indicator | Minimum Candles |
|-----------|-----------------|
| RSI (14) | 15 |
| MACD (12,26,9) | 35 |
| Bollinger (20) | 21 |
| SMA/EMA (n) | n + 1 |
| ADX (14) | 28 |
| Stochastic (14,3,3) | 20 |
| ATR (14) | 15 |

For detailed analysis: require **50+ candles** minimum.

---

## 8. Test Summary

| Component | Estimated Tests |
|-----------|-----------------|
| TechnicalIndicatorsService | ~60 |
| TechnicalAnalysisService | ~40 |
| TechnicalAnalysisToolRegistry | ~12 |
| Index exports | ~4 |
| Integration tests | ~4 |
| **Total** | **~120** |

---

## 9. Acceptance Criteria

1. All tests pass with 100% coverage
2. Lint and format checks pass
3. Knip reports no unused exports
4. Both tools registered and functional
5. Proper error handling for insufficient data
6. Accurate indicator calculations
7. Signal generation produces sensible recommendations
