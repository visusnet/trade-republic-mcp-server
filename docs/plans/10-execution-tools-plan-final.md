# Task 10: Execution Tools - Final Implementation Plan

**Status:** VERIFIED AND APPROVED
**Verification Date:** 2026-02-01
**Verifier Notes:** Combined plan is correct, complete, and implementable with TDD. No significant corrections needed.

---

## 1. Overview

Implement **OrderService** with four MCP tools for trade execution:
- `place_order` - Execute market, limit, and stop-market orders
- `get_orders` - Retrieve current and historical orders
- `modify_order` - Modify pending orders (may not be supported)
- `cancel_order` - Cancel pending orders

Uses WebSocket subscription pattern following PortfolioService and MarketDataService.

---

## 2. Verification Results

### Correctness: VERIFIED

**WebSocket Topics:**
- ✓ `simpleCreateOrder` (place_order) - Confirmed in Plan 1
- ✓ `orders` (get_orders) - Confirmed in Plan 1
- ✓ `cancelOrder` (cancel_order) - Confirmed in Plan 1
- ✓ Consistent with Trade_Republic_Connector reference (ADR-001)

**Order Types:**
- ✓ Market orders (`mode: 'market'`)
- ✓ Limit orders (`mode: 'limit'` with `limitPrice`)
- ✓ Stop-market orders (`mode: 'stopMarket'` with `stopPrice`)

**Order Expiry:**
- ✓ `gfd` (good for day) - default
- ✓ `gtd` (good till date) - requires expiryDate
- ✓ `gtc` (good till cancelled)

**API Pattern:**
- ✓ Correctly uses TradeRepublicApiService.subscribe() pattern
- ✓ Matches PortfolioService pattern: subscribe → wait for response → parse with Zod → cleanup
- ✓ Proper error handling with MESSAGE_CODE.E and MESSAGE_CODE.A

### Completeness: VERIFIED

**All 4 Tools Specified:**
1. ✓ `place_order` with full request/response schemas
2. ✓ `get_orders` with filtering (includeExecuted, includeCancelled)
3. ✓ `modify_order` with clear "NOT_SUPPORTED" fallback
4. ✓ `cancel_order` with orderId input

**All Request Schemas Complete:**
- ✓ PlaceOrderRequestSchema with refinements for conditional fields
- ✓ GetOrdersRequestSchema with optional filters
- ✓ ModifyOrderRequestSchema with optional fields
- ✓ CancelOrderRequestSchema with required orderId

**All Response Schemas Defined:**
- ✓ PlaceOrderResponse with full details
- ✓ GetOrdersResponse with array of orders
- ✓ ModifyOrderResponse (implied from pattern)
- ✓ CancelOrderResponse with status confirmation

**Error Classes:**
- ✓ OrderServiceError (base)
- ✓ OrderValidationError (extends OrderServiceError)
- ✓ InsufficientFundsError (extends OrderServiceError)
- ✓ OrderNotFoundError (extends OrderServiceError)
- ✓ OrderNotModifiableError (extends OrderServiceError)

### Consistency: VERIFIED

**File Structure:**
- ✓ Matches PortfolioService pattern exactly
  - ServiceName.ts (main implementation)
  - ServiceName.spec.ts (tests)
  - ServiceName.request.ts (request schemas)
  - ServiceName.response.ts (response schemas)
  - ServiceName.types.ts (error classes)
- ✓ ExecutionToolRegistry follows PortfolioToolRegistry pattern

**Service Pattern:**
- ✓ Constructor with `api: TradeRepublicApiService` and optional `timeoutMs`
- ✓ Public methods with proper typing
- ✓ Private `subscribeAndWait<T>()` helper (reusable pattern)
- ✓ Private `ensureAuthenticated()` validation
- ✓ Private payload builder and validator methods

**Tool Registry Pattern:**
- ✓ Extends ToolRegistry base class
- ✓ Constructor receives McpServer and service instance
- ✓ `register()` method calls `registerTool()` for each operation
- ✓ Tools use request schemas and bind service methods

**Schema Validation:**
- ✓ Uses Zod for all inputs/outputs
- ✓ Request schemas with refinements for conditional validation
- ✓ Response schemas use `.passthrough()` initially (noted for Task 12)

### Feasibility: VERIFIED (TDD READY)

**TDD Implementation Order is Sound:**

| Phase | Tests | Implementation |
|-------|-------|-----------------|
| Phase 1 | Error classes | OrderService.types.ts - 1 test |
| Phase 2 | Schema parsing | Request/response schemas - 2 tests |
| Phase 3 | placeOrder | Auth check, validation, market/limit/stopMarket, errors - ~15 tests |
| Phase 4 | getOrders | Subscription, filtering - ~8 tests |
| Phase 5 | modifyOrder | Support check or NOT_SUPPORTED - ~3 tests |
| Phase 6 | cancelOrder | Cancellation, error cases - ~8 tests |
| Phase 7 | ExecutionToolRegistry | Tool registration - ~5 tests |
| Phase 8 | Integration | Server integration - ~3 tests |
| **Total** | **~80 tests** | **Full coverage** |

