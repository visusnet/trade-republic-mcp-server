# Task 07: Technical Analysis Service & Tools - Implementation Plan (Agent 2)

## Overview

Implement a TechnicalAnalysisService that provides technical indicator calculations and comprehensive market analysis for the Trade Republic MCP server. This service will integrate with the existing MarketDataService to fetch OHLCV data and compute indicators using a well-maintained TypeScript library.

## 1. Research: Technical Indicator Library Selection

### Library Comparison

| Library | NPM Package | TypeScript | Maintenance | Features |
|---------|-------------|------------|-------------|----------|
| technicalindicators | `technicalindicators` | Native | Original, less active | 100+ indicators |
| @thuantan2060/technicalindicators | `@thuantan2060/technicalindicators` | Native | Active fork, security fixes | 100+ indicators, fixed vulns |
| trading-signals | `trading-signals` | Native | Active (7.2.0, 9 days ago) | Clean API, streaming |
| @ixjb94/indicators | `@ixjb94/indicators` | Native | Active | Fastest performance |

### Recommendation: `@thuantan2060/technicalindicators`

**Rationale:**
1. **Proven in Reference Project**: Already used in `coinbase-mcp-server` with extensive testing
2. **Security Fixes**: Fork that resolved 31 vulnerabilities (8 moderate, 20 high, 3 critical)
3. **Cross-Platform**: Works on Windows/Linux/macOS
4. **Feature-Rich**: 100+ indicators including candlestick pattern detection
5. **Native TypeScript**: Full type definitions included
6. **Familiar API**: Same patterns as reference implementation

**Alternative**: `trading-signals` could be considered if a cleaner streaming API is preferred, but switching would require significant deviation from the proven reference patterns.

## 2. Architecture

### Service Integration

```
TradeRepublicMcpServer
    ├── PortfolioToolRegistry (existing)
    ├── MarketDataToolRegistry (existing)
    │       └── MarketDataService (existing)
    └── TechnicalAnalysisToolRegistry (new)
            └── TechnicalAnalysisService (new)
                    ├── MarketDataService (dependency - for candle data)
                    └── TechnicalIndicatorsService (new - pure indicator calculations)
```

### Design Principles

1. **Separation of Concerns**:
   - `TechnicalIndicatorsService`: Pure indicator calculations from candle arrays
   - `TechnicalAnalysisService`: Orchestrates data fetching + indicator calculation + signal aggregation

2. **Server-Side Processing**: Following reference pattern, candle data stays server-side; only computed values returned to reduce context usage

3. **Stateless Calculations**: All indicator methods are pure functions - no state maintained between calls

4. **Reusable Components**: Individual indicator methods can be called directly for simple use cases

## 3. File Structure

### New Files

```
src/server/
├── services/
│   ├── TechnicalIndicatorsService.ts       # Pure indicator calculations
│   ├── TechnicalIndicatorsService.spec.ts  # Tests for indicator calculations
│   ├── TechnicalIndicatorsService.types.ts # Response types for indicators
│   ├── TechnicalIndicatorsService.request.ts # Request schemas
│   ├── TechnicalAnalysisService.ts         # Orchestration service
│   ├── TechnicalAnalysisService.spec.ts    # Tests for analysis service
│   ├── TechnicalAnalysisService.types.ts   # Response types for analysis
│   └── TechnicalAnalysisService.request.ts # Request schemas
├── tools/
│   ├── TechnicalAnalysisToolRegistry.ts    # MCP tool registration
│   └── TechnicalAnalysisToolRegistry.spec.ts
└── common/
    └── candle.types.ts                     # Shared candle type definition
```

### Modified Files

```
src/server/services/index.ts               # Export new services
src/server/tools/index.ts                  # Export new tool registry
src/server/TradeRepublicMcpServer.ts       # Integrate new services
src/server/TradeRepublicMcpServer.spec.ts  # Test integration
package.json                               # Add @thuantan2060/technicalindicators
```

## 4. Schemas

### 4.1 Common Candle Type

```typescript
// src/server/common/candle.types.ts
import { z } from 'zod';

export const CandleSchema = z.object({
  time: z.number().describe('Unix timestamp in milliseconds'),
  open: z.number().describe('Opening price'),
  high: z.number().describe('Highest price'),
  low: z.number().describe('Lowest price'),
  close: z.number().describe('Closing price'),
  volume: z.number().optional().describe('Trading volume'),
});

export type Candle = z.output<typeof CandleSchema>;
```

### 4.2 get_indicators Tool

**Request Schema:**

