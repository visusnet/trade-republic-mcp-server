# DISCREPANCY-010: MarketEventService Design

## Problem

ADR-009 requires event-driven triggers but the skill only operates on polling-based loops. Implement `wait_for_market_event` following the coinbase-mcp-server pattern.

## Decision Summary

| Question | Decision |
|----------|----------|
| Condition fields | bid, ask, mid, last, spread, spreadPercent |
| Operators | gt, gte, lt, lte, crossAbove, crossBelow |
| Condition logic | Configurable: 'any' (OR) or 'all' (AND) |
| Multiple ISINs | Yes, up to 5 |
| Timeout | Default 55 seconds (avoids MCP timeout) |
| Architecture | New MarketEventService (mirrors coinbase-mcp-server) |

## Schema Design

### Enums

```typescript
enum ConditionField {
  BID = 'bid',
  ASK = 'ask',
  MID = 'mid',
  LAST = 'last',
  SPREAD = 'spread',
  SPREAD_PERCENT = 'spreadPercent',
}

enum ConditionOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  CROSS_ABOVE = 'crossAbove',
  CROSS_BELOW = 'crossBelow',
}

enum ConditionLogic {
  ANY = 'any',
  ALL = 'all',
}
```

### Request Schema

```typescript
const ConditionSchema = z.object({
  field: z.nativeEnum(ConditionField),
  operator: z.nativeEnum(ConditionOperator),
  value: z.number(),
});

const SubscriptionSchema = z.object({
  isin: z.string(),
  exchange: z.string().optional(),  // defaults to LSX
  conditions: z.array(ConditionSchema).min(1).max(5),
  logic: z.nativeEnum(ConditionLogic).default(ConditionLogic.ANY),
});

const WaitForMarketEventRequestSchema = z.object({
  subscriptions: z.array(SubscriptionSchema).min(1).max(5),
  timeout: z.number().min(1).max(55).default(55),
});
```

### Response Schema

```typescript
const TickerSchema = z.object({
  bid: z.number(),
  ask: z.number(),
  mid: z.number(),
  last: z.number().optional(),
  spread: z.number(),
  spreadPercent: z.number(),
});

const TriggeredConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  threshold: z.number(),
  actualValue: z.number(),
});

const MarketEventTriggeredResponseSchema = z.object({
  status: z.literal('triggered'),
  isin: z.string(),
  exchange: z.string(),
  triggeredConditions: z.array(TriggeredConditionSchema),
  ticker: TickerSchema,
  timestamp: z.string(),
});

const MarketEventTimeoutResponseSchema = z.object({
  status: z.literal('timeout'),
  lastTickers: z.record(z.string(), TickerSchema),
  duration: z.number(),
  timestamp: z.string(),
});

const WaitForMarketEventResponseSchema = z.discriminatedUnion('status', [
  MarketEventTriggeredResponseSchema,
  MarketEventTimeoutResponseSchema,
]);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ MarketEventToolRegistry (new)                                │
│   └─ wait_for_market_event tool                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ MarketEventService (new)                                     │
│   └─ waitForMarketEvent(request): Promise<Response>         │
│       ├─ Subscribe to ticker for each ISIN                  │
│       ├─ On each update: evaluate conditions                │
│       ├─ Track previous values for crossAbove/crossBelow    │
│       └─ Return on trigger OR timeout                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TradeRepublicApiService (existing)                          │
│   ├─ subscribe(topic, payload) → subscriptionId             │
│   ├─ onMessage(handler)                                     │
│   └─ unsubscribe(subscriptionId)                            │
└─────────────────────────────────────────────────────────────┘
```

## Core Logic

```typescript
class MarketEventService {
  constructor(private readonly api: TradeRepublicApiService) {}

  public async waitForMarketEvent(
    request: WaitForMarketEventRequest
  ): Promise<WaitForMarketEventResponse> {
    return new Promise((resolve) => {
      const lastTickers = new Map<string, Ticker>();
      const previousValues = new Map<string, Map<ConditionField, number>>();
      const subscriptionIds: number[] = [];

      // Timeout handler
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          status: 'timeout',
          lastTickers: Object.fromEntries(lastTickers),
          duration: request.timeout,
          timestamp: new Date().toISOString(),
        });
      }, request.timeout * 1000);

      // Message handler
      const messageHandler = (msg: WebSocketMessage) => {
        // Parse ticker, compute fields, evaluate conditions
        // If triggered: cleanup() and resolve with triggered response
      };

      // Subscribe to all ISINs
      for (const sub of request.subscriptions) {
        const tickerId = `${sub.isin}.${sub.exchange ?? 'LSX'}`;
        const subId = this.api.subscribe('ticker', { id: tickerId });
        subscriptionIds.push(subId);
      }

      this.api.onMessage(messageHandler);

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.api.offMessage(messageHandler);
        subscriptionIds.forEach(id => this.api.unsubscribe(id));
      };
    });
  }

  private evaluateConditions(
    ticker: Ticker,
    conditions: Condition[],
    logic: ConditionLogic,
    previousValues?: Map<ConditionField, number>
  ): TriggeredCondition[] {
    // Evaluate each condition, return triggered ones based on logic
  }

  private evaluateOperator(
    actual: number,
    operator: ConditionOperator,
    threshold: number,
    previous?: number
  ): boolean {
    switch (operator) {
      case 'gt': return actual > threshold;
      case 'gte': return actual >= threshold;
      case 'lt': return actual < threshold;
      case 'lte': return actual <= threshold;
      case 'crossAbove':
        return previous !== undefined && previous <= threshold && actual > threshold;
      case 'crossBelow':
        return previous !== undefined && previous >= threshold && actual < threshold;
    }
  }
}
```

## Files to Create

```
src/server/services/
├── MarketEventService.ts
├── MarketEventService.spec.ts
├── MarketEventService.types.ts
├── MarketEventService.request.ts
└── MarketEventService.response.ts

src/server/tools/
├── MarketEventToolRegistry.ts
└── MarketEventToolRegistry.spec.ts
```

## Files to Modify

- `src/server/services/index.ts` - export new service
- `src/server/tools/index.ts` - export new registry
- `src/server/TradeRepublicMcpServer.ts` - instantiate and register

## Test Cases

1. Basic trigger - single ISIN, price crosses threshold
2. Multiple conditions OR - triggers when any condition met
3. Multiple conditions AND - triggers only when all conditions met
4. Multiple ISINs - monitors 3 ISINs, triggers on first match
5. Timeout - returns timeout with last tickers
6. crossAbove - detects upward crossing
7. crossBelow - detects downward crossing
8. crossAbove/Below on first tick - doesn't trigger (no previous)
9. Calculated fields - mid, spread, spreadPercent computed correctly
10. Cleanup on trigger - unsubscribes from all topics
11. Cleanup on timeout - unsubscribes from all topics
12. Error handling - subscription error propagates

## Implementation Order

1. Types & Schemas (types.ts, request.ts, response.ts)
2. Service (MarketEventService.ts, spec.ts)
3. Tool Registry (MarketEventToolRegistry.ts, spec.ts)
4. Integration (update server, exports)
