# ADR-015: WebSocket-Based API Communication

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Trade Republic doesn't have a REST API - it uses WebSocket for all communication with their mobile and web apps.

## Problem

How should the MCP server communicate with Trade Republic?

## Decision

**Use WebSocket topic subscription model.**

All communication with Trade Republic uses WebSocket with a topic-based subscription pattern:

1. Subscribe to topic with optional payload
2. Receive response via message handler
3. Unsubscribe when done

## Message Protocol

### Subscription Request
```
sub <id> <topic> [payload]
```

Example:
```
sub 1 compactPortfolio
sub 2 ticker {"id":"DE000BASF111.LSX"}
```

### Unsubscribe Request
```
unsub <id>
```

### Response Codes
- `A` - Acknowledgment/data response
- `E` - Error response
- `C` - Connected
- `D` - Disconnected

## Helper Pattern

Services wrap WebSocket subscriptions in a `subscribeAndWait()` helper for async/await usage:

```typescript
async function subscribeAndWait<T>(topic: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = generateId();

    const handler = (message: WebSocketMessage) => {
      if (message.id === id) {
        if (message.code === 'A') {
          resolve(message.payload as T);
        } else if (message.code === 'E') {
          reject(new Error(message.payload.message));
        }
        api.unsubscribe(id);
      }
    };

    api.onMessage(handler);
    api.subscribe(id, topic, payload);
  });
}
```

## Rationale

- Trade Republic only supports WebSocket - there is no REST alternative
- Topic-based model aligns with their mobile app architecture
- Subscription pattern enables real-time data when needed
- Matches pytr and Trade_Republic_Connector implementations

## Consequences

### Positive
- Matches Trade Republic's actual protocol
- Enables real-time updates if needed
- Single persistent connection (efficient)
- Well-documented by community projects

### Negative
- More complex than REST
- Need to manage connection state
- Need to handle reconnection
- Message ordering considerations

## References

- ADR-001: Trade Republic API Integration Approach
- ADR-003: Reverse-Engineered API Integration
- TradeRepublicApiService implementation
