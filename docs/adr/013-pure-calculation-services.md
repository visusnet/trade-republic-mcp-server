# ADR-013: Pure Calculation Services

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Services like RiskService and TechnicalIndicatorsService perform calculations on market data. They could either fetch their own data or receive data as input.

## Problem

Should calculation services fetch their own data or receive data as input?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Services fetch their own data | Convenient API, single call | Tight coupling, harder to test |
| Services receive data as input | Decoupled, testable, reusable | Caller must provide data |

## Decision

**RiskService and TechnicalIndicatorsService are pure calculation services.**

They receive data (prices, returns) as input and return calculations. They do NOT fetch data from external sources or other services.

## Implementation Pattern

```typescript
// BAD: Service fetches its own data
class RiskService {
  constructor(private marketDataService: MarketDataService) {}

  async calculateVaR(symbol: string): Promise<number> {
    const prices = await this.marketDataService.getHistory(symbol);
    return this.computeVaR(prices);
  }
}

// GOOD: Pure calculation service
class RiskService {
  calculateVaR(returns: number[], confidence: number): number {
    // Pure calculation, no external dependencies
    return computeVaR(returns, confidence);
  }
}
```

## Rationale

- **Separation of concerns**: Data fetching vs. calculation are different responsibilities
- **Easier to test**: Can test with known inputs, no mocking required
- **Reusable**: Can be used with data from any source (TR, Yahoo, backtesting)
- **YAGNI**: Avoids unnecessary dependencies and coupling
- **Single responsibility**: Each service does one thing well

## Consequences

### Positive
- Services are trivially testable
- No mock complexity in tests
- Can use same calculations for live trading and backtesting
- Clear contracts (input → output)

### Negative
- Caller must provide data (more orchestration code)
- Cannot make decisions about data freshness
- May require more parameters than fetching approach

## Affected Services

| Service | Input | Output |
|---------|-------|--------|
| RiskService | Returns array, parameters | VaR, Sharpe, Kelly, etc. |
| TechnicalIndicatorsService | OHLCV data | RSI, MACD, Bollinger, etc. |

## References

- RiskService implementation
- TechnicalIndicatorsService implementation
- ADR-016: TDD with Red-Green-Refactor Cycle
