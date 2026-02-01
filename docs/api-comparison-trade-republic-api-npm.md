# Trade Republic API Comparison: Our Implementation vs trade-republic-api (NPM)

**Comparison Date:** 2026-02-01
**Reference Implementation:** [trade-republic-api](https://github.com/nightf0rc3/trade-republic-api) (TypeScript NPM package)
**NPM Package:** v1.2.0
**Files Analyzed:**
- CDN: https://cdn.jsdelivr.net/npm/trade-republic-api@1.2.0/
- Type Definitions
- README documentation

---

## Executive Summary

The trade-republic-api NPM package is the only other TypeScript implementation available. It reveals potential differences in authentication token delivery (cookies vs JSON) and subscription payload format that require verification with the live API.

### Critical Findings

1. **CRITICAL:** Authentication token delivery - cookies vs JSON body
2. **CRITICAL:** Subscription payload format - token field, id vs isin
3. **MEDIUM:** Protocol version difference (26 vs 31)
4. **Match:** Core protocol (WebSocket URL, message codes)

---

## 1. Authentication Token Delivery

### CRITICAL DISCREPANCY

**trade-republic-api:**
```javascript
// Dependencies
"set-cookie-parser": "^2.6.0"

// Extracts session token from HTTP Set-Cookie header
// Cookie name: 'tr_session'
```

**Our Implementation:**
```typescript
// Expects tokens in JSON response body
const data = await response.json();
const parsed = TokenResponseSchema.parse(data);

this.sessionTokens = {
  refreshToken: parsed.refreshToken,
  sessionToken: parsed.sessionToken,
  expiresAt: Date.now() + DEFAULT_SESSION_DURATION_MS,
};
```

**Evidence:** Both pytr and trade-republic-api extract tokens from cookies.

**Impact:** If Trade Republic returns tokens via `Set-Cookie` header, our authentication will completely fail.

**Status:** MUST VERIFY - Test with live API

---

## 2. Subscription Payload Format

### CRITICAL DISCREPANCY

**trade-republic-api:**
```javascript
sub {subId} {"type":"ticker","token":"{sessionToken}","id":"ISIN.LSX"}
```

Key characteristics:
- Includes `token` field in EVERY subscription
- Uses generic `id` field (not `isin`)
- Appends exchange to ISIN (e.g., `DE0007164600.LSX`)

**Our Implementation:**
```typescript
sub {subId} {"type":"ticker","isin":"DE0007164600"}
```

Key characteristics:
- NO `token` field
- Uses specific `isin` field
- No exchange suffix

**Impact:** All subscriptions may fail if format is incorrect.

**Status:** MUST VERIFY - Test with live API

---

## 3. WebSocket Protocol

### Protocol Version

**trade-republic-api:**
```javascript
connect 26 {"locale":"de"}
```

**Our Implementation:**
```typescript
connect 31 {"locale":"en","platformId":"webtrading",...,"sessionToken":"..."}
```

**Note:** pytr uses version 31 (matches ours).

**Status:** Our version 31 likely correct (matches pytr)

### Session Token Placement

**trade-republic-api:** Token in every subscription payload
**Our Implementation:** Token in connect message only

**Note:** pytr confirms: token in subscription for app login, NOT for web login.

**Status:** Our approach correct for web login

---

## 4. API Topic Names

**Potential Discrepancies:**

| Our Topic | Their Topic | Status |
|-----------|-------------|--------|
| compactPortfolio | portfolio? | VERIFY |
| aggregateHistory | aggregateHistoryLight? | VERIFY |
| ticker | ticker | Match |
| instrument | instrument | Match |
| orders | orders | Match |

**Status:** Topic names need verification

---

## 5. Core Protocol Matches

Both implementations agree on:

1. **WebSocket URL:** `wss://api.traderepublic.com`
2. **REST Base:** `https://api.traderepublic.com/api/v1`
3. **Message codes:** A (answer), D (delta), C (complete), E (error)
4. **Subscribe format:** `sub {id} {json}`
5. **Unsubscribe:** `unsub {id}`
6. **ECDSA P-256 key format** (65-byte uncompressed, base64)

---

## 6. Architecture Comparison

**trade-republic-api:**
- Single class extending EventEmitter
- `oneShot<T>()` convenience method
- Cookie-based authentication
- Proven in production (2+ years)

**Our Implementation:**
- Multi-service architecture
- Dependency injection
- Auto session refresh
- Comprehensive Zod validation
- JSON-based auth (needs verification)

---

## 7. Missing Features

Features in trade-republic-api NOT in ours:
- Timeline/transaction history
- Savings plans
- Price alarms
- Watchlist management
- Message history tracking

**Status:** Optional features, not required for trading

---

## 8. Summary

### Must Verify with Live API

1. **Authentication token delivery** - cookies vs JSON
2. **Subscription payload format** - token field, id vs isin
3. **Topic names** - compactPortfolio, aggregateHistory

### What Matches
- Core WebSocket protocol
- REST base URL
- Message codes
- Subscribe/unsubscribe format
- ECDSA key format

### Likely Correct (Matches pytr)
- Protocol version 31
- Session token in connect (for web login)

---

## Recommended Actions

### Before Production

1. **Test authentication with live API**
   - Check if tokens come via cookies or JSON
   - If cookies: add `set-cookie-parser` and cookie extraction

2. **Test subscription format**
   - Verify if `token` field is required
   - Verify if `id` field format is required

3. **Test topic names**
   - Verify each topic name works

---

## Verification Evidence

**Source:** trade-republic-api v1.2.0
**Repository:** https://github.com/nightf0rc3/trade-republic-api
**NPM:** https://www.npmjs.com/package/trade-republic-api
**Analysis Date:** 2026-02-01
**Agent ID:** a791287
