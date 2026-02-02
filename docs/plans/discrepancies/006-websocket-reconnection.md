# DISCREPANCY-006: WebSocket Reconnection

## Summary

ADR-001 requires "Handle connection drops with exponential backoff" but WebSocketManager only sets status to DISCONNECTED without reconnection.

## Brainstormed Solution

1. **Automatic reconnection** when connection drops or heartbeat times out
2. **Exponential backoff:** Max 5 attempts, 1s → 2s → 4s → 8s → 16s delays
3. **Auto-resubscribe** to all active topics after successful reconnect
4. **Track subscriptions** in a map for recovery
5. **Skip reconnection** on intentional disconnect()

## Implementation Details

### 1. Add new state to WebSocketManager

```typescript
private activeSubscriptions: Map<number, { topic: string; payload?: object }> = new Map();
private reconnectAttempts = 0;
private isReconnecting = false;
private isIntentionalDisconnect = false;
private lastCookieHeader = '';
private readonly MAX_RECONNECT_ATTEMPTS = 5;
private readonly RECONNECT_BASE_DELAY_MS = 1000;
```

### 2. Track subscriptions

In `subscribe()`:
```typescript
this.activeSubscriptions.set(subId, { topic, payload });
```

In `unsubscribe()`:
```typescript
this.activeSubscriptions.delete(subscriptionId);
```

### 3. Save cookie header for reconnection

In `connect()`:
```typescript
this.lastCookieHeader = cookieHeader;
```

### 4. Implement reconnection

```typescript
private async attemptReconnect(): Promise<void> {
  if (this.isReconnecting || this.isIntentionalDisconnect) return;

  this.isReconnecting = true;

  while (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
    const delay = this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    logger.api.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
    await this.sleep(delay);

    try {
      await this.connect(this.lastCookieHeader);
      await this.resubscribeAll();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.emit('reconnected');
      return;
    } catch (error) {
      this.reconnectAttempts++;
      logger.api.warn(`Reconnection attempt ${this.reconnectAttempts} failed`);
    }
  }

  this.isReconnecting = false;
  this.emit('error', new WebSocketError('Max reconnection attempts exceeded'));
}

private async resubscribeAll(): Promise<void> {
  for (const [, { topic, payload }] of this.activeSubscriptions) {
    this.subscribe(topic, payload);
  }
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 5. Trigger on close event

```typescript
ws.addEventListener('close', () => {
  this.status = ConnectionStatus.DISCONNECTED;
  this.stopHeartbeat();

  if (!this.isIntentionalDisconnect) {
    this.attemptReconnect();
  }
});
```

### 6. Update disconnect() for intentional close

```typescript
public disconnect(): void {
  this.isIntentionalDisconnect = true;
  this.stopHeartbeat();
  // ... existing cleanup ...
  this.activeSubscriptions.clear();
  this.reconnectAttempts = 0;
}
```

### 7. Clear delta state on reconnect

In `connect()` or `resubscribeAll()`:
```typescript
this.previousResponses.clear();
```

## Test Cases

1. Reconnects on unexpected close
2. Reconnects on heartbeat timeout
3. Exponential backoff delays (1s, 2s, 4s, 8s, 16s)
4. Gives up after 5 attempts, emits error
5. Resubscribes to all active topics after reconnect
6. Does NOT reconnect after intentional disconnect()
7. Emits 'reconnected' event on success
8. Clears previousResponses on reconnect

## Files to Modify

1. `src/server/services/TradeRepublicApiService.websocket.ts` - main implementation
2. `src/server/services/TradeRepublicApiService.websocket.spec.ts` - add tests

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
