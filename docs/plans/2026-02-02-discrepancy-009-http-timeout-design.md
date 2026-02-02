# DISCREPANCY-009: HTTP Request Timeouts Design

## Problem

HTTP requests (login, 2FA, refresh) have no timeout configured and could hang indefinitely.

## Decision Summary

| Question | Decision |
|----------|----------|
| Approach | AbortSignal.timeout() (built-in Node.js) |
| Timeout value | 10 seconds (matches pytr) |
| Scope | Each retry attempt gets its own timeout |

## Implementation

### New Constant

```typescript
const HTTP_TIMEOUT_MS = 10000; // 10 seconds, matches pytr
```

### Modified createRetryFetch()

```typescript
private createRetryFetch(fetchFn: FetchFunction): FetchFunction {
  return async (
    url: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response> => {
    return pRetry(
      async () => {
        const response = await fetchFn(url, {
          ...init,
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
        // ... rest unchanged
      },
      // ... retry config unchanged
    );
  };
}
```

## Test Cases

1. Successful request within timeout - works normally
2. Request times out - throws AbortError/TimeoutError
3. Timed out request is retried - verify retry happens after timeout
4. All retries timeout - eventually throws error

## Files to Modify

1. `src/server/services/TradeRepublicApiService.ts` - add timeout
2. `src/server/services/TradeRepublicApiService.types.ts` - add HTTP_TIMEOUT_MS constant
3. `src/server/services/TradeRepublicApiService.spec.ts` - add tests
