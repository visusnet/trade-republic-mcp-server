---
description: Architecture rules
globs: ["src/server/**/*.ts"]
---

## Pure Calculation Services

RiskService and TechnicalIndicatorsService:
- Receive data as parameters
- Do NOT fetch data from external sources
- Return computed results only

## File Structure

```
ServiceName.ts           # Implementation
ServiceName.spec.ts      # Tests
ServiceName.request.ts   # Input schemas
ServiceName.response.ts  # Output schemas
ServiceName.types.ts     # Types, constants, errors
```

## WebSocket Pattern

Use `subscribeAndWait()` for async/await over WebSocket topics.