Each phase follows RED-GREEN-REFACTOR cycle:
1. Write test that fails (RED)
2. Implement minimum code to pass (GREEN)
3. Refactor while keeping tests passing (REFACTOR)

**Parallelizable with Existing Services:**
- ✓ Does not conflict with PortfolioService or MarketDataService
- ✓ Can run tests independently
- ✓ Mock TradeRepublicApiService is well-established pattern

**Clear Success Criteria:**
- ✓ All 4 tools registered
- ✓ All 3 order types supported
- ✓ Buy and sell orders
- ✓ All expiry options (gfd, gtc, gtd)
- ✓ Status filtering in get_orders
- ✓ Proper error handling with specific error types
- ✓ 100% test coverage with ~80 tests
- ✓ Follows existing patterns
- ✓ All public methods have `public` modifier

---

## 3. Order Types

| Type | Mode | Required Fields |
|------|------|-----------------|
| Market | `market` | isin, size, orderType |
| Limit | `limit` | isin, size, orderType, limitPrice |
| Stop-Market | `stopMarket` | isin, size, orderType, stopPrice |

---

## 4. Order Expiry

- `gfd` - Good for day (default)
- `gtd` - Good till date (requires expiryDate)
- `gtc` - Good till cancelled

---

## 5. WebSocket Topics

| Operation | Topic |
|-----------|-------|
| Place Order | `simpleCreateOrder` |
| Get Orders | `orders` |
| Cancel Order | `cancelOrder` |

---

## 6. File Structure

```
src/server/services/
├── OrderService.ts
├── OrderService.spec.ts
├── OrderService.request.ts
├── OrderService.response.ts
└── OrderService.types.ts

src/server/tools/
├── ExecutionToolRegistry.ts
└── ExecutionToolRegistry.spec.ts
```

---

## 7. Request Schemas

### PlaceOrderRequestSchema
```typescript
z.object({
  isin: z.string().length(12),
  exchange: z.string().default('LSX').optional(),
  orderType: z.enum(['buy', 'sell']),
  mode: z.enum(['market', 'limit', 'stopMarket']),
  size: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  expiry: z.enum(['gfd', 'gtd', 'gtc']).default('gfd').optional(),
  expiryDate: z.string().optional(),
  sellFractions: z.boolean().default(false).optional(),
  warningsShown: z.array(z.string()).default([]).optional(),
})
.refine(
  (data) => data.mode !== 'limit' || data.limitPrice !== undefined,
  { message: 'limitPrice is required for limit orders' }
)
.refine(
  (data) => data.mode !== 'stopMarket' || data.stopPrice !== undefined,
  { message: 'stopPrice is required for stop-market orders' }
)
.refine(
  (data) => data.expiry !== 'gtd' || data.expiryDate !== undefined,
  { message: 'expiryDate is required for gtd expiry' }
)
```

### GetOrdersRequestSchema
```typescript
z.object({
  includeExecuted: z.boolean().default(false).optional(),
  includeCancelled: z.boolean().default(false).optional(),
})
```

### ModifyOrderRequestSchema
```typescript
z.object({
  orderId: z.string(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
})
```

### CancelOrderRequestSchema
```typescript
z.object({
  orderId: z.string(),
})
```

---

## 8. Response Schemas

### PlaceOrderResponse
- `orderId`: string
- `status`: string ('pending', 'executed', 'rejected')
- `isin`: string
- `exchange`: string
- `orderType`: 'buy' | 'sell'
- `mode`: 'market' | 'limit' | 'stopMarket'
- `size`: number
- `limitPrice`: number (optional)
- `stopPrice`: number (optional)
- `estimatedPrice`: number (optional)
- `estimatedCost`: number (optional)
- `estimatedFees`: number (optional)
- `warnings`: string[]
- `timestamp`: string (ISO 8601)

### GetOrdersResponse
- `orders`: OrderInfo[]
- `totalCount`: number
- `timestamp`: string (ISO 8601)

### ModifyOrderResponse
- `orderId`: string
- `status`: string
- `timestamp`: string (ISO 8601)

### CancelOrderResponse
- `orderId`: string
- `status`: string
- `cancelled`: boolean
- `timestamp`: string (ISO 8601)

---

## 9. Error Classes

```typescript
class OrderServiceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

class OrderValidationError extends OrderServiceError {}
class InsufficientFundsError extends OrderServiceError {}
class OrderNotFoundError extends OrderServiceError {}
class OrderNotModifiableError extends OrderServiceError {}
```

