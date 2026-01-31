---
description: Testing standards and TDD practices
globs: ["src/**/*.spec.ts", "src/**/*.test.ts"]
---

# Testing Rules

## 100% test coverage required

All code must have 100% test coverage. Run `npm run test:coverage` to verify.

## Follow TDD red-green-refactor

1. **RED**: Write ONE test that fails
2. **GREEN**: Write minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping tests green

Do not write implementation before tests.

## Mock external dependencies

- Mock the logger in all test files
- Mock external services (yahoo-finance2, sentiment, etc.)
- Use dependency injection to enable mocking
