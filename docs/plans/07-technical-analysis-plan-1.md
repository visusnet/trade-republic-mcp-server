# Task 07: Technical Analysis Service & Tools - Implementation Plan (Agent 1)

## Overview

Implement a TechnicalAnalysisService that computes technical indicators from OHLCV price data and exposes two MCP tools: `get_indicators` and `get_detailed_analysis`. The service will integrate with the existing MarketDataService to fetch price history.

---

## 1. Research: Technical Indicator Library Selection

### Candidates Evaluated

| Library | NPM Package | Pros | Cons |
|---------|-------------|------|------|
| **technicalindicators** | `technicalindicators` | Pure TypeScript, no native deps, well-maintained, 1.6k+ stars | Slightly verbose API |
| **talib-binding** | `talib-binding` | Gold standard, comprehensive | Native C bindings, complex install |
| **tulind** | `tulind` | Fast, 100+ indicators | Native deps, node-gyp required |
| **indicatorkit** | `indicatorkit` | Modern API | Less mature, fewer indicators |

### Recommendation: `technicalindicators`

**Rationale:**
1. **Pure TypeScript/JavaScript** - No native dependencies, works everywhere Node runs
2. **Active maintenance** - Regular updates, good issue response
3. **Comprehensive indicators** - Includes RSI, MACD, Bollinger Bands, SMA, EMA, ADX, Stochastic, ATR, OBV, and many more
4. **Type definitions included** - Good TypeScript support
5. **Functional API** - Clean, stateless indicator functions
6. **Battle-tested** - Used in production by many trading applications

**Installation:**
```bash
npm install technicalindicators
```

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     TechnicalAnalysisToolRegistry               │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │   get_indicators    │  │      get_detailed_analysis       │ │
│  └─────────────────────┘  └──────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TechnicalAnalysisService                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  calculateIndicators(candles, indicators[])                 ││
│  │  analyzeWithSignals(candles)                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Internal indicator calculators using technicalindicators   ││
│  │  - RSI, MACD, Bollinger, SMA, EMA, ADX, Stochastic, ATR    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MarketDataService                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  getPriceHistory(isin, range, exchange) → candles[]         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **get_indicators tool:**
   - User requests indicators for an ISIN with a time range
   - Service fetches candle data from MarketDataService
   - Service computes requested indicators
   - Returns indicator values

2. **get_detailed_analysis tool:**
   - User requests full analysis for an ISIN
   - Service fetches candle data
   - Service computes multiple indicators
   - Service generates buy/sell/hold signals based on indicator confluence
   - Returns comprehensive analysis with signals and confidence

### 2.3 File Structure

```
src/server/services/
  TechnicalAnalysisService.ts          # Main service implementation
  TechnicalAnalysisService.spec.ts     # Unit tests
  TechnicalAnalysisService.request.ts  # Request schemas
  TechnicalAnalysisService.response.ts # Response schemas
  TechnicalAnalysisService.types.ts    # Internal types (indicators, signals)

src/server/tools/
  TechnicalAnalysisToolRegistry.ts     # Tool registry
  TechnicalAnalysisToolRegistry.spec.ts
```

---

## 3. Schemas

### 3.1 Request Schemas

```typescript
// TechnicalAnalysisService.request.ts

import { z } from 'zod';
import { TimeRangeSchema } from './MarketDataService.request';

/**
 * Supported technical indicators
 */
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

/**
 * Indicator configuration with optional parameters
 */
export const IndicatorConfigSchema = z.object({
  type: IndicatorTypeSchema.describe('Indicator type'),
  period: z.number().int().min(2).max(200).optional()
    .describe('Period for the indicator (default varies by indicator)'),
});
export type IndicatorConfig = z.output<typeof IndicatorConfigSchema>;

/**
 * Request schema for get_indicators tool
 */
export const GetIndicatorsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range for historical data'),
  indicators: z.array(IndicatorConfigSchema)
    .min(1)
    .max(10)
    .describe('Indicators to calculate'),
  exchange: z.string().optional()
    .describe('Exchange (default: LSX)'),
});
export type GetIndicatorsRequest = z.output<typeof GetIndicatorsRequestSchema>;

/**
 * Request schema for get_detailed_analysis tool
 */
export const GetDetailedAnalysisRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.default('3m')
    .describe('Time range for analysis (default: 3m)'),
  exchange: z.string().optional()
    .describe('Exchange (default: LSX)'),
});
export type GetDetailedAnalysisRequest = z.output<typeof GetDetailedAnalysisRequestSchema>;
```

