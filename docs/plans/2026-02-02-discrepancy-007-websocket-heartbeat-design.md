# DISCREPANCY-007: WebSocket Heartbeat Design

## Problem

ADR-001 requires "Maintain heartbeat for connection health" but no heartbeat mechanism is implemented. The Python `websockets` library (used by pytr) has automatic ping/pong every 20 seconds. Our `ws` library and Node.js built-in WebSocket do not.

## Decision Summary

| Question | Decision |
|----------|----------|
| WebSocket library | Switch from `ws` to `import { WebSocket } from 'undici'` (built into Node.js) |
| Headers support | undici WebSocket supports headers for Cookie auth |
| Heartbeat approach | Track last message time, consider dead if no message in 40s |
| Check interval | Every 20 seconds |

## Implementation

### 1. Replace `ws` with undici WebSocket

```typescript
import { WebSocket } from 'undici';

const ws = new WebSocket(url, { headers: { Cookie: cookieHeader } });
```

### 2. API Changes

| `ws` library | undici WebSocket |
|--------------|------------------|
| `ws.on('open', cb)` | `ws.addEventListener('open', cb)` |
| `ws.on('message', cb)` | `ws.addEventListener('message', cb)` |
| `ws.on('close', cb)` | `ws.addEventListener('close', cb)` |
| `ws.on('error', cb)` | `ws.addEventListener('error', cb)` |
| `data: Buffer \| string` | `event.data: string` |

### 3. Heartbeat Mechanism

```typescript
private lastMessageTime: number = Date.now();
private heartbeatInterval: NodeJS.Timeout | null = null;
private readonly HEARTBEAT_CHECK_MS = 20_000;
private readonly CONNECTION_TIMEOUT_MS = 40_000;

private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(() => {
    if (Date.now() - this.lastMessageTime > this.CONNECTION_TIMEOUT_MS) {
      this.handleConnectionDead();
    }
  }, this.HEARTBEAT_CHECK_MS);
}
```

## Files to Modify

1. `package.json` - Remove `ws` dependency
2. `jest.config.js` - Remove `ws` from ESM transform if present
3. `src/server/services/TradeRepublicApiService.types.ts` - Update WebSocket types
4. `src/server/services/TradeRepublicApiService.websocket.ts` - Main implementation
5. `src/server/services/TradeRepublicApiService.websocket.spec.ts` - Update tests
6. `docs/discrepancies.md` - Mark resolved
