# Task 10: Execution Tools - Implementation Plan (Agent 2)

## Overview

Implement **OrderService** with four MCP tools:
- `place_order` - Execute market, limit, and stop-market orders
- `get_orders` - Retrieve current and historical orders
- `modify_order` - Modify pending orders
- `cancel_order` - Cancel pending orders

## Order Types

1. **Market Orders**: Execute immediately at current market price
2. **Limit Orders**: Execute only at specified price or better
3. **Stop-Market Orders**: Convert to market order when stop price reached

## Key Parameters

- `orderType`: "buy" or "sell"
- `size`: Number of shares (supports fractional)
- `sellFractions`: Boolean for selling fractional shares
- `expiry`: gfd, gtd, gtc
- `expiryDate`: Required for gtd (yyyy-mm-dd format)

## File Structure

```
src/server/services/
├── OrderService.ts
├── OrderService.request.ts
├── OrderService.response.ts
├── OrderService.types.ts
└── OrderService.spec.ts

src/server/tools/
├── OrderToolRegistry.ts
└── OrderToolRegistry.spec.ts
```

## Error Classes

```typescript
class OrderServiceError extends Error
class InsufficientFundsError extends OrderServiceError
class InvalidOrderError extends OrderServiceError
class OrderNotFoundError extends OrderServiceError
class OrderNotModifiableError extends OrderServiceError
```

## Request Schemas

### PlaceOrderRequest
- isin, exchange (default: LSX)
- orderType: buy | sell
- orderKind: market | limit | stop_market
- size: positive number
- limitPrice: required for limit
- stopPrice: required for stop_market
- expiry: gfd | gtd | gtc
- expiryDate: required for gtd
- sellFractions: boolean (sell only)

### GetOrdersRequest
- status: pending | executed | cancelled | all

### ModifyOrderRequest
- orderId
- size, limitPrice, stopPrice, expiry, expiryDate (all optional)

### CancelOrderRequest
- orderId

## TDD Test Cases (~60 tests)

### Phase 1-2: Authentication & Market Orders
- Auth checks, market buy/sell, validation

### Phase 3-4: Limit & Stop-Market Orders
- Limit price required, stop price required

### Phase 5: Expiry Options
- gfd, gtc, gtd with date

### Phase 6-8: Get/Modify/Cancel
- Status filtering, modifications, cancellation

### Phase 9-10: Errors & Payloads
- Error handling, payload building

## Security Warning

The `place_order` tool creates **actual live trades**. Tool description includes WARNING.

## Success Criteria

- 4 tools registered
- 3 order types (market, limit, stop-market)
- Buy and sell support
- Expiry options implemented
- 100% test coverage
- Follows existing patterns