```typescript
// TechnicalAnalysisService.request.ts
import { z } from 'zod';
import { DEFAULT_EXCHANGE, TimeRangeSchema } from './MarketDataService.request';

export const IndicatorTypeSchema = z.enum([
  // Momentum (7)
  'rsi', 'macd', 'stochastic', 'adx', 'cci', 'williams_r', 'roc',
  // Trend (4)
  'sma', 'ema', 'ichimoku', 'psar',
  // Volatility (3)
  'bollinger_bands', 'atr', 'keltner',
  // Volume (4)
  'obv', 'mfi', 'vwap', 'volume_profile',
]);
export type IndicatorType = z.output<typeof IndicatorTypeSchema>;

export const GetIndicatorsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional()
    .describe('Exchange (default: LSX)'),
  range: TimeRangeSchema.describe('Time range for candle data'),
  indicators: z.array(IndicatorTypeSchema).min(1)
    .describe('List of indicators to calculate'),
  // Optional custom parameters
  rsiPeriod: z.number().int().min(2).default(14).optional()
    .describe('RSI period (default: 14)'),
  smaPeriod: z.number().int().min(1).default(20).optional()
    .describe('SMA period (default: 20)'),
  emaPeriod: z.number().int().min(1).default(20).optional()
    .describe('EMA period (default: 20)'),
  bollingerPeriod: z.number().int().min(2).default(20).optional()
    .describe('Bollinger Bands period (default: 20)'),
  bollingerStdDev: z.number().min(0.1).default(2).optional()
    .describe('Bollinger Bands standard deviation (default: 2)'),
  atrPeriod: z.number().int().min(1).default(14).optional()
    .describe('ATR period (default: 14)'),
});
export type GetIndicatorsRequest = z.output<typeof GetIndicatorsRequestSchema>;
```

**Response Schema:**

```typescript
// TechnicalAnalysisService.types.ts

export interface IndicatorValue {
  readonly name: string;
  readonly value: number | null;
  readonly values?: readonly number[];
  readonly metadata?: Record<string, unknown>;
}

export interface GetIndicatorsResponse {
  readonly isin: string;
  readonly exchange: string;
  readonly range: string;
  readonly candleCount: number;
  readonly indicators: Record<string, IndicatorValue>;
  readonly timestamp: string;
}
```

### 4.3 get_detailed_analysis Tool

**Request Schema:**

```typescript
export const GetDetailedAnalysisRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z.string().default(DEFAULT_EXCHANGE).optional()
    .describe('Exchange (default: LSX)'),
  range: TimeRangeSchema.describe('Time range for candle data'),
  // All indicators calculated by default
  includePatterns: z.boolean().default(true).optional()
    .describe('Include candlestick pattern detection (default: true)'),
  includeFibonacci: z.boolean().default(true).optional()
    .describe('Include Fibonacci retracement levels (default: true)'),
  includePivotPoints: z.boolean().default(true).optional()
    .describe('Include pivot point calculations (default: true)'),
});
export type GetDetailedAnalysisRequest = z.output<typeof GetDetailedAnalysisRequestSchema>;
```

**Response Schema:**

```typescript
export type SignalDirection = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
export type SignalConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TradingSignal {
  readonly direction: SignalDirection;
  readonly score: number;        // -100 to +100
  readonly confidence: SignalConfidence;
  readonly reasons: readonly string[];
}

export interface PriceSummary {
  readonly current: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly changePercent: number;
}

export interface MomentumAnalysis {
  readonly rsi?: { value: number; signal: string };
  readonly macd?: { macd: number; signal: number; histogram: number; crossover: string };
  readonly stochastic?: { k: number; d: number; signal: string };
  readonly adx?: { adx: number; pdi: number; mdi: number; trendStrength: string };
  readonly cci?: { value: number; signal: string };
  readonly williamsR?: { value: number; signal: string };
  readonly roc?: { value: number; signal: string };
}

export interface TrendAnalysis {
  readonly sma?: { value: number; trend: string };
  readonly ema?: { value: number; trend: string };
  readonly ichimoku?: { tenkan: number; kijun: number; senkouA: number; senkouB: number; signal: string };
  readonly psar?: { value: number; trend: string };
}

export interface VolatilityAnalysis {
  readonly bollingerBands?: { upper: number; middle: number; lower: number; percentB: number; signal: string };
  readonly atr?: { value: number; volatility: string };
  readonly keltner?: { upper: number; middle: number; lower: number; signal: string };
}

export interface VolumeAnalysis {
  readonly obv?: { value: number; trend: string };
  readonly mfi?: { value: number; signal: string };
  readonly vwap?: { value: number; position: string };
  readonly volumeProfile?: { poc: number; valueAreaHigh: number; valueAreaLow: number };
}

export interface PatternAnalysis {
  readonly candlestickPatterns?: { patterns: readonly string[]; bias: string };
  readonly swingPoints?: { latestHigh: number | null; latestLow: number | null; trend: string };
}

export interface SupportResistanceAnalysis {
  readonly pivotPoints?: {
    pivot: number;
    r1: number; r2: number; r3: number;
    s1: number; s2: number; s3: number;
  };
  readonly fibonacci?: {
    trend: string;
    levels: Record<string, number>;
    swingHigh: number;
    swingLow: number;
  };
}

export interface GetDetailedAnalysisResponse {
  readonly isin: string;
  readonly exchange: string;
  readonly range: string;
  readonly candleCount: number;
  readonly timestamp: string;
  readonly price: PriceSummary;
  readonly signal: TradingSignal;
  readonly momentum: MomentumAnalysis;
  readonly trend: TrendAnalysis;
  readonly volatility: VolatilityAnalysis;
  readonly volume: VolumeAnalysis;
  readonly patterns?: PatternAnalysis;
  readonly supportResistance?: SupportResistanceAnalysis;
}
```

