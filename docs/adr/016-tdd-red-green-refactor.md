# ADR-016: TDD with Red-Green-Refactor Cycle

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

This is a financial application where correctness is critical. Bugs could result in financial losses.

## Problem

How should code quality and correctness be ensured?

## Decision

**Strict TDD red-green-refactor for all implementation.**

### The Cycle

1. **RED**: Write ONE failing test
   - Test should fail for the right reason
   - Test should be minimal and focused

2. **GREEN**: Write minimum code to pass
   - Only write enough code to make the test pass
   - Don't add features not tested

3. **REFACTOR**: Clean up while keeping tests green
   - Remove duplication
   - Improve naming
   - Extract functions/classes
   - All tests must stay green

### Coverage Requirement

**100% test coverage is required.**

The Jest configuration enforces:
```javascript
coverageThreshold: {
  global: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100,
  },
}
```

## Rationale

- Financial code requires high correctness confidence
- Tests document expected behavior
- Prevents over-engineering (write only what's needed)
- 100% coverage is achievable with TDD
- Catches regressions immediately

## Example Workflow

```typescript
// 1. RED - Write failing test
describe('RiskService', () => {
  it('should calculate VaR at 95% confidence', () => {
    const returns = [-0.02, 0.01, -0.01, 0.02, -0.03];
    expect(riskService.calculateVaR(returns, 0.95)).toBeCloseTo(-0.0329);
  });
});

// 2. GREEN - Minimum code to pass
calculateVaR(returns: number[], confidence: number): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);
  return sorted[index];
}

// 3. REFACTOR - Improve while green
calculateVaR(returns: number[], confidence: number): number {
  const sortedReturns = this.sortAscending(returns);
  const tailIndex = this.calculateTailIndex(returns.length, confidence);
  return sortedReturns[tailIndex];
}
```

## Consequences

### Positive
- High confidence in correctness
- Tests serve as documentation
- Safe refactoring
- Catches bugs early
- Forces clean design

### Negative
- Initial development overhead
- Requires discipline
- May feel slow at first
- Need to write good tests (not just coverage)

## References

- ADR-017: Testing Rules - No Trivial Tests
- CLAUDE.md workflow specification