### 3.2 Response Schemas

```typescript
// TechnicalAnalysisService.response.ts

import { z } from 'zod';

/**
 * Single indicator result
 */
export const IndicatorResultSchema = z.object({
  type: z.string(),
  period: z.number().optional(),
  values: z.array(z.number().nullable()),
  latestValue: z.number().nullable(),
  // For multi-value indicators (MACD, Bollinger)
  components: z.record(z.string(), z.array(z.number().nullable())).optional(),
});
export type IndicatorResult = z.output<typeof IndicatorResultSchema>;

/**
 * Response schema for get_indicators tool
 */
export const GetIndicatorsResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  candleCount: z.number(),
  indicators: z.array(IndicatorResultSchema),
  timestamp: z.string(),
});
export type GetIndicatorsResponse = z.output<typeof GetIndicatorsResponseSchema>;

/**
 * Signal strength/confidence
 */
export const SignalStrengthSchema = z.enum(['strong', 'moderate', 'weak']);
export type SignalStrength = z.output<typeof SignalStrengthSchema>;

/**
 * Trading signal direction
 */
export const SignalDirectionSchema = z.enum(['buy', 'sell', 'hold']);
export type SignalDirection = z.output<typeof SignalDirectionSchema>;

/**
 * Individual signal from an indicator
 */
export const IndicatorSignalSchema = z.object({
  indicator: z.string(),
  signal: SignalDirectionSchema,
  strength: SignalStrengthSchema,
  reason: z.string(),
  value: z.number().nullable(),
});
export type IndicatorSignal = z.output<typeof IndicatorSignalSchema>;

/**
 * Overall market analysis summary
 */
export const AnalysisSummarySchema = z.object({
  overallSignal: SignalDirectionSchema,
  confidence: z.number().min(0).max(100),
  bullishSignals: z.number(),
  bearishSignals: z.number(),
  neutralSignals: z.number(),
});
export type AnalysisSummary = z.output<typeof AnalysisSummarySchema>;

/**
 * Trend information
 */
export const TrendInfoSchema = z.object({
  direction: z.enum(['uptrend', 'downtrend', 'sideways']),
  strength: SignalStrengthSchema,
  sma20: z.number().nullable(),
  sma50: z.number().nullable(),
  sma200: z.number().nullable(),
});
export type TrendInfo = z.output<typeof TrendInfoSchema>;

/**
 * Support/Resistance levels
 */
export const SupportResistanceSchema = z.object({
  support: z.array(z.number()),
  resistance: z.array(z.number()),
});
export type SupportResistance = z.output<typeof SupportResistanceSchema>;

/**
 * Response schema for get_detailed_analysis tool
 */
export const GetDetailedAnalysisResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  currentPrice: z.number(),
  summary: AnalysisSummarySchema,
  trend: TrendInfoSchema,
  signals: z.array(IndicatorSignalSchema),
  supportResistance: SupportResistanceSchema,
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
export type GetDetailedAnalysisResponse = z.output<typeof GetDetailedAnalysisResponseSchema>;
```

---

## 4. Implementation Steps (TDD Red-Green-Refactor)

### Phase 1: Setup & Dependencies

1. **Install dependencies**
   ```bash
   npm install technicalindicators
   npm install --save-dev @types/technicalindicators
   ```

2. **Create file structure** (empty files initially)

### Phase 2: TechnicalAnalysisService - Core Indicator Calculations

#### Step 2.1: RSI Calculation

