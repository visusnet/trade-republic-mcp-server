# DISCREPANCY-003: Rate Limiting

## Summary

ADR-001 requires "Conservative default: max 1 request/second" for HTTP requests. Currently no rate limiting is implemented.

## Brainstormed Solution

1. **Scope:** Global rate limiter for all HTTP requests (login, verify2FA, refreshSession)
2. **Behavior:** Wait/delay until allowed (queue requests, don't reject)
3. **Library:** `p-throttle` - minimal rate limiter from sindresorhus

## Implementation Details

### 1. Add dependency

```bash
npm install p-throttle
```

### 2. Modify `TradeRepublicApiService.ts`

Add import:
```typescript
import pThrottle from 'p-throttle';
```

Add throttled fetch wrapper as class property:
```typescript
private readonly throttledFetch: typeof fetch;
```

In constructor, create throttled fetch:
```typescript
// Rate limit: 1 request per 1000ms (per ADR-001)
const throttle = pThrottle({ limit: 1, interval: 1000 });
this.throttledFetch = throttle((...args: Parameters<typeof fetch>) =>
  this.fetchFn(...args)
);
```

Replace all `this.fetchFn` calls with `this.throttledFetch`:
- `login()` - line ~118
- `verify2FA()` - line ~180
- `refreshSession()` - line ~237

### 3. Update types if needed

`p-throttle` is typed, but we may need to handle the return type properly.

### 4. Testing with fake timers

Use Jest fake timers to test throttling without actual delays:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('should throttle requests to max 1 per second', async () => {
  const fetchTimes: number[] = [];
  mockFetch.mockImplementation(async () => {
    fetchTimes.push(Date.now());
    return mockResponse;
  });

  // Make two rapid requests
  const p1 = service.login(credentials);
  const p2 = service.refreshSession();

  // Advance timers
  await jest.advanceTimersByTimeAsync(1000);

  await Promise.all([p1, p2]);

  // Second request should be delayed by ~1000ms
  expect(fetchTimes[1] - fetchTimes[0]).toBeGreaterThanOrEqual(1000);
});
```

## Test Cases

1. **Single request passes through immediately**
2. **Two rapid requests are throttled** - second waits ~1 second
3. **Multiple rapid requests queue properly** - each spaced 1 second apart
4. **Throttle applies to login()**
5. **Throttle applies to verify2FA()**
6. **Throttle applies to refreshSession()**

## Files to Modify

1. `package.json` - add p-throttle dependency
2. `src/server/services/TradeRepublicApiService.ts` - add throttled fetch
3. `src/server/services/TradeRepublicApiService.spec.ts` - add throttle tests

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
