# Task 10: Execution Tools - Combined Implementation Plan

## 1. Overview

Implement **OrderService** with four MCP tools for trade execution:
- `place_order` - Execute market, limit, and stop-market orders
- `get_orders` - Retrieve current and historical orders
- `modify_order` - Modify pending orders (may not be supported)
- `cancel_order` - Cancel pending orders

Uses WebSocket subscription pattern following PortfolioService and MarketDataService.

## 2. Order Types

| Type | Mode | Required Fields |
|------|------|-----------------|
| Market | `market` | isin, size, orderType |
| Limit | `limit` | isin, size, orderType, limitPrice |
| Stop-Market | `stopMarket` | isin, size, orderType, stopPrice |

## 3. Order Expiry

- `gfd` - Good for day (default)
- `gtd` - Good till date (requires expiryDate)
- `gtc` - Good till cancelled

## 4. WebSocket Topics

| Operation | Topic |
|-----------|-------|
| Place Order | `simpleCreateOrder` |
| Get Orders | `orders` |
| Cancel Order | `cancelOrder` |

## 5. File Structure

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

## 6. Request Schemas

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
.refine(...) // limitPrice required for limit
.refine(...) // stopPrice required for stopMarket
.refine(...) // expiryDate required for gtd
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

## 7. Response Schemas

### PlaceOrderResponse
- orderId, status, isin, exchange, orderType, mode, size
- limitPrice, stopPrice (optional)
- estimatedPrice, estimatedCost, estimatedFees (optional)
- warnings, timestamp

### GetOrdersResponse
- orders: Array of OrderInfo
- totalCount, timestamp

### CancelOrderResponse
- orderId, status, cancelled, timestamp

## 8. Error Classes

```typescript
class OrderServiceError extends Error
class OrderValidationError extends OrderServiceError
class InsufficientFundsError extends OrderServiceError
class OrderNotFoundError extends OrderServiceError
class OrderNotModifiableError extends OrderServiceError
```

## 9. Service Implementation

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
    // place_order, get_orders, modify_order, cancel_order
  }
}
```

## 10. TDD Implementation Order

### Phase 1: Types and Errors
1. Create OrderService.types.ts with error classes

### Phase 2: Schemas
2. Create request schemas with refinements
3. Create response schemas

### Phase 3: placeOrder (RED-GREEN-REFACTOR)
4. Test auth check → Implement ensureAuthenticated
5. Test validation → Implement validateOrder
6. Test market order → Implement buildOrderPayload + subscribeAndWait
7. Test limit order → Extend buildOrderPayload
8. Test stop-market order → Extend buildOrderPayload
9. Test error handling → Add error mapping

### Phase 4: getOrders
10. Test subscription → Implement getOrders
11. Test filtering → Add includeExecuted/includeCancelled

### Phase 5: modifyOrder
12. Test if supported → Implement or throw NOT_SUPPORTED

### Phase 6: cancelOrder
13. Test cancellation → Implement cancelOrder

### Phase 7: Tool Registry
14. Test registration → Implement ExecutionToolRegistry

### Phase 8: Integration
15. Update exports, integrate with server

## 11. Important Notes

### Order Modification
Trade Republic may NOT support order modification via API. If not supported:
- modifyOrder throws OrderServiceError with code "NOT_SUPPORTED"
- Users should cancel and re-place orders instead

### Security Warning
place_order creates **actual live trades**. Tool description includes WARNING.

### Response Schemas
Use `.passthrough()` initially for API compatibility. Make strict after Task 12.

## 12. Success Criteria

- [ ] 4 tools registered (place_order, get_orders, modify_order, cancel_order)
- [ ] 3 order types (market, limit, stop-market)
- [ ] Buy and sell orders
- [ ] Expiry options (gfd, gtc, gtd)
- [ ] Status filtering in get_orders
- [ ] Proper error handling
- [ ] 100% test coverage (~70-80 tests)
- [ ] Follows existing patterns
- [ ] All public methods have `public` modifier