**Red (write failing test):**
```typescript
describe('TechnicalAnalysisService', () => {
  describe('calculateIndicators', () => {
    it('should calculate RSI with default period (14)', async () => {
      const candles = generateTestCandles(20); // Helper to generate candles
      const result = await service.calculateIndicators(candles, [{ type: 'RSI' }]);

      expect(result.indicators).toHaveLength(1);
      expect(result.indicators[0].type).toBe('RSI');
      expect(result.indicators[0].period).toBe(14);
      expect(result.indicators[0].latestValue).toBeGreaterThanOrEqual(0);
      expect(result.indicators[0].latestValue).toBeLessThanOrEqual(100);
    });

    it('should calculate RSI with custom period', async () => {
      const candles = generateTestCandles(30);
      const result = await service.calculateIndicators(candles, [{ type: 'RSI', period: 7 }]);

      expect(result.indicators[0].period).toBe(7);
    });
  });
});
```

**Green (minimal implementation):**
```typescript
import { RSI } from 'technicalindicators';

public calculateRSI(closes: number[], period = 14): number[] {
  const result = RSI.calculate({ values: closes, period });
  return result;
}
```

**Refactor:** Extract common patterns, add validation.

#### Step 2.2: MACD Calculation

**Red:**
```typescript
it('should calculate MACD with default parameters (12, 26, 9)', async () => {
  const candles = generateTestCandles(50);
  const result = await service.calculateIndicators(candles, [{ type: 'MACD' }]);

  expect(result.indicators[0].type).toBe('MACD');
  expect(result.indicators[0].components).toBeDefined();
  expect(result.indicators[0].components!.macd).toBeDefined();
  expect(result.indicators[0].components!.signal).toBeDefined();
  expect(result.indicators[0].components!.histogram).toBeDefined();
});
```

**Green & Refactor:** Implement MACD using technicalindicators library.

#### Step 2.3: Bollinger Bands

**Red:**
```typescript
it('should calculate Bollinger Bands with default period (20) and stdDev (2)', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'BOLLINGER' }]);

  expect(result.indicators[0].type).toBe('BOLLINGER');
  expect(result.indicators[0].components!.upper).toBeDefined();
  expect(result.indicators[0].components!.middle).toBeDefined();
  expect(result.indicators[0].components!.lower).toBeDefined();
});
```

#### Step 2.4: SMA & EMA

**Red:**
```typescript
it('should calculate SMA with custom period', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'SMA', period: 20 }]);

  expect(result.indicators[0].type).toBe('SMA');
  expect(result.indicators[0].period).toBe(20);
  expect(result.indicators[0].latestValue).toBeDefined();
});

it('should calculate EMA with custom period', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'EMA', period: 12 }]);

  expect(result.indicators[0].type).toBe('EMA');
  expect(result.indicators[0].period).toBe(12);
});
```

#### Step 2.5: ADX, Stochastic, ATR

**Red:**
```typescript
it('should calculate ADX', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'ADX' }]);

  expect(result.indicators[0].type).toBe('ADX');
  expect(result.indicators[0].latestValue).toBeGreaterThanOrEqual(0);
  expect(result.indicators[0].latestValue).toBeLessThanOrEqual(100);
});

it('should calculate Stochastic', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'STOCHASTIC' }]);

  expect(result.indicators[0].components!.k).toBeDefined();
  expect(result.indicators[0].components!.d).toBeDefined();
});

it('should calculate ATR', async () => {
  const candles = generateTestCandles(30);
  const result = await service.calculateIndicators(candles, [{ type: 'ATR' }]);

  expect(result.indicators[0].latestValue).toBeGreaterThan(0);
});
```

### Phase 3: Error Handling

#### Step 3.1: Insufficient Data

**Red:**
```typescript
it('should throw error when insufficient data for indicator', async () => {
  const candles = generateTestCandles(5); // Only 5 candles

  await expect(
    service.calculateIndicators(candles, [{ type: 'RSI', period: 14 }])
  ).rejects.toThrow('Insufficient data');
});
```

