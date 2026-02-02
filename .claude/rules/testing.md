---
description: Testing rules
globs: ["src/**/*.spec.ts"]
---

## 100% Coverage Required

Run `npm run test:coverage` to verify.

## TDD Red-Green-Refactor

1. RED: Write failing test
2. GREEN: Minimum code to pass
3. REFACTOR: Clean up, keep tests green

## No Trivial Tests

- `toBeDefined()` alone is NOT acceptable
- Tests must verify behavior, not existence

**Bad:** `expect(service).toBeDefined()`
**Good:** `expect(service.calculate(input)).toBe(expectedOutput)`

## No Log Output During Tests

Tests must not produce console output. For tests that verify logging:
1. Spy on the logger: `jest.spyOn(logger.api, 'warn')`
2. Assert the call: `expect(logger.api.warn).toHaveBeenCalledWith(...)`

The spy automatically suppresses output while allowing assertions.
