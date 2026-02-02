# DISCREPANCY-010: MarketEventService Implementation Plan

## Overview

Implement `wait_for_market_event` MCP tool following coinbase-mcp-server patterns.

## Prerequisites

- Read design: `docs/plans/2026-02-02-discrepancy-010-market-event-service-design.md`
- Read rules: `.claude/rules/testing.md`, `.claude/rules/workflow.md`, `.claude/rules/architecture.md`
- Reference: `../coinbase-mcp-server/src/server/services/MarketEventService*`

## Phase 1: Types & Schemas

### Step 1.1: Create MarketEventService.types.ts

```typescript
// Enums: ConditionField, ConditionOperator, ConditionLogic
// Error class: MarketEventError
```

**TDD:**
- No tests needed for enums (they're type definitions)

### Step 1.2: Create MarketEventService.request.ts

```typescript
// Schemas: ConditionSchema, SubscriptionSchema, WaitForMarketEventRequestSchema
// Types: Condition, Subscription, WaitForMarketEventRequest
```

**TDD:**
- No tests needed for schemas (tested via service tests)

### Step 1.3: Create MarketEventService.response.ts

```typescript
// Schemas: TickerSchema, TriggeredConditionSchema,
//          MarketEventTriggeredResponseSchema, MarketEventTimeoutResponseSchema,
//          WaitForMarketEventResponseSchema
// Types: Ticker, TriggeredCondition, WaitForMarketEventResponse
```

**TDD:**
- No tests needed for schemas (tested via service tests)

## Phase 2: Service Implementation

### Step 2.1: Create MarketEventService.spec.ts (RED)

Write failing tests for:
1. `should trigger when bid price exceeds threshold (gt)`
2. `should trigger when ask price falls below threshold (lt)`
3. `should compute mid price correctly and trigger on condition`
4. `should compute spread and spreadPercent correctly`
5. `should trigger on ANY logic when one condition met`
6. `should only trigger on ALL logic when all conditions met`
7. `should monitor multiple ISINs and trigger on first match`
8. `should return timeout response when no conditions met`
9. `should detect crossAbove when price crosses threshold upward`
10. `should detect crossBelow when price crosses threshold downward`
11. `should not trigger crossAbove on first tick (no previous value)`
12. `should cleanup subscriptions after trigger`
13. `should cleanup subscriptions after timeout`
14. `should include last ticker in timeout response`

Mock:
- `TradeRepublicApiService` (subscribe, unsubscribe, onMessage, offMessage)
- Use fake timers for timeout tests

### Step 2.2: Create MarketEventService.ts (GREEN)

Implement:
1. Constructor taking `TradeRepublicApiService`
2. `waitForMarketEvent(request)` method
3. `evaluateConditions(ticker, conditions, logic, previousValues)` private method
4. `evaluateOperator(actual, operator, threshold, previous)` private method
5. `computeTicker(apiResponse)` private method - computes mid, spread, spreadPercent

### Step 2.3: Refactor

- Ensure clean separation of concerns
- Add JSDoc comments
- Verify 100% coverage

## Phase 3: Tool Registry

### Step 3.1: Create MarketEventToolRegistry.spec.ts (RED)

Write failing tests for:
1. `should register wait_for_market_event tool`
2. `should call marketEventService.waitForMarketEvent with parsed request`
3. `should return triggered response on success`
4. `should return timeout response on timeout`

### Step 3.2: Create MarketEventToolRegistry.ts (GREEN)

Implement:
1. Extend `ToolRegistry`
2. Constructor taking `McpServer` and `MarketEventService`
3. `register()` method registering `wait_for_market_event` tool

### Step 3.3: Refactor

- Ensure consistent with other tool registries
- Add tool description

## Phase 4: Integration

### Step 4.1: Update exports

- `src/server/services/index.ts` - export MarketEventService and schemas
- `src/server/tools/index.ts` - export MarketEventToolRegistry

### Step 4.2: Update TradeRepublicMcpServer.ts

- Instantiate `MarketEventService` (requires `TradeRepublicApiService`)
- Instantiate `MarketEventToolRegistry`
- Call `marketEventToolRegistry.register()`

### Step 4.3: Update TradeRepublicMcpServer.spec.ts

- Add tests for market event tool registration

## Phase 5: Verification

Run full verification pipeline:
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

All checks must pass with 100% coverage.

## Notes

- Use fake timers for all timeout-related tests
- Spy on logger to suppress output
- Follow existing patterns from MarketDataService for WebSocket subscription handling
- Mirror coinbase-mcp-server naming and patterns where applicable