## 5. Implementation Steps (TDD Red-Green-Refactor)

### Phase 1: Setup and Infrastructure

#### Step 1.1: Install Dependencies
```bash
npm install @thuantan2060/technicalindicators
```

#### Step 1.2: Create Common Candle Type
- Create `src/server/common/candle.types.ts`
- Export shared Candle interface

### Phase 2: TechnicalIndicatorsService (Pure Calculations)

#### Step 2.1: Create Request Schemas (RED)
- Write tests for schema validation
- Create `TechnicalIndicatorsService.request.ts`

#### Step 2.2: Implement TechnicalIndicatorsService (GREEN)

**Test Cases for each indicator method (~15 per indicator):**

1. **RSI** (`calculateRsi`):
   - Should return null for insufficient data (< period + 1)
   - Should calculate RSI correctly for valid data
   - Should respect custom period parameter
   - Should return value between 0 and 100
   - Should identify overbought (>70), oversold (<30), neutral conditions

2. **MACD** (`calculateMacd`):
   - Should return null for insufficient data
   - Should calculate MACD, signal, and histogram
   - Should respect custom fast/slow/signal periods
   - Should identify bullish/bearish crossovers

3. **SMA** (`calculateSma`):
   - Should return null for insufficient data
   - Should calculate correctly for exact period
   - Should respect custom period parameter

4. **EMA** (`calculateEma`):
   - Should return null for insufficient data
   - Should give more weight to recent prices
   - Should respect custom period parameter

5. **Bollinger Bands** (`calculateBollingerBands`):
   - Should return null for insufficient data
   - Should calculate upper, middle, lower bands
   - Should calculate %B correctly
   - Should respect custom period and stdDev

6. **ATR** (`calculateAtr`):
   - Should return null for insufficient data
   - Should calculate average true range correctly
   - Should interpret volatility levels

7. **Stochastic** (`calculateStochastic`):
   - Should return null for insufficient data
   - Should calculate %K and %D
   - Should interpret overbought/oversold

8. **ADX** (`calculateAdx`):
   - Should return null for insufficient data
   - Should calculate ADX, +DI, -DI
   - Should interpret trend strength

9. **OBV** (`calculateObv`):
   - Should require volume data
   - Should track volume relative to price direction

10. **VWAP** (`calculateVwap`):
    - Should calculate volume-weighted average
    - Should determine price position relative to VWAP

11. **CCI** (`calculateCci`):
    - Should return null for insufficient data
    - Should interpret overbought/oversold

12. **Williams %R** (`calculateWilliamsR`):
    - Should return value between -100 and 0
    - Should interpret overbought/oversold

13. **ROC** (`calculateRoc`):
    - Should calculate rate of change percentage
    - Should interpret bullish/bearish signals

14. **MFI** (`calculateMfi`):
    - Should return value between 0 and 100
    - Should interpret overbought/oversold

15. **PSAR** (`calculatePsar`):
    - Should calculate parabolic SAR
    - Should determine trend direction

16. **Ichimoku Cloud** (`calculateIchimokuCloud`):
    - Should require minimum 52 candles
    - Should calculate all five lines
    - Should interpret cloud signals

