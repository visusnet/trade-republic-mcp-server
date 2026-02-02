# DISCREPANCY-007: WebSocket Heartbeat

## Summary

ADR-001 requires "Maintain heartbeat for connection health". pytr gets this from Python's `websockets` library (auto ping every 20s). Our Node.js implementation needs explicit heartbeat.

## Brainstormed Solution

1. **Replace `ws` library** with `import { WebSocket } from 'undici'` (built into Node.js 24)
2. **Update API calls** from `on()` to `addEventListener()`
3. **Add heartbeat** - track last message time, consider dead if no message in 40s
4. **Check interval** - every 20 seconds (matching pytr's library default)

## Implementation Details

### 1. Remove `ws` dependency

```bash
npm uninstall ws @types/ws
```

### 2. Update `TradeRepublicApiService.types.ts`

Remove custom WebSocket interface, use undici's types or define minimal interface matching browser WebSocket API.

### 3. Update `TradeRepublicApiService.websocket.ts`

```typescript
import { WebSocket } from 'undici';
```

Change event listeners:
- `ws.on('open', cb)` → `ws.addEventListener('open', cb)`
- `ws.on('message', cb)` → `ws.addEventListener('message', (e) => cb(e.data))`
- `ws.on('close', cb)` → `ws.addEventListener('close', cb)`
- `ws.on('error', cb)` → `ws.addEventListener('error', cb)`

Add heartbeat:
```typescript
private lastMessageTime = Date.now();
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

private stopHeartbeat(): void {
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }
}

private handleConnectionDead(): void {
  logger.api.warn('Connection dead - no message received in 40s');
  this.disconnect();
  this.emit('error', new WebSocketError('Connection timeout'));
}
```

Update message handler to track time:
```typescript
private handleMessage(data: string): void {
  this.lastMessageTime = Date.now();
  // ... existing logic
}
```

### 4. Update tests

- Mock undici WebSocket with addEventListener
- Test heartbeat triggers after timeout
- Test heartbeat stops on disconnect

## Test Cases

1. **Connection timeout** - no message in 40s triggers error
2. **Message resets timer** - receiving message resets timeout
3. **Heartbeat starts on connect** - interval created after connection
4. **Heartbeat stops on disconnect** - interval cleared
5. **All existing tests pass** - API change is transparent

## Files to Modify

1. `package.json` - remove ws, @types/ws
2. `jest.config.js` - remove ws from transform if present
3. `src/server/services/TradeRepublicApiService.types.ts` - update types
4. `src/server/services/TradeRepublicApiService.websocket.ts` - main changes
5. `src/server/services/TradeRepublicApiService.websocket.spec.ts` - update tests

---

## Resolution Implementation

For each discrepancy found (one after another), spawn a sub agent to fix it by following these steps strictly (they are SACRED):
1. Write at least one test that tests the correct (atomic) behavior for a given discrepancy.
   <reasoning>These tests will initially fail because the implementation is currently incorrect but they will succeed once the implementation is fixed.</reasoning>
   If the implementation is currently wrong, there should already be tests for the incorrect behavior. Keep these tests for now.
   <reasoning>Keeping the tests for the incorrect behavior ensures that we can verify that the incorrect behavior is indeed fixed once we modify the implementation. These tests should fail after the fix, confirming the correction.</reasoning>
2. Modify the implementation to make the new test pass.
   -> new test(s) for correct behavior pass
   -> existing test(s) for incorrect behavior fail
3. If the implementation was wrong, there will be tests that verified the incorrect behavior. You can either:
    - remove them if new tests sufficiently cover the correct behavior and fit the overall test suite
      <example>
      Let's assume an old test for the incorrect behavior was called "returns price for valid asset id" and the new test for the correct behavior is called "returns price for valid asset id (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
      <example>
      Let's assume an old test for the incorrect behavior was called "throws error for multiple asset ids" because the implementation incorrectly allowed multiple asset ids. The new test for the correct behavior is called "throws error for multiple asset ids (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
    - or modify them to verify the correct behavior instead
      <example>
      Let's assume an old test that tests features adjacent to the incorrect behavior was called "calculates position size" and it has an expectation that checks for an incorrect value due to the wrong implementation. The new test for the correct behavior is called "returns risk metrics" which only focuses on the correct behavior. In this case, we can modify the old test to align with the correct behavior by updating its expectations to match the correct implementation. These tests inherintly verify different aspects of the functionality but can be adjusted to ensure they all validate the correct behavior. Keep them all (without any "(after fix)" in the name).
      </example>
    - or merge them with new tests if that makes sense
      <example>
      Let's assume an old test for the incorrect behavior was called "places market order" and the new test for the correct behavior is called "places market order with validation". If the new test is basically the same as the old test but with additional validation steps, we can merge them into a single test called "places market order" that includes all necessary checks. This way, we retain the original intent while ensuring the test reflects the correct behavior.
      </example>
4. Refactor the code to improve it while ensuring all tests still pass.
    - think about a better structure, naming, separation of concerns, modularity, reusability, readability, maintainability, performance, etc. and make the necessary changes
    - apply any necessary code quality improvements
    - ensure 100% test coverage in all categories
    - ensure linting and formatting compliance
    - ensure knip reports no unused code
5. Commit the changes with a clear and concise commit message following the Conventional Commits specification. Push the changes.
6. Stop the sub agent.
7. Mark the discrepancy as resolved in docs/discrepancies.md.

Repeat (with the next discrepancy and a freshly spawned sub agent) until the implementation is verified to be correct.