**Green:**
```typescript
private validateDataLength(candles: Candle[], requiredLength: number): void {
  if (candles.length < requiredLength) {
    throw new TechnicalAnalysisError(
      `Insufficient data: need at least ${requiredLength} candles, got ${candles.length}`
    );
  }
}
```

### Phase 4: Signal Generation

#### Step 4.1: RSI Signals

**Red:**
```typescript
describe('generateSignals', () => {
  it('should generate buy signal when RSI < 30 (oversold)', () => {
    const signal = service.generateRSISignal(25);
    expect(signal.signal).toBe('buy');
    expect(signal.strength).toBe('strong');
    expect(signal.reason).toContain('oversold');
  });

  it('should generate sell signal when RSI > 70 (overbought)', () => {
    const signal = service.generateRSISignal(78);
    expect(signal.signal).toBe('sell');
    expect(signal.strength).toBe('strong');
    expect(signal.reason).toContain('overbought');
  });

  it('should generate hold signal when RSI is neutral', () => {
    const signal = service.generateRSISignal(50);
    expect(signal.signal).toBe('hold');
  });
});
```

#### Step 4.2: MACD Signals

**Red:**
```typescript
it('should generate buy signal on MACD bullish crossover', () => {
  const signal = service.generateMACDSignal({
    macd: 0.5,
    signal: 0.3,
    histogram: 0.2,
    previousHistogram: -0.1,
  });
  expect(signal.signal).toBe('buy');
  expect(signal.reason).toContain('crossover');
});
```

#### Step 4.3: Overall Analysis

**Red:**
```typescript
describe('analyzeWithSignals', () => {
  it('should return comprehensive analysis', async () => {
    const candles = generateTestCandles(100);
    const result = await service.analyzeWithSignals(candles);

    expect(result.summary).toBeDefined();
    expect(result.summary.overallSignal).toMatch(/buy|sell|hold/);
    expect(result.summary.confidence).toBeGreaterThanOrEqual(0);
    expect(result.summary.confidence).toBeLessThanOrEqual(100);
    expect(result.signals).toBeInstanceOf(Array);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.trend).toBeDefined();
  });

  it('should calculate overall signal based on signal confluence', async () => {
    // Create candles that will produce mostly bullish signals
    const bullishCandles = generateBullishTrendCandles(100);
    const result = await service.analyzeWithSignals(bullishCandles);

    expect(result.summary.bullishSignals).toBeGreaterThan(result.summary.bearishSignals);
    expect(result.summary.overallSignal).toBe('buy');
  });
});
```

### Phase 5: Tool Integration

#### Step 5.1: get_indicators Tool

**Red:**
```typescript
describe('get_indicators handler', () => {
  it('should fetch candles and calculate indicators', async () => {
    mockMarketDataService.getPriceHistory.mockResolvedValue({
      isin: 'DE0007164600',
      exchange: 'LSX',
      range: '3m',
      candles: generateTestCandles(100),
    });

    const result = await handler({
      isin: 'DE0007164600',
      range: '3m',
      indicators: [{ type: 'RSI' }, { type: 'MACD' }],
    });

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text);
    expect(response.indicators).toHaveLength(2);
  });
});
```

#### Step 5.2: get_detailed_analysis Tool

**Red:**
```typescript
describe('get_detailed_analysis handler', () => {
  it('should return full analysis with signals', async () => {
    mockMarketDataService.getPriceHistory.mockResolvedValue({
      isin: 'DE0007164600',
      exchange: 'LSX',
      range: '3m',
      candles: generateTestCandles(100),
    });

    const result = await handler({ isin: 'DE0007164600' });

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text);
    expect(response.summary).toBeDefined();
    expect(response.signals).toBeDefined();
    expect(response.trend).toBeDefined();
    expect(response.indicators).toBeDefined();
  });
});
```

### Phase 6: TechnicalAnalysisToolRegistry

