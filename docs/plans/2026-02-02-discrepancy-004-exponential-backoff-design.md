# DISCREPANCY-004: Exponential Backoff Design

## Problem

ADR-001 requires "Exponential backoff on errors" but HTTP error handling in `TradeRepublicApiService` throws exceptions immediately without retry logic.

## Decision Summary

| Question | Decision |
|----------|----------|
| Which operations to retry? | All three: login, verify2FA, refreshSession |
| Which errors trigger retry? | 5xx, 429, network errors; fail fast on 4xx |
| Backoff parameters | 3 retries, 1s base, 2x multiplier, 10s max |
| Implementation approach | Use `p-retry` library |
| Composition | `throttle(retry(fetch))` |

## Architecture

**Composition chain:**
```
throttledFetch = throttle(retryWithBackoff(fetchFn))
```

**Retry behavior:**
- **Retries on:** 5xx status codes, 429 (rate limited), network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, fetch failures)
- **Fails fast on:** 4xx status codes (except 429) - client errors like invalid credentials

**Parameters:**
- Max retries: 3
- Base delay: 1000ms
- Multiplier: 2x (delays: 1s → 2s → 4s)
- Max delay: 10000ms

**Affected methods:**
- `login()` - POST to `/auth/web/login`
- `verify2FA()` - POST to `/auth/web/login/{processId}/{code}`
- `refreshSession()` - GET to `/auth/web/session`

All three already use `this.throttledFetch()`, so the change is centralized in the constructor.

## Implementation

1. Add `p-retry` dependency
2. Create retry wrapper function that:
   - Wraps fetch calls
   - Checks response status codes
   - Throws on 5xx/429 to trigger retry
   - Passes through 4xx errors immediately
   - Catches network errors for retry
3. Compose: `throttle(retryWithBackoff(fetchFn))`
4. Add logging for retry attempts