17. **Keltner Channels** (`calculateKeltnerChannels`):
    - Should calculate upper, middle, lower channels
    - Should interpret overbought/oversold

**Test Structure (~90-100 tests for indicators):**

```typescript
describe('TechnicalIndicatorsService', () => {
  describe('calculateRsi', () => {
    it('should return null when insufficient data', () => { /* ... */ });
    it('should calculate RSI correctly', () => { /* ... */ });
    it('should identify overbought condition', () => { /* ... */ });
    it('should identify oversold condition', () => { /* ... */ });
    // ... more tests
  });

  // Similar structure for each indicator
});
```

### Phase 3: TechnicalAnalysisService (Orchestration)

#### Step 3.1: Create Request/Response Schemas (RED)
- Write tests for `GetIndicatorsRequestSchema` validation
- Write tests for `GetDetailedAnalysisRequestSchema` validation

#### Step 3.2: Implement TechnicalAnalysisService (GREEN)

**Test Cases (~50-60 tests):**

1. **getIndicators**:
   - Should throw TradeRepublicError if MarketDataService fails
   - Should fetch candles via MarketDataService
   - Should calculate only requested indicators
   - Should return empty results for insufficient candle data
   - Should format response correctly
   - Should handle API timeout gracefully
   - Should validate indicator names

2. **getDetailedAnalysis**:
   - Should calculate all momentum indicators
   - Should calculate all trend indicators
   - Should calculate all volatility indicators
   - Should calculate all volume indicators
   - Should calculate pattern detection when enabled
   - Should calculate pivot points when enabled
   - Should calculate Fibonacci levels when enabled
   - Should aggregate signals correctly
   - Should return STRONG_BUY when score >= 50
   - Should return BUY when score >= 20
   - Should return NEUTRAL when -20 < score < 20
   - Should return SELL when score <= -20
   - Should return STRONG_SELL when score <= -50
   - Should set confidence based on indicator agreement
   - Should include reasons for signal

**Signal Aggregation Logic:**

```typescript
private calculateAggregatedSignal(results: IndicatorResults): TradingSignal {
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;
  const reasons: string[] = [];

  // Momentum signals
  if (results.momentum?.rsi) {
    totalSignals++;
    if (results.momentum.rsi.signal === 'oversold') {
      bullishSignals++;
      reasons.push('RSI oversold');
    } else if (results.momentum.rsi.signal === 'overbought') {
      bearishSignals++;
      reasons.push('RSI overbought');
    }
  }
  // ... similar for other indicators

  // Calculate score (-100 to +100)
  const score = totalSignals > 0
    ? Math.round(((bullishSignals - bearishSignals) / totalSignals) * 100)
    : 0;

  // Determine direction
  let direction: SignalDirection;
  if (score >= 50) direction = 'STRONG_BUY';
  else if (score >= 20) direction = 'BUY';
  else if (score <= -50) direction = 'STRONG_SELL';
  else if (score <= -20) direction = 'SELL';
  else direction = 'NEUTRAL';

  // Determine confidence
  const agreementRate = totalSignals > 0
    ? Math.max(bullishSignals, bearishSignals) / totalSignals
    : 0;
  const confidence: SignalConfidence =
    totalSignals < 5 ? 'LOW' :
    agreementRate >= 0.75 ? 'HIGH' :
    agreementRate >= 0.5 ? 'MEDIUM' : 'LOW';

  return { direction, score, confidence, reasons };
}
```

### Phase 4: Tool Registration

#### Step 4.1: Create TechnicalAnalysisToolRegistry (RED)
- Write tests for tool registration
- Write tests for handler integration

**Test Cases (~12 tests):**

1. `get_indicators`:
   - Should register with correct metadata
   - Should call service getIndicators method
   - Should return formatted success result
   - Should return error result on failure
   - Should validate request parameters
   - Should handle insufficient data error

2. `get_detailed_analysis`:
   - Should register with correct metadata
   - Should call service getDetailedAnalysis method
   - Should return formatted success result
   - Should return error result on failure
   - Should validate request parameters
   - Should handle insufficient data error

#### Step 4.2: Implement TechnicalAnalysisToolRegistry (GREEN)