---

## 10. Service Implementation

### OrderService

```typescript
export class OrderService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = 30_000,
  ) {}

  public async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse>;
  public async getOrders(request?: GetOrdersRequest): Promise<GetOrdersResponse>;
  public async modifyOrder(request: ModifyOrderRequest): Promise<ModifyOrderResponse>;
  public async cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResponse>;

  private subscribeAndWait<T>(...): Promise<T>;
  private ensureAuthenticated(): void;
  private buildOrderPayload(request: PlaceOrderRequest): Record<string, unknown>;
  private validateOrder(request: PlaceOrderRequest): void;
}
```

### ExecutionToolRegistry

```typescript
export class ExecutionToolRegistry extends ToolRegistry {
  public register(): void {
    // Register place_order, get_orders, modify_order, cancel_order tools
  }
}
```

---

## 11. TDD Implementation Order

### Phase 1: Types and Errors (1 test)
1. Create OrderService.types.ts with error classes
   - Test: Error classes can be instantiated and have correct names

### Phase 2: Schemas (2 tests)
2. Create request schemas with refinements
   - Test: PlaceOrderRequestSchema validates correctly
3. Create response schemas
   - Test: Response schemas parse API responses

### Phase 3: placeOrder (15 tests)
4. Test auth check → Implement ensureAuthenticated()
5. Test market order → Implement buildOrderPayload + subscribeAndWait
6. Test limit order → Extend buildOrderPayload for limitPrice
7. Test stop-market order → Extend buildOrderPayload for stopPrice
8. Test order validation → Implement validateOrder
9. Test error handling → Add error mapping from API

### Phase 4: getOrders (8 tests)
10. Test subscription → Implement getOrders
11. Test filtering → Add includeExecuted/includeCancelled

### Phase 5: modifyOrder (3 tests)
12. Test if supported → Implement or throw NOT_SUPPORTED

### Phase 6: cancelOrder (8 tests)
13. Test cancellation → Implement cancelOrder

### Phase 7: Tool Registry (5 tests)
14. Test registration → Implement ExecutionToolRegistry

### Phase 8: Integration (3 tests)
15. Update exports, integrate with server

---

## 12. Important Notes

### Order Modification
Trade Republic may NOT support order modification via API. If not supported:
- `modifyOrder()` throws `OrderServiceError` with code `"NOT_SUPPORTED"`
- Users should cancel and re-place orders instead
- Clear error message instructs users on alternative approach

### Security Warning
`place_order` creates **actual live trades**. Tool description MUST include prominent WARNING.

### Response Schemas
Use `.passthrough()` initially for API compatibility. Will make strict after Task 12 (Schema Strictification).

### WebSocket Subscription Pattern
All operations follow the same pattern established by PortfolioService:
1. Check authentication with `ensureAuthenticated()`
2. Call `api.subscribe()` with topic and payload
3. Register message handler with `api.onMessage()`
4. Wait for response with MESSAGE_CODE.A (success) or MESSAGE_CODE.E (error)
5. Validate response with Zod schema
6. Cleanup subscription and handlers

---

## 13. Success Criteria

- [ ] 4 tools registered (place_order, get_orders, modify_order, cancel_order)
- [ ] 3 order types (market, limit, stop-market)
- [ ] Buy and sell orders
- [ ] Expiry options (gfd, gtc, gtd)
- [ ] Status filtering in get_orders
- [ ] Proper error handling with specific error types
- [ ] 100% test coverage (~80 tests)
- [ ] Follows existing patterns from PortfolioService and MarketDataService
- [ ] All public methods have `public` modifier
- [ ] All request/response schemas use Zod
- [ ] Clear tool descriptions with security warnings

---

## 14. Integration Notes

### With TradeRepublicApiService
- OrderService uses existing `subscribe()` and `unsubscribe()` methods
- No new methods needed in TradeRepublicApiService
- Uses same authentication check pattern

### With MCP Server
- ExecutionToolRegistry registers tools with McpServer
- Follows same registration pattern as PortfolioToolRegistry
- Tools accept Zod schema as inputSchema

### With Existing Code
- Can be implemented in parallel with other tasks
- Does not depend on RiskService or TechnicalAnalysisService
- Should be available before Task 12 (Schema Strictification)

---

## Verification Sign-off

**Plan is:** ✓ Correct ✓ Complete ✓ Consistent ✓ Feasible

**Ready for:** Implementation with TDD red-green-refactor cycle

**Estimated Effort:** ~1-2 days for full implementation with tests

**Test Coverage Target:** 100% with ~80 test cases

**Next Step:** Begin Phase 1 implementation (error classes and types)
