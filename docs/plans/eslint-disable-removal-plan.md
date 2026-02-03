# ESLint Disable Removal Plan

## Overview

The codebase has many `eslint-disable` comments which is bad practice. Coinbase-mcp-server has ZERO eslint-disable comments. This document lists all issues and how to fix them following coinbase-mcp-server patterns.

## Important Guidelines

1. **Don't remove expectations on data** - Tests must still verify important values
2. **Don't make tests worthless** - Ensure assertions are meaningful
3. **Never test private methods or fields** - Restructure to test through public API
4. **Look at coinbase-mcp-server** for the correct patterns

---

## Category 1: `@typescript-eslint/unbound-method`

**Problem**: Accessing mock methods directly causes unbound-method errors.

**Coinbase Solution**: Define mocks as standalone typed `jest.fn<ServiceType['method']>()` variables, then build mock objects from them.

**Example from coinbase-mcp-server/src/server/services/TechnicalAnalysisService.spec.ts**:
```typescript
// Define typed standalone mock functions
const getProductCandlesMock = jest.fn<ProductsService['getProductCandles']>();
const calculateRsiMock = jest.fn<TechnicalIndicatorsService['calculateRsi']>();

// Build mock object from standalone functions
mockProductsService = {
  getProductCandles: getProductCandlesMock,
} as never;

// Use the standalone mock directly (not mockProductsService.getProductCandles)
calculateRsiMock.mockReturnValue({ value: 50, period: 14 });
expect(getProductCandlesMock).toHaveBeenCalledWith(...);
```

**Files to fix**:
1. `src/server/services/TradeRepublicApiService.websocket.spec.ts` (line 1)
2. `src/server/services/OrderService.spec.ts` (line 1)
3. `src/server/services/FundamentalsService.spec.ts` (line 1)
4. `src/server/services/NewsService.spec.ts` (line 1)
5. `src/server/services/MarketDataService.spec.ts` (line 1)
6. `src/server/services/TechnicalAnalysisService.spec.ts` (line 2)
7. `src/server/services/PortfolioService.spec.ts` (line 1)
8. `src/server/services/SentimentService.spec.ts` (line 1)
9. `src/server/services/TradeRepublicApiService.spec.ts` (line 1)
10. `src/server/tools/MarketEventToolRegistry.spec.ts` (line 2)
11. `src/server/tools/ExecutionToolRegistry.spec.ts` (line 2)
12. `src/server/tools/ExternalDataToolRegistry.spec.ts` (line 2)
13. `src/server/tools/AuthToolRegistry.spec.ts` (line 2)
14. `src/server/tools/RiskManagementToolRegistry.spec.ts` (line 1)
15. `src/server/tools/TechnicalAnalysisToolRegistry.spec.ts` (line 2)
16. `src/server/tools/MarketDataToolRegistry.spec.ts` (line 2)
17. `src/server/tools/PortfolioToolRegistry.spec.ts` (line 2)

---

## Category 2: `@typescript-eslint/no-non-null-assertion`

**Problem**: Using `!` to assert non-null values.

**Coinbase Solution**: Restructure assertions to avoid needing non-null assertions. Don't use conditional expects (which is also forbidden). Instead, structure data and tests so values are guaranteed.

**Example patterns from coinbase**:
```typescript
// BAD: conditional expect
if (result.value !== null) {
  expect(result.value).toBe(expected);
}

// BAD: non-null assertion
expect(result.value!).toBe(expected);

// GOOD: Assert the structure first, then access
expect(result.value).toBeDefined();
expect(result.value).toBe(expected);

// GOOD: Compare with expected data
expect(result).toEqual(expectedData);

// GOOD: Use mock data that guarantees non-null
const mockData = { value: 50 }; // Always has value
mockService.mockReturnValue(mockData);
const result = await service.method();
expect(result.value).toBe(50); // Guaranteed by mock
```

**Files to fix**:
1. `src/server/services/TradeRepublicApiService.ts` (line 254) - resubscribeAll uses `!`
2. `src/server/services/TechnicalIndicatorsService.spec.ts` (line 1)
3. `src/server/tools/MarketEventToolRegistry.spec.ts` (line 1)
4. `src/server/services/MarketEventService.spec.ts` (line 303)
5. `src/server/services/TechnicalAnalysisService.spec.ts` (line 1)
6. `src/server/tools/ExecutionToolRegistry.spec.ts` (line 1)
7. `src/server/tools/ExternalDataToolRegistry.spec.ts` (line 1)
8. `src/server/tools/AuthToolRegistry.spec.ts` (line 1)
9. `src/server/tools/TechnicalAnalysisToolRegistry.spec.ts` (line 1)
10. `src/server/tools/MarketDataToolRegistry.spec.ts` (line 1)
11. `src/server/tools/PortfolioToolRegistry.spec.ts` (line 1)
12. `src/server/services/TradeRepublicApiService.spec.ts` (line 1336)
13. `src/server/services/TradeRepublicApiService.websocket.ts` (line 215) - resubscribeAll uses `!`

---

## Category 3: `@typescript-eslint/no-explicit-any` + `no-unsafe-*` (Testing Private Members)

**Problem**: Tests access private members via `(service as any).privateField`.