```typescript
export class TechnicalAnalysisToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly analysisService: TechnicalAnalysisService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_indicators',
      {
        title: 'Get Technical Indicators',
        description:
          'Calculate specific technical indicators for an instrument. ' +
          'Supports 18 indicators: RSI, MACD, SMA, EMA, Bollinger Bands, ATR, ' +
          'Stochastic, ADX, OBV, VWAP, CCI, Williams %R, ROC, MFI, PSAR, ' +
          'Ichimoku Cloud, Keltner Channels, and Volume Profile. ' +
          'Requires authentication.',
        inputSchema: GetIndicatorsRequestSchema.shape,
      },
      this.analysisService.getIndicators.bind(this.analysisService),
    );

    this.registerTool(
      'get_detailed_analysis',
      {
        title: 'Get Detailed Technical Analysis',
        description:
          'Get comprehensive technical analysis with aggregated trading signals. ' +
          'Calculates all indicators, candlestick patterns, pivot points, and Fibonacci levels. ' +
          'Returns a score from -100 (strong sell) to +100 (strong buy) with confidence level. ' +
          'Requires authentication.',
        inputSchema: GetDetailedAnalysisRequestSchema.shape,
      },
      this.analysisService.getDetailedAnalysis.bind(this.analysisService),
    );
  }
}
```

### Phase 5: Integration

#### Step 5.1: Update Exports
- Add exports to `src/server/services/index.ts`
- Add exports to `src/server/tools/index.ts`

#### Step 5.2: Update TradeRepublicMcpServer
- Instantiate TechnicalIndicatorsService
- Instantiate TechnicalAnalysisService with MarketDataService dependency
- Create TechnicalAnalysisToolRegistry and register

```typescript
private registerToolsForServer(server: McpServer): void {
  if (this.apiService) {
    const portfolioService = new PortfolioService(this.apiService);
    const portfolioToolRegistry = new PortfolioToolRegistry(server, portfolioService);
    portfolioToolRegistry.register();

    const marketDataService = new MarketDataService(this.apiService);
    const marketDataToolRegistry = new MarketDataToolRegistry(server, marketDataService);
    marketDataToolRegistry.register();

    const indicatorsService = new TechnicalIndicatorsService();
    const analysisService = new TechnicalAnalysisService(marketDataService, indicatorsService);
    const analysisToolRegistry = new TechnicalAnalysisToolRegistry(server, analysisService);
    analysisToolRegistry.register();
  }
}
```

### Phase 6: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

## 6. Error Handling

### Insufficient Data Errors

```typescript
export class InsufficientDataError extends Error {
  constructor(
    public readonly indicator: string,
    public readonly required: number,
    public readonly received: number,
  ) {
    super(`Insufficient data for ${indicator}: requires ${required} candles, received ${received}`);
    this.name = 'InsufficientDataError';
  }
}
```

### Error Scenarios

1. **Not Authenticated**: MarketDataService throws TradeRepublicError
2. **API Timeout**: MarketDataService throws TradeRepublicError
3. **Invalid ISIN**: MarketDataService returns error from API
4. **Insufficient Candles**: Return partial results with warnings
5. **Invalid Indicator Name**: Zod validation rejects request
6. **Missing Volume Data**: Skip volume indicators, include warning

## 7. Key Technical Details

- **Default Exchange**: LSX (from MarketDataService)
- **Time Range Mapping**: Uses existing `TimeRangeSchema` from MarketDataService
- **Minimum Candles by Indicator**:
  - RSI: period + 1 (default: 15)
  - MACD: slow period + signal period (default: 35)
  - Bollinger Bands: period (default: 20)
  - Ichimoku: span period (default: 52)
  - Most others: period (default: 14-20)
- **Pattern Detection**: Requires at least 3 candles
- **Fibonacci**: Requires detected swing points (minimum 5 candles)
- **Pivot Points**: Uses previous day's OHLC (industry standard)

## 8. Estimated Test Count

| Component | Test Count |
|-----------|------------|
| TechnicalIndicatorsService | ~90-100 |
| TechnicalAnalysisService | ~50-60 |
| TechnicalAnalysisToolRegistry | ~12 |
| Integration tests | ~10 |
| **Total** | **~162-182** |

## 9. Dependencies Summary

### Runtime Dependencies
- `@thuantan2060/technicalindicators` - Technical indicator calculations

### Internal Dependencies
- `MarketDataService` - For fetching OHLCV candle data
- `TradeRepublicApiService` (indirect) - For WebSocket communication
- Zod schemas from `MarketDataService.request.ts`

## Sources

- [technicalindicators - npm](https://www.npmjs.com/package/technicalindicators)
- [@thuantan2060/technicalindicators - npm](https://www.npmjs.com/package/@thuantan2060/technicalindicators)
- [trading-signals - npm](https://www.npmjs.com/package/trading-signals)
- [GitHub - anandanand84/technicalindicators](https://github.com/anandanand84/technicalindicators)
