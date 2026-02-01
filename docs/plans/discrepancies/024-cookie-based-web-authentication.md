# DISCREPANCY-024: Cookie-Based Web Authentication

## Summary

Our web login implementation incorrectly expects authentication tokens in JSON response body. Based on analysis of pytr's complete source code, Trade Republic's web login uses **cookies** for authentication:

1. 2FA completion sets cookies via `Set-Cookie` header (no JSON tokens)
2. WebSocket connection authenticates via `Cookie` HTTP header
3. Connect message does NOT include `sessionToken`
4. Session refresh is cookie-based (`GET /api/v1/auth/web/session`)

## Current vs Required Implementation

| Aspect | Current (Wrong) | Required (pytr-based) |
|--------|-----------------|----------------------|
| 2FA response parsing | `response.json()` for tokens | Capture `Set-Cookie` headers |
| Token storage | `SessionTokens` object | Cookie jar/storage |
| WebSocket auth | `sessionToken` in connect payload | `Cookie` HTTP header |
| Connect message | Includes `sessionToken` field | No `sessionToken` field |
| Session refresh | `POST` with Bearer token | `GET` (cookies auto-sent) |

## Architectural Changes Required

### 1. Cookie Storage

Add cookie storage mechanism to `TradeRepublicApiService`:

```typescript
interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: Date;
}

private cookies: StoredCookie[] = [];
```

### 2. Cookie Parsing from HTTP Response

Create utility to parse `Set-Cookie` headers:

```typescript
private parseCookies(response: Response): StoredCookie[] {
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) return [];

  // Parse Set-Cookie header(s) into cookie objects
  // Handle multiple cookies, attributes (domain, path, expires, etc.)
}
```

Note: In Node.js `fetch`, `response.headers.get('set-cookie')` may return combined cookies. Use `response.headers.getSetCookie()` if available, or parse manually.

### 3. Modify `verify2FA()` Method

**Before:**
```typescript
const data = await response.json();
const parsed = TokenResponseSchema.parse(data);
this.sessionTokens = {
  refreshToken: parsed.refreshToken,
  sessionToken: parsed.sessionToken,
  expiresAt: Date.now() + DEFAULT_SESSION_DURATION_MS,
};
```

**After:**
```typescript
// Don't parse JSON - just capture cookies
this.cookies = this.parseCookies(response);
if (this.cookies.length === 0) {
  throw new AuthenticationError('No cookies received from 2FA response');
}
// Session expiry based on cookie expiry or default 290 seconds (per pytr)
this.sessionExpiresAt = Date.now() + 290_000;
```

### 4. Modify WebSocketManager

Add cookie support to WebSocket connection:

```typescript
// In WebSocketFactory type or WebSocket options
interface WebSocketOptions {
  headers?: Record<string, string>;
}

// Pass cookies as header
const cookieHeader = this.cookies
  .filter(c => c.domain.endsWith('traderepublic.com'))
  .map(c => `${c.name}=${c.value}`)
  .join('; ');

this.ws = this.wsFactory(TR_WS_URL, {
  headers: { 'Cookie': cookieHeader }
});
```

### 5. Modify Connect Message

**Before:**
```typescript
const connectPayload = {
  locale: 'en',
  platformId: 'webtrading',
  platformVersion: 'chrome - 120.0.0',
  clientId: 'app.traderepublic.com',
  clientVersion: '1.0.0',
  sessionToken,  // REMOVE THIS
};
```

**After:**
```typescript
const connectPayload = {
  locale: 'en',
  platformId: 'webtrading',
  platformVersion: 'chrome - 120.0.0',
  clientId: 'app.traderepublic.com',
  clientVersion: '1.0.0',
  // No sessionToken - auth via Cookie header
};
```

### 6. Modify Session Refresh

**Before:**
```typescript
const response = await this.fetchFn(`${TR_API_URL}/auth/web/session`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.sessionTokens.refreshToken}`,
  },
});
const data = await response.json();
```

**After:**
```typescript
// pytr uses GET, cookies are sent automatically by fetch with credentials
const response = await this.fetchFn(`${TR_API_URL}/auth/web/session`, {
  method: 'GET',
  headers: {
    'Cookie': this.getCookieHeader(),
  },
});
// Response refreshes cookies via Set-Cookie
const newCookies = this.parseCookies(response);
if (newCookies.length > 0) {
  this.cookies = newCookies;
}
this.sessionExpiresAt = Date.now() + 290_000;
```

### 7. Update Session Duration

Change from 55 minutes to 290 seconds (per pytr):

```typescript
// Before
const DEFAULT_SESSION_DURATION_MS = 55 * 60 * 1000; // 55 minutes

// After
const DEFAULT_SESSION_DURATION_MS = 290_000; // 290 seconds (~5 minutes)
```

### 8. Remove Unused Token Infrastructure

- Remove `TokenResponseSchema` (or keep for app login if ever needed)
- Remove `RefreshTokenResponseSchema` usage in web login path
- Remove `sessionTokens` property or repurpose
- Update `AuthStatus` handling

## Files to Modify

1. **`src/server/services/TradeRepublicApiService.ts`**
   - Add cookie storage and parsing
   - Modify `verify2FA()` to capture cookies
   - Modify `refreshSession()` to use GET with cookies
   - Update session duration constant
   - Remove/update token-related code

2. **`src/server/services/TradeRepublicApiService.websocket.ts`**
   - Modify `connect()` to accept cookies
   - Remove `sessionToken` from connect message
   - Pass cookies as WebSocket header

3. **`src/server/services/TradeRepublicApiService.types.ts`**
   - Add `StoredCookie` interface
   - Update `WebSocketFactory` type for headers support
   - Update session duration constant

4. **`src/server/services/TradeRepublicApiService.spec.ts`**
   - Update tests for cookie-based auth
   - Mock `Set-Cookie` headers instead of JSON responses
   - Test cookie parsing and storage

5. **`src/server/services/TradeRepublicApiService.websocket.spec.ts`**
   - Update tests for cookie-based WebSocket auth
   - Remove sessionToken from connect message tests

## Test Cases

1. **Cookie parsing from Set-Cookie header** - single cookie
2. **Cookie parsing from Set-Cookie header** - multiple cookies
3. **Cookie parsing with attributes** - domain, path, expires
4. **2FA stores cookies** - cookies captured from response
5. **2FA throws if no cookies** - error when Set-Cookie missing
6. **WebSocket receives cookies** - cookies passed to factory
7. **Connect message has no sessionToken** - verify payload format
8. **Session refresh uses GET** - correct HTTP method
9. **Session refresh updates cookies** - new cookies stored
10. **Session expiry is 290 seconds** - correct duration
11. **Cookie header format** - correct `name=value; name2=value2` format
12. **Only traderepublic.com cookies sent** - domain filtering

## Edge Cases

1. **Empty Set-Cookie header** - throw AuthenticationError
2. **Malformed cookie format** - handle gracefully or throw
3. **Cookie expiry tracking** - respect expires attribute if present
4. **Multiple Set-Cookie headers** - handle array of headers

## Dependencies

May need to add a cookie parsing library or implement manual parsing:
- Option A: Use `set-cookie-parser` npm package (same as trade-republic-api)
- Option B: Implement simple parser for Trade Republic's cookie format
- Recommendation: **Option B** - keep dependencies minimal, TR cookies are simple

## Migration Notes

This is a breaking change for the authentication flow. Existing stored credentials (if any) will need to be re-authenticated.

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