**Coinbase Solution**: NEVER test private methods or fields. Instead:
1. Test behavior through public API only
2. If you need to inject mocks, pass them through constructor (dependency injection)
3. If a private method needs testing, it probably should be extracted to a separate testable class

**Current bad pattern in TechnicalAnalysisService.spec.ts**:
```typescript
// BAD: accessing private indicatorsService
const indicatorsService = (service as any).indicatorsService;
const rsiSpy = jest.spyOn(indicatorsService, 'calculateRSI');
```

**Coinbase pattern**:
```typescript
// GOOD: inject mock via constructor, use standalone mock functions
const calculateRsiMock = jest.fn<TechnicalIndicatorsService['calculateRsi']>();
const mockIndicatorsService = { calculateRsi: calculateRsiMock } as never;
const service = new TechnicalAnalysisService(mockMarketData, mockIndicatorsService);

// Then use the standalone mock
calculateRsiMock.mockReturnValue({ value: 15, period: 14 });
```

**Files to fix**:
1. `src/server/services/TechnicalAnalysisService.spec.ts` (lines 1549, 1584, 1619, 1918, 1945, 1972, 1999, 2026)
2. `src/server/tools/RiskManagementToolRegistry.spec.ts` (lines 3-6)

**Action**: TechnicalAnalysisService already takes indicatorsService in constructor. Refactor tests to:
1. Create standalone mock functions for each indicator method
2. Build mockIndicatorsService from these standalone mocks
3. Pass mockIndicatorsService to constructor
4. Use standalone mocks directly instead of spying on private field

---

## Category 4: `jest/no-conditional-expect`

**Problem**: Tests use conditional logic around expectations, which can silently skip assertions.

**Coinbase Solution**: Restructure tests so assertions are unconditional. Use mock data that guarantees the conditions you want to test.

**Current bad pattern**:
```typescript
// BAD: may skip assertion if condition not met
if (result.indicators.rsi !== null && result.indicators.rsi < 20) {
  expect(rsiSignals[0].strength).toBe('strong');
}
```

**Coinbase pattern**:
```typescript
// GOOD: mock guarantees the condition
calculateRsiMock.mockReturnValue({ value: 15, period: 14 }); // RSI < 20 guaranteed
const result = await service.getDetailedAnalysis({ isin: 'TEST' });
expect(result.signals[0].strength).toBe('strong'); // Always executes
```

**Files to fix**:
1. `src/server/services/TechnicalIndicatorsService.spec.ts` (line 2)
2. `src/server/services/TechnicalAnalysisService.spec.ts` (line 3)

---

## Category 5: `@typescript-eslint/no-deprecated` + `@typescript-eslint/await-thenable`

**Problem**: Using deprecated yahoo-finance2 API methods.

**Solution**: The yahoo-finance2 library has alternatives documented next to @deprecated tags in its code. Find and use the non-deprecated alternatives.

**Files to fix**:
1. `src/server/services/FundamentalsService.ts` (line 77)
2. `src/server/services/NewsService.ts` (line 65)
3. `src/server/services/SymbolMapper.ts` (line 56)

**Action**: Check yahoo-finance2 source code for each deprecated method and use the recommended alternative.

---

## Category 6: `@typescript-eslint/no-unused-vars`

**Problem**: Unused variables in type files.

**Solution**: There should be no unused vars ever. Remove them or use them.

**Files to fix**:
1. `src/server/services/RiskService.types.ts` (line 41)
2. `src/server/services/TechnicalAnalysisService.types.ts` (line 7)

**Action**: Check what variables are unused and either remove them or ensure they're used.

---

## Category 7: Other One-off Issues

1. `src/server/tools/ExternalDataToolRegistry.spec.ts` (line 3) - `@typescript-eslint/no-confusing-void-expression`
2. `src/server/tools/TechnicalAnalysisToolRegistry.spec.ts` (line 3) - `@typescript-eslint/no-confusing-void-expression`
3. `src/server/services/TradeRepublicApiService.crypto.spec.ts` (line 69) - `@typescript-eslint/no-invalid-void-type`
4. `src/server/services/TradeRepublicApiService.spec.ts` (line 1365) - `@typescript-eslint/only-throw-error`
5. `src/server/services/TradeRepublicApiService.websocket.ts` (line 319) - `@typescript-eslint/no-unused-vars`

---

## Execution Order

Fix in this order to minimize conflicts:

1. **Category 6** (unused vars in types) - Quick wins
2. **Category 5** (deprecated APIs) - Independent of tests
3. **Category 7** (one-off issues) - Small fixes
4. **Category 1** (unbound-method) - Restructure mock pattern across all test files
5. **Category 3** (private member testing) - After Category 1, since both affect same files
6. **Category 2** (non-null assertions) - After mock restructuring
7. **Category 4** (conditional expects) - Final cleanup

---

## Verification

After each category, run:
```bash
npm run test:types && npm run lint && npm run test:coverage
```

All must pass with 100% coverage before proceeding to next category.


---

## Ensure this never happens again

1. Add ESLint rules to `eslint.config.js` to forbid `eslint-disable` comments.
2. Add ESLint rules to forbid `istanbul ignore` comments.
3. Write a rule file in .claude/rules/ that forbid both eslint-disable and istanbul ignore comments of any kind in the codebase while giving examples of correct usage.