**Red:**
```typescript
describe('TechnicalAnalysisToolRegistry', () => {
  it('should register get_indicators tool', () => {
    registry.register();
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'get_indicators',
      expect.objectContaining({
        title: 'Get Indicators',
        description: expect.stringContaining('technical indicators'),
      }),
      expect.any(Function),
    );
  });

  it('should register get_detailed_analysis tool', () => {
    registry.register();
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'get_detailed_analysis',
      expect.objectContaining({
        title: 'Get Detailed Analysis',
        description: expect.stringContaining('comprehensive'),
      }),
      expect.any(Function),
    );
  });

  it('should register 2 tools', () => {
    registry.register();
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
  });
});
```

---

## 5. Test Cases Summary

### 5.1 TechnicalAnalysisService.spec.ts

| Category | Test Case |
|----------|-----------|
| **RSI** | Calculate with default period (14) |
| **RSI** | Calculate with custom period |
| **RSI** | Return null for insufficient data |
| **MACD** | Calculate with default parameters (12, 26, 9) |
| **MACD** | Return macd, signal, histogram components |
| **Bollinger** | Calculate with default period (20) and stdDev (2) |
| **Bollinger** | Return upper, middle, lower bands |
| **SMA** | Calculate with various periods |
| **EMA** | Calculate with various periods |
| **ADX** | Calculate and return value 0-100 |
| **Stochastic** | Calculate and return K, D values |
| **ATR** | Calculate average true range |
| **Multiple** | Calculate multiple indicators in one call |
| **Errors** | Throw on insufficient data |
| **Errors** | Throw on empty candles array |
| **Errors** | Throw on invalid indicator type |
| **Signals** | Generate buy signal for oversold RSI |
| **Signals** | Generate sell signal for overbought RSI |
| **Signals** | Generate signal for MACD crossover |
| **Signals** | Generate signal for Bollinger band touches |
| **Signals** | Calculate overall signal from confluence |
| **Signals** | Calculate confidence percentage |
| **Trend** | Detect uptrend from SMA alignment |
| **Trend** | Detect downtrend from SMA alignment |
| **Trend** | Detect sideways market |
| **Support/Resistance** | Identify support levels |
| **Support/Resistance** | Identify resistance levels |

### 5.2 TechnicalAnalysisToolRegistry.spec.ts

| Category | Test Case |
|----------|-----------|
| **Registration** | Register get_indicators tool with correct metadata |
| **Registration** | Register get_detailed_analysis tool with correct metadata |
| **Registration** | Register exactly 2 tools |
| **get_indicators** | Call service.calculateIndicators on handler invocation |
| **get_indicators** | Return formatted success result |
| **get_indicators** | Return error on service failure |
| **get_indicators** | Return error on insufficient data |
| **get_detailed_analysis** | Call service.analyzeWithSignals on handler invocation |
| **get_detailed_analysis** | Return comprehensive analysis |
| **get_detailed_analysis** | Return error on service failure |

---

## 6. Signal Generation Logic

### 6.1 RSI Signal Rules

| RSI Value | Signal | Strength | Reason |
|-----------|--------|----------|--------|
| < 30 | Buy | Strong | Oversold territory |
| 30-40 | Buy | Weak | Approaching oversold |
| 40-60 | Hold | - | Neutral zone |
| 60-70 | Sell | Weak | Approaching overbought |
| > 70 | Sell | Strong | Overbought territory |

### 6.2 MACD Signal Rules

| Condition | Signal | Strength |
|-----------|--------|----------|
| Histogram crosses above 0 | Buy | Moderate |
| MACD crosses above signal line | Buy | Moderate |
| Strong positive divergence | Buy | Strong |
| Histogram crosses below 0 | Sell | Moderate |
| MACD crosses below signal line | Sell | Moderate |
| Strong negative divergence | Sell | Strong |

### 6.3 Bollinger Bands Signal Rules

| Condition | Signal | Strength |
|-----------|--------|----------|
| Price touches lower band | Buy | Moderate |
| Price closes below lower band | Buy | Strong |
| Price touches upper band | Sell | Moderate |
| Price closes above upper band | Sell | Strong |
| %B < 0 | Buy | Strong |
| %B > 1 | Sell | Strong |

### 6.4 Overall Signal Calculation

