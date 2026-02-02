# DISCREPANCY-006: WebSocket Reconnection Design

## Problem

ADR-001 requires "Handle connection drops with exponential backoff" but WebSocketManager only sets status to DISCONNECTED without reconnection.

## Decision Summary

| Question | Decision |
|----------|----------|
| Reconnection style | Automatic (not reactive like pytr) |
| Backoff parameters | Max 5 attempts, 1s → 2s → 4s → 8s → 16s |
| Subscription recovery | Auto-resubscribe to all active topics |
| Triggers | Both close event and heartbeat timeout |

## Implementation

### New State

```typescript
private activeSubscriptions: Map<number, { topic: string; payload?: object }> = new Map();
private reconnectAttempts = 0;
private isReconnecting = false;
private isIntentionalDisconnect = false;
private lastCookieHeader = '';
private readonly MAX_RECONNECT_ATTEMPTS = 5;
private readonly RECONNECT_BASE_DELAY_MS = 1000;
```

### Track Subscriptions

On `subscribe()`: Store topic and payload in `activeSubscriptions` map
On `unsubscribe()`: Remove from `activeSubscriptions` map

### Reconnection Logic

1. Check if already reconnecting or intentional disconnect
2. Loop up to MAX_RECONNECT_ATTEMPTS:
   - Wait for exponential delay (1s, 2s, 4s, 8s, 16s)
   - Attempt to connect with saved cookie header
   - If success: resubscribe all, reset attempts, emit 'reconnected'
   - If failure: increment attempts, continue
3. After max attempts: emit error, give up

### Trigger Points

- On WebSocket `close` event (if not intentional)
- On heartbeat timeout (closes WebSocket → triggers close event)

### Intentional Disconnect

- Set `isIntentionalDisconnect = true` before closing
- Clear `activeSubscriptions`
- Do not attempt reconnection

## Test Cases

1. Reconnects on unexpected close
2. Reconnects on heartbeat timeout
3. Exponential backoff delays (1s, 2s, 4s, 8s, 16s)
4. Gives up after 5 attempts, emits error
5. Resubscribes to all active topics after reconnect
6. Does NOT reconnect after intentional disconnect()
7. Emits 'reconnected' event on success
