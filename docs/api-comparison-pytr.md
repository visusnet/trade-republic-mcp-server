# Trade Republic API Comparison: Our Implementation vs pytr

**Comparison Date:** 2026-02-01
**Reference Implementation:** [pytr](https://github.com/pytr-org/pytr) (Python, 677 GitHub stars - most popular)
**Version:** v0.4.5 (December 2025)
**Files Analyzed:**
- `pytr/api.py` (779 lines)
- `pytr/utils.py` (124 lines)
- `pytr/account.py` (108 lines)

---

## Executive Summary

pytr is the most popular and actively maintained Trade Republic API implementation. Our TypeScript implementation follows the same web login approach and most protocol details match exactly. However, one critical feature is missing: delta message decoding.

### Critical Findings

1. **CRITICAL:** Missing delta message decoding for real-time updates
2. **Match:** Web login flow endpoints identical
3. **Match:** ECDSA P-256 key generation and format
4. **Match:** WebSocket protocol version 31
5. **Match:** Connect message format
6. **Investigate:** Session duration (55 min vs 290 sec)

---

## 1. Authentication Flow

### 1.1 Web Login Endpoints

#### Match

**pytr (api.py lines 200-230):**
```python
def initiate_weblogin(self):
    r = self._websession.post(
        f"{self._host}/api/v1/auth/web/login",
        json={"phoneNumber": self.phone_no, "pin": self.pin},
    )
    self._process_id = j["processId"]
    return int(j["countdownInSeconds"]) + 1

def complete_weblogin(self, verify_code):
    r = self._websession.post(
        f"{self._host}/api/v1/auth/web/login/{self._process_id}/{verify_code}"
    )
```

**Our Implementation (TradeRepublicApiService.ts lines 104-224):**
```typescript
public async login(credentials: CredentialsInput): Promise<{ processId: string }> {
  const response = await this.fetchFn(`${TR_API_URL}/auth/web/login`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, pin }),
  });
  this.processId = parsed.processId;
}

public async verify2FA(input: TwoFactorCodeInput): Promise<void> {
  const response = await this.fetchFn(
    `${TR_API_URL}/auth/web/login/${this.processId}/${code}`,
    { method: 'POST', body: JSON.stringify({ deviceKey: publicKeyBase64 }) }
  );
}
```

**Status:** CORRECT - Matches pytr exactly

### 1.2 Device Key Format

#### Match

**pytr (api.py lines 143-144):**
```python
pubkey_bytes = self.sk.get_verifying_key().to_string("uncompressed")
pubkey_string = base64.b64encode(pubkey_bytes).decode("ascii")
```

**Our Implementation (TradeRepublicApiService.crypto.ts lines 122-129):**
```typescript
public getPublicKeyBase64(publicKeyPem: string): string {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const rawKey = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBytes = rawKeyBuffer.subarray(rawKeyBuffer.length - 65);
  return publicKeyBytes.toString('base64');
}
```

**Status:** CORRECT - Both use 65-byte uncompressed EC point, base64-encoded

### 1.3 Session Token Management

#### Difference: Session Duration

**pytr (api.py lines 73-84):**
```python
@session_token.setter
def session_token(self, val):
    self._session_token_expires_at = time.time() + 290  # 4 min 50 sec
    self._session_token = val
```

**Our Implementation:**
```typescript
const DEFAULT_SESSION_DURATION_MS = 55 * 60 * 1000; // 55 minutes
```

**Status:** DISCREPANCY - pytr uses 290 seconds (~5 min), we use 55 minutes

---

## 2. WebSocket Protocol

### 2.1 WebSocket URL

#### Match

**Both:** `wss://api.traderepublic.com`

### 2.2 Connect Message Format

#### Match

**pytr (api.py lines 273-296):**
```python
connection_message = {
    "locale": self._locale,
    "platformId": "webtrading",
    "platformVersion": "chrome - 94.0.4606",
    "clientId": "app.traderepublic.com",
    "clientVersion": "5582",
}
connect_id = 31

await self._ws.send(f"connect {connect_id} {json.dumps(connection_message)}")
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
const message = `connect 31 ${JSON.stringify(connectPayload)}`;
```

**Status:** COMPATIBLE - Same format, minor version differences

### 2.3 Subscription Format

#### Match

**Both use:** `sub {id} {json}`

### 2.4 Message Response Codes

#### Match

**Both recognize:** A (answer), D (delta), C (complete), E (error)

### 2.5 Delta Message Decoding

#### CRITICAL DISCREPANCY

**pytr (api.py lines 355-386):**
```python
elif code == "D":
    response = self._calculate_delta(subscription_id, payload_str)
    self.log.debug(f"Payload is {response}")
    self._previous_responses[subscription_id] = response
    return subscription_id, subscription, json.loads(response)

def _calculate_delta(self, subscription_id, delta_payload):
    previous_response = self._previous_responses[subscription_id]
    i, result = 0, []
    for diff in delta_payload.split("\t"):
        sign = diff[0]
        if sign == "+":
            result.append(urllib.parse.unquote_plus(diff).strip())
        elif sign == "-" or sign == "=":
            if sign == "=":
                result.append(previous_response[i : i + int(diff[1:])])
            i += int(diff[1:])
    return "".join(result)
```

**Delta Message Format:**
- Tab-separated diff instructions
- `+text`: Insert URL-encoded text
- `-N`: Skip N characters from previous response
- `=N`: Copy N characters from previous response

**Example:**
```
Previous: {"foo":"bar","baz":123}
Delta: "=15\t+\"qux\":456}"
Result: {"foo":"bar","baz":123,"qux":456}
```

**Our Implementation:**
- No delta decoding
- No previous response tracking
- 'D' code messages will fail to parse correctly

**Status:** CRITICAL MISSING FEATURE

---

## 3. API Topics Comparison

### Topics We Have (All Match pytr)

| Topic | pytr Method | Our Implementation | Status |
|-------|-------------|-------------------|--------|
| compactPortfolio | `compact_portfolio()` | `get_portfolio` | Match |
| cash | `cash()` | `get_portfolio` | Match |
| ticker | `ticker(isin, exchange)` | `get_price` | Match |
| aggregateHistory | `performance_history()` | `get_candles` | Match |
| neonSearch | `search(query)` | `search_instruments` | Match |
| instrument | `instrument_details(isin)` | Implicit | Match |
| simpleCreateOrder | `limit_order()`, `market_order()`, `stop_market_order()` | `place_order` | Match |
| orders | `order_overview()` | `get_orders` | Match |
| cancelOrder | `cancel_order(id)` | `cancel_order` | Match |

### Topics in pytr Not in Our Implementation

1. `timeline` - Transaction history
2. `timelineDetail` - Transaction details
3. `timelineTransactions` - Transactions list
4. `savingsPlanOverview` - Savings plans
5. `createSavingsPlan`, `changeSavingsPlan`, `cancelSavingsPlan`
6. `createPriceAlarm`, `cancelPriceAlarm`
7. `addWatchlist`, `removeWatchlist`

**Status:** Missing features, not required for core trading

---

## 4. Missing App Login Method

**pytr supports both:**
- Web login (`/auth/web/login`) - which we implement
- App login (`/auth/login`) with ECDSA signatures - which we don't implement

**Status:** Acceptable - Web login is sufficient for our use case

---

## 5. Summary

### What Matches Exactly
- Web login endpoints and flow
- Device key format (65-byte uncompressed EC point, base64)
- WebSocket URL
- Protocol version 31
- Connect message format
- Subscription format
- Response codes (A/D/C/E)
- All 9 core topics

### Critical Issues
1. **Missing delta decoding** - MUST FIX

### Should Investigate
2. **Session duration** - 55 min vs 290 sec

### Missing Features (Optional)
3. App login support
4. Timeline/transaction history
5. Savings plans
6. Price alarms
7. Watchlist management

---

## Verification Evidence

**Source Repository:** https://github.com/pytr-org/pytr (master branch)
**Commit:** d106626
**Analysis Date:** 2026-02-01
**Agent ID:** aa38565
