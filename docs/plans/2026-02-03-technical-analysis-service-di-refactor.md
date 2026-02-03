# TechnicalAnalysisService Dependency Injection Refactor

## Goal

Remove `eslint-disable @typescript-eslint/no-non-null-assertion` from TechnicalAnalysisService.spec.ts by:
1. Making TechnicalIndicatorsService injectable (following Coinbase pattern)
2. Restructuring tests to use mocked indicators service
3. Using optional chaining instead of non-null assertions

## Changes

### 1. TechnicalAnalysisService.ts

Change constructor from:
```typescript
constructor(private readonly marketDataService: MarketDataService) {
  this.indicatorsService = new TechnicalIndicatorsService();
}
```

To:
```typescript
constructor(
  private readonly marketDataService: MarketDataService,
  private readonly indicatorsService: TechnicalIndicatorsService,
) {}
```

Remove the internal instantiation - require both params (Coinbase pattern).

### 2. TradeRepublicMcpServer.ts

Change from:
```typescript
this.technicalAnalysisService = new TechnicalAnalysisService(
  this.marketDataService,
);
```

To:
```typescript
this.technicalIndicatorsService = new TechnicalIndicatorsService();
this.technicalAnalysisService = new TechnicalAnalysisService(
  this.marketDataService,
  this.technicalIndicatorsService,
);
```

Add `technicalIndicatorsService` as a private field.

### 3. TechnicalAnalysisService.spec.ts

Full restructure following Coinbase pattern:

**a) Standalone mocks at module level:**
```typescript
const getPriceHistoryMock = jest.fn<MarketDataService['getPriceHistory']>();
const calculateRSIMock = jest.fn<TechnicalIndicatorsService['calculateRSI']>();
const calculateMACDMock = jest.fn<TechnicalIndicatorsService['calculateMACD']>();
const calculateBollingerBandsMock = jest.fn<TechnicalIndicatorsService['calculateBollingerBands']>();
const calculateStochasticMock = jest.fn<TechnicalIndicatorsService['calculateStochastic']>();
const calculateADXMock = jest.fn<TechnicalIndicatorsService['calculateADX']>();
const calculateATRMock = jest.fn<TechnicalIndicatorsService['calculateATR']>();
const calculateSMAMock = jest.fn<TechnicalIndicatorsService['calculateSMA']>();
const calculateEMAMock = jest.fn<TechnicalIndicatorsService['calculateEMA']>();
const calculateOBVMock = jest.fn<TechnicalIndicatorsService['calculateOBV']>();
const calculateVWAPMock = jest.fn<TechnicalIndicatorsService['calculateVWAP']>();
```

**b) Build mock objects in beforeEach:**
```typescript
beforeEach(() => {
  jest.clearAllMocks();

  mockMarketDataService = {
    getPriceHistory: getPriceHistoryMock,
  } as never;

  mockIndicatorsService = {
    calculateRSI: calculateRSIMock,
    calculateMACD: calculateMACDMock,
    calculateBollingerBands: calculateBollingerBandsMock,
    calculateStochastic: calculateStochasticMock,
    calculateADX: calculateADXMock,
    calculateATR: calculateATRMock,
    calculateSMA: calculateSMAMock,
    calculateEMA: calculateEMAMock,
    calculateOBV: calculateOBVMock,
    calculateVWAP: calculateVWAPMock,
  } as never;

  service = new TechnicalAnalysisService(
    mockMarketDataService,
    mockIndicatorsService,
  );
});
```

**c) Replace non-null assertions with optional chaining:**

Before:
```typescript
expect(result.indicators[0].components!.macd).toBeDefined();
```

After:
```typescript
expect(result.indicators[0].components?.macd).toBe(1.5);
```

**d) Replace find() + ! with direct checks:**

Before:
```typescript
const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
expect(rsiSignal!.signal).toBe('buy');
```

After:
```typescript
expect(result.signals).toContainEqual({
  indicator: 'RSI',
  signal: 'buy',
  strength: 'strong',
  reason: expect.any(String),
});
```

Or with optional chaining:
```typescript
const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
expect(rsiSignal?.signal).toBe('buy');
```

## Verification

After implementation:
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

- All tests pass
- 100% coverage
- No eslint-disable comments in TechnicalAnalysisService.spec.ts
