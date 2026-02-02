# DISCREPANCY-004: Exponential Backoff

## Summary

ADR-001 requires "Exponential backoff on errors" for HTTP requests. Currently, HTTP error handling throws exceptions immediately without retry logic.

## Brainstormed Solution

1. **Scope:** All three HTTP operations: login, verify2FA, refreshSession
2. **Retry triggers:** 5xx status codes, 429 (rate limited), network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
3. **No retry:** 4xx status codes (except 429) - client errors like invalid credentials
4. **Parameters:** 3 retries, 1s base delay, 2x multiplier (1s → 2s → 4s), 10s max delay
5. **Library:** `p-retry` - same author as `p-throttle`
6. **Composition:** `throttle(retry(fetch))` - each retry respects rate limiting

## Implementation Details

### 1. Add dependency

```bash
npm install p-retry
```

### 2. Modify `TradeRepublicApiService.ts`

Add import:
```typescript
import pRetry, { AbortError } from 'p-retry';
```

Create retry wrapper function:
```typescript
private createRetryFetch(fetchFn: FetchFunction): FetchFunction {
  return async (url: string | URL | Request, init?: RequestInit) => {
    return pRetry(
      async () => {
        const response = await fetchFn(url, init);

        // Don't retry 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          // Return response, let caller handle error
          return response;
        }

        // Retry on 5xx server errors and 429 rate limit
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (error) => {
          logger.api.warn(
            { attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
            `Request failed, retrying...`
          );
        },
      }
    );
  };
}
```

Update constructor composition:
```typescript
// Rate limit: 1 request per 1000ms (per ADR-001)
const throttle = pThrottle({ limit: 1, interval: 1000 });

// Compose: throttle wraps retry
// Each retry attempt respects rate limiting
const retryFetch = this.createRetryFetch(this.fetchFn);
this.throttledFetch = throttle((...args: Parameters<FetchFunction>) =>
  retryFetch(...args)
) as FetchFunction;
```

### 3. Handle network errors

Network errors (ECONNRESET, etc.) are already thrown by fetch and will be caught by p-retry for automatic retry.

### 4. Update Jest config

`p-retry` is ESM-only like `p-throttle`. Add to transformIgnorePatterns if needed (may already be covered).

## Test Cases

1. **Retries on 500 error** - should retry up to 3 times then fail
2. **Retries on 429 error** - should retry (rate limited)
3. **Does NOT retry on 400 error** - client error, fail immediately
4. **Does NOT retry on 401 error** - auth error, fail immediately
5. **Retries on network error** - ECONNRESET, ETIMEDOUT
6. **Succeeds after transient failure** - first call fails with 500, second succeeds
7. **Logs retry attempts** - verify logger.api.warn is called
8. **Respects backoff delays** - 1s, 2s, 4s delays between retries
9. **Retry composition with throttle** - retries are also throttled

## Files to Modify

1. `package.json` - add p-retry dependency
2. `jest.config.js` - add p-retry to ESM transform if needed
3. `src/server/services/TradeRepublicApiService.ts` - add retry wrapper
4. `src/server/services/TradeRepublicApiService.spec.ts` - add retry tests

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
