# Trade Republic API Comparison: Our Implementation vs Trade_Republic_Connector

**Comparison Date:** 2026-02-01
**Reference Implementation:** [Trade_Republic_Connector](https://github.com/cdamken/Trade_Republic_Connector) (TypeScript)
**Last Update:** June 2025
**Files Analyzed:**
- `src/auth/manager.ts` (26,171 bytes)
- `src/websocket/tr-websocket.ts` (15,002 bytes)
- `src/api/working-tr-api.ts` (5,764 bytes)
- Type definitions

---

## Executive Summary

Trade_Republic_Connector is a TypeScript implementation using the same tech stack as our project. While core protocol matches, it uses different patterns in several areas. Most notably, it confirms the same session duration (290 seconds) as pytr, and adds HTTP headers we're missing.

### Critical Findings

1. **CRITICAL:** Session duration mismatch (55 min vs 290 sec)
2. **HIGH:** Missing HTTP headers (Origin, Referer, User-Agent)
3. **MEDIUM:** Missing WebSocket headers
4. **Match:** Core WebSocket protocol

---

## 1. Authentication Flow

### 1.1 Login Endpoints

**Trade_Republic_Connector:**
```typescript
POST /api/v1/auth/web/login
Body: { phoneNumber, pin }

POST /api/v1/auth/web/login/{processId}/tan
Body: { tan: code }  // 4-digit code
```

**Our Implementation:**
```typescript
POST /api/v1/auth/web/login
Body: { phoneNumber, pin }

POST /api/v1/auth/web/login/{processId}/{code}
Body: { deviceKey: publicKeyBase64 }
```

**Difference:** They use `/tan` endpoint with code in body, we use `/{code}` in URL path.

**Status:** Our approach matches pytr (validated). Keep as-is.

### 1.2 HTTP Headers

#### DISCREPANCY

**Trade_Republic_Connector:**
```typescript
{
  'Content-Type': 'application/json',
  'User-Agent': 'Trade-Republic-Connector/1.0.0',
  'Accept': 'application/json',
  'Origin': 'https://app.traderepublic.com',
  'Referer': 'https://app.traderepublic.com/'
}
```

**Our Implementation:**
```typescript
{
  'Content-Type': 'application/json'
}
```

**Impact:** May trigger CORS issues or bot detection without Origin/Referer headers.

**Status:** SHOULD ADD - Defensive measure

---

## 2. WebSocket Protocol

### 2.1 Connect Message

**Trade_Republic_Connector:**
```typescript
const connectId = 31;
const connectionMessage = {
  locale: this.config.locale,
  platformId: "WEB",
  clientId: "app.traderepublic.com",
  clientVersion: "6127"
};
```

**Our Implementation:**
```typescript
const connectPayload = {
  locale: 'en',
  platformId: 'webtrading',
  platformVersion: 'chrome - 120.0.0',
  clientId: 'app.traderepublic.com',
  clientVersion: '1.0.0',
  sessionToken,
};
```

**Differences:**
- `platformId`: "WEB" vs "webtrading" (we match pytr)
- `platformVersion`: not included vs included (we match pytr)
- `sessionToken`: not in connect vs in connect (we match pytr)

**Status:** Our format matches pytr exactly. Keep as-is.

### 2.2 WebSocket Headers

#### DISCREPANCY

**Trade_Republic_Connector:**
```typescript
{
  'User-Agent': 'Trade Republic/5127 CFNetwork/1492.0.1 Darwin/23.3.0',
  'Origin': 'https://app.traderepublic.com',
  'Sec-WebSocket-Protocol': 'echo-protocol'
}
```

**Our Implementation:**
No custom WebSocket headers.

**Impact:** May affect connection stability or trigger bot detection.

**Status:** SHOULD ADD - At minimum, add Origin header

---

## 3. Session Management

### 3.1 Session Duration

#### CRITICAL DISCREPANCY

**Trade_Republic_Connector:**
```typescript
// Token expires in 290 seconds (4.8 minutes)
// Refresh triggers at 30-second threshold
```

**Our Implementation:**
```typescript
// Session duration: 55 minutes
// Refresh buffer: 5 minutes
```

**Confirmation:** Both pytr AND Trade_Republic_Connector use ~290 seconds.

**Impact:** May cause authentication failures if sessions actually expire after 5 minutes.

**Status:** MUST INVESTIGATE - Test with live API

---

## 4. Features Comparison

### Features in Trade_Republic_Connector Not in Ours

1. **Separate device pairing flow** - explicit device registration API
2. **MFA method selection** - choose SMS vs app-based 2FA
3. **Retry logic with backoff** - automatic retry for failed requests
4. **Rate limiting wrapper** - enforces request rate limits
5. **HTTP interceptors** - logging and tracing middleware
6. **SQLite database** - local data persistence
7. **Bulk subscriptions** - subscribe to multiple assets at once
8. **REST API wrapper** - HTTP endpoints for external apps
9. **Data export** - JSON/CSV/Parquet export functionality

### Features in Ours Not in Trade_Republic_Connector

1. **Complete crypto implementation** - full ECDSA signing with SHA-512
2. **Signed payload creation** - timestamped authentication payloads
3. **Session refresh endpoint** - token refresh implementation
4. **Trading-specific topics** - simpleCreateOrder, orders, cancelOrder
5. **Type-safe schemas** - comprehensive Zod validation
6. **subscribeAndWait pattern** - synchronous-style async operations
7. **MCP tool integration** - complete tool registry system
8. **100% test coverage** - comprehensive test suite

---

## 5. Error Handling

**Trade_Republic_Connector Error Codes:**
```typescript
'TOO_MANY_REQUESTS'  // Rate limiting
'AUTH_TIMEOUT'       // 2FA timeout
'SESSION_EXPIRED'    // Session invalid
'DEVICE_NOT_PAIRED'  // Device needs pairing
```

**Our Implementation:**
Only generic HTTP status codes.

**Status:** OPTIONAL - Consider adding specific error codes

---

## 6. Summary

### What Matches
- Core WebSocket protocol (version 31)
- ECDSA P-256 key generation
- Public key format (65-byte, base64)
- Response codes (A/D/C/E)

### Critical Issues
1. **Session duration** - 55 min vs 290 sec (INVESTIGATE)

### Should Add
2. **HTTP headers** - Origin, Referer, User-Agent
3. **WebSocket Origin header**

### Different Approaches (Both Valid)
- 2FA endpoint format (we match pytr)
- Connect message format (we match pytr)
- Session token placement (we match pytr)

---

## Conclusion

Trade_Republic_Connector confirms the session duration discrepancy (also found in pytr). It also reveals we should add HTTP headers for browser-like behavior. However, our core protocol implementation matches pytr, the more authoritative reference.

**Priority Actions:**
1. Test session duration with live API
2. Add HTTP headers (Origin, Referer, User-Agent)
3. Add WebSocket Origin header

---

## Verification Evidence

**Source Repository:** https://github.com/cdamken/Trade_Republic_Connector
**Analysis Date:** 2026-02-01
**Agent ID:** a6277c2
