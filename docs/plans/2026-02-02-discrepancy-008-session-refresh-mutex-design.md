# DISCREPANCY-008: Session Refresh Mutex Design

## Problem

Multiple concurrent `ensureValidSession()` calls can trigger simultaneous refresh requests (race condition).

## Decision Summary

| Question | Decision |
|----------|----------|
| Approach | Promise-based mutex (no dependencies) |
| Behavior | Concurrent callers await same promise |
| Cleanup | `finally()` clears promise after completion |

## Implementation

### New Property

```typescript
private refreshPromise: Promise<void> | null = null;
```

### Modified ensureValidSession()

```typescript
public async ensureValidSession(): Promise<void> {
  this.ensureInitialized();

  if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.hasCookies()) {
    throw new AuthenticationError('Not authenticated');
  }

  // Check if session is about to expire
  if (Date.now() >= this.sessionExpiresAt - SESSION_EXPIRATION_BUFFER_MS) {
    // If refresh already in progress, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    // Start refresh and store promise
    this.refreshPromise = this.refreshSession().finally(() => {
      this.refreshPromise = null;
    });

    await this.refreshPromise;
  }
}
```

## Test Cases

1. Single caller works normally - refreshes when expired
2. Concurrent callers share one refresh - verify `refreshSession()` called only once
3. All callers get the result - all concurrent promises resolve
4. Error propagates to all callers - all receive the error on failure
5. Promise cleared after completion - next expiration triggers new refresh
6. Promise cleared after failure - next call can retry

## Files to Modify

1. `src/server/services/TradeRepublicApiService.ts` - add mutex logic
2. `src/server/services/TradeRepublicApiService.spec.ts` - add tests
