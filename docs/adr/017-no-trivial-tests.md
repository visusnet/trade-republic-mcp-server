# ADR-017: Testing Rules - No Trivial Tests

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

100% test coverage is required, but coverage alone doesn't guarantee quality. Tests like `expect(x).toBeDefined()` provide coverage but no value.

## Problem

How should test quality be ensured alongside coverage requirements?

## Decision

**Tests must verify behavior, not just existence.**

### Anti-Pattern: Trivial Tests

```typescript
// BAD - Provides coverage but no value
it('should create service', () => {
  expect(service).toBeDefined();
});

it('should have calculate method', () => {
  expect(service.calculate).toBeDefined();
});

it('should return something', () => {
  const result = service.calculate(input);
  expect(result).toBeDefined();
});
```

### Correct Pattern: Behavioral Tests

```typescript
// GOOD - Verifies actual behavior
it('should calculate VaR at 95% confidence', () => {
  const returns = [-0.02, 0.01, -0.01, 0.02, -0.03];
  const vaR = service.calculateVaR(returns, 0.95);
  expect(vaR).toBeCloseTo(-0.0329, 4);
});

it('should throw for empty returns array', () => {
  expect(() => service.calculateVaR([], 0.95))
    .toThrow('Returns array cannot be empty');
});

it('should handle edge case of single return', () => {
  const returns = [-0.01];
  const vaR = service.calculateVaR(returns, 0.95);
  expect(vaR).toBe(-0.01);
});
```

## Test Quality Checklist

Each test should:
- [ ] Assert a meaningful outcome (correct return value)
- [ ] Verify proper error handling (throws expected error)
- [ ] Test edge cases (empty arrays, boundaries)
- [ ] Document expected behavior (readable test name)
- [ ] Catch real bugs (would fail if implementation wrong)

## Rationale

- Coverage without value gives false confidence
- Tests should catch bugs, not just existence
- Behavioral tests document how code should work
- Trivial tests waste maintenance effort
- Good tests enable safe refactoring

## Enforcement

This rule is enforced through code review. When reviewing tests, verify:
1. No `toBeDefined()` as the only assertion
2. Tests verify actual behavior
3. Edge cases are covered
4. Error handling is tested

## Consequences

### Positive
- Tests that actually catch bugs
- Documentation through tests
- Confidence in refactoring
- Better test maintainability

### Negative
- Takes more thought to write tests
- May need multiple assertions per behavior
- Requires understanding expected behavior

## References

- ADR-016: TDD with Red-Green-Refactor Cycle
- .claude/rules/testing.md