```typescript
function calculateOverallSignal(signals: IndicatorSignal[]): AnalysisSummary {
  const weights = { strong: 2, moderate: 1, weak: 0.5 };

  let bullishScore = 0;
  let bearishScore = 0;

  for (const signal of signals) {
    const weight = weights[signal.strength];
    if (signal.signal === 'buy') bullishScore += weight;
    if (signal.signal === 'sell') bearishScore += weight;
  }

  const totalWeight = bullishScore + bearishScore;
  const netScore = bullishScore - bearishScore;

  const overallSignal = netScore > 0.5 ? 'buy' : netScore < -0.5 ? 'sell' : 'hold';
  const confidence = totalWeight > 0
    ? Math.min(100, Math.abs(netScore / totalWeight) * 100)
    : 0;

  return {
    overallSignal,
    confidence: Math.round(confidence),
    bullishSignals: signals.filter(s => s.signal === 'buy').length,
    bearishSignals: signals.filter(s => s.signal === 'sell').length,
    neutralSignals: signals.filter(s => s.signal === 'hold').length,
  };
}
```

---

## 7. Minimum Data Requirements

| Indicator | Minimum Candles Required |
|-----------|-------------------------|
| RSI (14) | 15 (period + 1) |
| MACD (12, 26, 9) | 35 (26 + 9) |
| Bollinger (20) | 21 (period + 1) |
| SMA (n) | n + 1 |
| EMA (n) | n + 1 |
| ADX (14) | 28 (2 * period) |
| Stochastic (14, 3, 3) | 20 |
| ATR (14) | 15 |

For detailed analysis, require at least **100 candles** to ensure all indicators have sufficient data.

---

## 8. Error Handling

### 8.1 Error Types

```typescript
// TechnicalAnalysisService.types.ts

export class TechnicalAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechnicalAnalysisError';
  }
}
```

### 8.2 Error Scenarios

| Scenario | Error Message |
|----------|---------------|
| Empty candles array | "No price data available" |
| Insufficient data for indicator | "Insufficient data: need at least N candles, got M" |
| Invalid indicator type | "Unknown indicator type: X" |
| MarketDataService failure | Propagate underlying error |

---

## 9. Integration with Existing Code

### 9.1 Service Export

Add to `src/server/services/index.ts`:
```typescript
export { TechnicalAnalysisService } from './TechnicalAnalysisService';
export type { GetIndicatorsRequest, GetDetailedAnalysisRequest } from './TechnicalAnalysisService.request';
export type { GetIndicatorsResponse, GetDetailedAnalysisResponse } from './TechnicalAnalysisService.response';
```

### 9.2 Tool Registry Export

Add to `src/server/tools/index.ts`:
```typescript
export { TechnicalAnalysisToolRegistry } from './TechnicalAnalysisToolRegistry';
```

### 9.3 Server Integration

Update `TradeRepublicMcpServer.ts`:
```typescript
import { TechnicalAnalysisToolRegistry } from './tools/TechnicalAnalysisToolRegistry';
import { TechnicalAnalysisService } from './services/TechnicalAnalysisService';

// In constructor or init method:
const technicalAnalysisService = new TechnicalAnalysisService(this.marketDataService);
const technicalAnalysisToolRegistry = new TechnicalAnalysisToolRegistry(
  this.mcpServer,
  technicalAnalysisService,
);
technicalAnalysisToolRegistry.register();
```

---

## 10. Timeline Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Setup | 0.5 hours |
| Phase 2: Core indicators | 2 hours |
| Phase 3: Error handling | 0.5 hours |
| Phase 4: Signal generation | 1.5 hours |
| Phase 5: Tool integration | 1 hour |
| Phase 6: Tool registry | 0.5 hours |
| **Total** | **6 hours** |

---

## 11. Acceptance Criteria

1. All tests pass with 100% coverage
2. Lint and format checks pass
3. Knip reports no unused exports
4. Both tools registered and functional
5. Proper error handling for all edge cases
6. Accurate indicator calculations (verified against known values)
7. Signal generation produces sensible buy/sell/hold recommendations
