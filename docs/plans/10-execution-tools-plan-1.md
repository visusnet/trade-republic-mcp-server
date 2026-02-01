# Task 10: Execution Tools - Implementation Plan (Agent 1)

## Overview

Implement four execution tools for order management on Trade Republic:
- `place_order` - Place market, limit, or stop-market orders
- `get_orders` - Retrieve current and historical orders
- `modify_order` - Modify existing open orders (if supported)
- `cancel_order` - Cancel pending orders

Based on pytr research, Trade Republic uses WebSocket topics for order operations.

## WebSocket Topics

| Operation | Topic | Payload |
|-----------|-------|---------|
| Place Order | `simpleCreateOrder` | `{ type, clientProcessId, warningsShown, parameters }` |
| Get Orders | `orders` | `{ type: "orders" }` |
| Cancel Order | `cancelOrder` | `{ type: "cancelOrder", orderId }` |

## Order Types Supported

1. **Market Order** - `mode: "market"` - Executes at current market price
2. **Limit Order** - `mode: "limit"` - Executes at specified price or better
3. **Stop-Market Order** - `mode: "stopMarket"` - Triggers market order when stop price reached

## Order Expiry Types

- `gfd` - Good for day (expires at market close)
- `gtd` - Good till date (requires expiry date)
- `gtc` - Good till cancelled (indefinite)

## File Structure

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

## Key Schemas

### PlaceOrderRequest
- isin: ISIN (12 chars)
- exchange: Exchange (default: LSX)
- orderType: buy | sell
- mode: market | limit | stopMarket
- size: Positive number
- limitPrice: Required for limit orders
- stopPrice: Required for stop-market orders
- expiry: gfd | gtd | gtc
- expiryDate: Required for gtd
- sellFractions: Boolean for fractional shares
- warningsShown: Array of acknowledged warnings

## TDD Test Cases (~80 tests)

### placeOrder (~25 tests)
- Authentication checks
- Parameter validation
- Market/limit/stop-market orders
- Error handling (insufficient funds, timeout)

### getOrders (~12 tests)
- Filter by status
- Empty list handling
- Error handling

### modifyOrder (~10 tests)
- Modify price/expiry
- OR throw "Not supported" if TR doesn't support

### cancelOrder (~10 tests)
- Cancel pending orders
- Error handling

## Error Classes

- OrderServiceError - General errors
- OrderValidationError - Invalid parameters
- InsufficientFundsError - Not enough funds

## Integration

OrderService uses TradeRepublicApiService.subscribe() pattern:
1. Subscribe to topic with payload
2. Wait for response (MESSAGE_CODE.A) or error (MESSAGE_CODE.E)
3. Parse response with Zod schema
4. Cleanup subscription

## Note on Order Modification

Trade Republic may not support order modification. If not supported, modifyOrder will throw "NOT_SUPPORTED" error and users should cancel/re-place orders.
