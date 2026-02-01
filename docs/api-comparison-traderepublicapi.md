# Trade Republic API Comparison: Our Implementation vs TradeRepublicApi

**Comparison Date:** 2026-02-01
**Reference Implementation:** [TradeRepublicApi](https://github.com/Zarathustra2/TradeRepublicApi) (Python, 354 GitHub stars)
**Branch:** master
**Files Analyzed:**
- `trapi/api.py` (996 lines)
- README.md (208 lines)

---

## Executive Summary

This document compares our TypeScript implementation against the TradeRepublicApi Python library. Both implementations follow similar core patterns but differ significantly in authentication endpoints, WebSocket protocol details, delta message handling, and topic coverage.

### Critical Findings

1. ✅ **MATCH**: Web login flow endpoints are identical
2. ✅ **MATCH**: ECDSA P-256 key generation and format
3. ❌ **CRITICAL**: We use protocol version `connect 31`, Python uses `connect 21`
4. ❌ **CRITICAL**: Session token placement differs (connect message vs per-subscription)
5. ❌ **CRITICAL**: Python implements delta decoding, we don't (same as pytr finding)
6. ⚠️ **DIFFERENT**: Topic payload formats differ (combined `id` field vs separate fields)
7. ⚠️ **MISSING**: We support 9 topics, Python supports 40+ topics

---

## 1. Authentication Flow

### 1.1 Web Login Endpoints

#### ✅ MATCH

**TradeRepublicApi (Python):**
```python
# Not implemented - Python library doesn't support web login!
# Only supports app login with device registration
```

**Wait - checking the Python code more carefully:**

Looking at lines 50-88 in the Python code, `register_new_device()` uses:
```python
r = requests.post(
    f"{self.url}/api/v1/auth/account/reset/device",
    json={"phoneNumber": self.number, "pin": self.pin},
)
processId = r.json()["processId"]

# Then later:
r = requests.post(
    f"{self.url}/api/v1/auth/account/reset/device/{processId}/key",
    json={"code": token, "deviceKey": pubkey},
)
```

And `login()` (lines 89-117) uses:
```python
res = self.do_request(
    "/api/v1/auth/login",
    payload={"phoneNumber": self.number, "pin": self.pin},
)
```

**Our Implementation:**
```typescript
// POST /auth/web/login
// POST /auth/web/login/{processId}/{code}
// POST /auth/web/session (for refresh)
```

### ❌ MAJOR DIFFERENCE: Authentication Endpoints

| Flow | TradeRepublicApi (Python) | Our Implementation |
|------|---------------------------|-------------------|
| **Device Registration** | POST `/api/v1/auth/account/reset/device` | Not implemented |
| **2FA Completion** | POST `/api/v1/auth/account/reset/device/{processId}/key` | POST `/auth/web/login/{processId}/{code}` |
| **App Login** | POST `/api/v1/auth/login` (with ECDSA signature) | Not implemented |
| **Web Login** | Not supported | POST `/auth/web/login` |
| **Session Refresh** | Not implemented | POST `/auth/web/session` |

**Critical Difference:**
- Python uses **mobile app authentication** with signed requests
- We use **web browser authentication** without signatures
- These are DIFFERENT authentication methods for different clients!

### 1.2 Device Key Format

#### ✅ MATCH

**TradeRepublicApi (lines 69-71):**
```python
pubkey = base64.b64encode(
    self.signing_key.get_verifying_key().to_string("uncompressed")
).decode("ascii")
```

**Our Implementation:**
```typescript
// Extract 65-byte uncompressed EC point from SPKI format
const publicKeyBytes = rawKeyBuffer.subarray(rawKeyBuffer.length - 65);
return publicKeyBytes.toString('base64');
```

**Status:** ✅ Both use base64-encoded 65-byte uncompressed EC point

### 1.3 Request Signing

#### ❌ MAJOR DIFFERENCE

**TradeRepublicApi (lines 143-167):**
```python
def do_request(self, path, payload):
    timestamp = int(time.time() * 1000)
    payload_string = json.dumps(payload)

    signature = self.signing_key.sign(
        bytes(f"{timestamp}.{payload_string}", "utf-8"),
        hashfunc=hashlib.sha512,
        sigencode=sigencode_der,
    )

    headers = dict()
    headers["X-Zeta-Timestamp"] = str(timestamp)
    headers["X-Zeta-Signature"] = base64.b64encode(signature).decode("ascii")
    headers["Content-Type"] = "application/json"

    return requests.request(
        method="POST", url=f"{self.url}{path}", data=payload_string, headers=headers
    )
```

**Our Implementation:**
- No request signing for login/2FA/refresh
- Only sends deviceKey during 2FA, no signatures

**Status:** ❌ Different authentication methods - App vs Web

---

## 2. WebSocket Protocol

### 2.1 WebSocket URL

#### ✅ MATCH

**Both:** `wss://api.traderepublic.com`

### 2.2 Connect Message

#### ⚠️ CRITICAL DIFFERENCES

**TradeRepublicApi (lines 122-124):**
```python
if self.ws is None:
    self.ws = await websockets.connect("wss://api.traderepublic.com")
    msg = json.dumps({"locale": self.locale})
    await self.ws.send(f"connect 21 {msg}")
    response = await self.ws.recv()
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

**Differences:**

| Aspect | TradeRepublicApi | Our Implementation |
|--------|------------------|-------------------|
| **Protocol Version** | `21` | `31` |
| **Locale** | From config | Hardcoded `'en'` |
| **platformId** | Not sent | `'webtrading'` |
| **platformVersion** | Not sent | `'chrome - 120.0.0'` |
| **clientId** | Not sent | `'app.traderepublic.com'` |
| **clientVersion** | Not sent | `'1.0.0'` |
| **sessionToken** | Not sent | Sent in connect |

**Critical Questions:**
1. Why different protocol versions (21 vs 31)?
2. Which version does Trade Republic actually expect?
3. Is version 31 a web-specific protocol?

### 2.3 Session Token Placement

#### ❌ CRITICAL DIFFERENCE

**TradeRepublicApi (lines 129-131):**
```python
payload = kwargs.get("payload", {"type": payload_key})
payload["token"] = self.sessionToken  # Token in EVERY subscription
```

Python sends `"token": sessionToken` in **every subscription payload**.

**Our Implementation:**
```typescript
// Token sent once in connect message
// NOT sent in individual subscriptions
```

**Status:** ❌ CRITICAL - Need to verify which approach Trade Republic expects!

**Hypothesis:**
- Protocol version 21 (app) requires token per subscription
- Protocol version 31 (web) accepts token in connect message
- Need to test both approaches

### 2.4 Subscription Format

#### ⚠️ MOSTLY SAME, PAYLOAD DIFFERS

**TradeRepublicApi (lines 139):**
```python
await self.ws.send(f"sub {id} {json.dumps(payload)}")
```

**Our Implementation:**
```typescript
const messageStr = `sub ${subId} ${JSON.stringify(message)}`;
this.ws.send(messageStr);
```

**Format:** ✅ IDENTICAL (`sub {id} {json}`)

**However, payload contents differ** (see Section 4 below)

### 2.5 Message Response Codes

#### ✅ MATCH (but delta handling differs)

**TradeRepublicApi (lines 750-781):**
```python
if state == "D":  # Delta
    data = self.decode_updates(id, data)
elif state == "A":  # Answer
    pass
elif state == "C":  # Complete
    continue
elif state == "E":  # Error
    raise TRapiExcServerErrorState(...)
```

**Our Implementation:**
```typescript
// A, D, C, E codes recognized
// BUT: No decode_updates() for 'D' messages
```

**Status:** ✅ Codes match, ❌ Delta decoding missing (same issue as pytr)

### 2.6 Delta Decoding Algorithm

#### ❌ MISSING (Same as pytr finding)

**TradeRepublicApi (lines 822-865):**
```python
def decode_updates(self, key, payload):
    # payload is array of instructions like:
    # ['=23', '-5', '+64895', '=14', '-1', '+5']

    latest = self.latest_response[key]
    cur = 0
    rsp = ""

    for x in payload:
        instruction = x[0]
        rst = x[1:]

        if instruction == "=":  # Keep N chars
            num = int(rst)
            rsp += latest[cur: (cur + num)]
            cur += num
        elif instruction == "-":  # Skip N chars
            cur += int(rst)
        elif instruction == "+":  # Insert text
            rsp += rst

    return rsp
```

**Example:**
```python
# Previous: {"bid":{"price":13.873},"ask":{"price":13.915}}
# Delta: ['=23', '-5', '+64895', '=14']
# Result: Updates price from 13.873 to 64.895
```

**Our Implementation:**
- No `decode_updates()` method
- No `latest_response` tracking
- Delta messages ('D' code) will fail to parse

**Status:** ❌ CRITICAL - Same issue found in pytr comparison

---

## 3. API Topics

### 3.1 Topic Coverage Comparison

**Our Implementation (9 topics):**
1. compactPortfolio
2. cash
3. ticker
4. aggregateHistory
5. neonSearch
6. instrument
7. simpleCreateOrder
8. orders
9. cancelOrder

**TradeRepublicApi (40+ topics):**

#### Portfolio & Cash (4 topics)
```python
async def compact_portfolio(self, callback=print)
async def cash(self, callback=print)
async def available_cash(self, callback=print)
async def available_cash_for_payout(self, callback=print)
```

#### Market Data (7 topics)
```python
async def ticker(self, isin, exchange="LSX", callback=print)
async def aggregate_history_light(self, isin, range="max", resolution=604800000, exchange="LSX", callback=print)
async def instrument(self, id, callback=print)
async def neonSearch(self, query="", page=1, page_size=20, instrument_type="stock", jurisdiction="DE", callback=print)
async def neon_search_aggregations(self, ...)
async def neon_search_suggested_tags(self, query="", callback=print)
async def neon_search_tags(self, callback=print)
```

#### Orders (3 topics)
```python
async def simple_create_order(self, order_id, isin, order_type, size, limit, expiry, exchange="LSX", callback=print)
async def orders(self, terminated=False, callback=print)
async def cancel_order(self, id, callback=print)
```

#### Portfolio Details (4 topics)
```python
async def portfolio(self, callback=print)
async def portfolio_status(self, callback=print)
async def portfolio_aggregate_history(self, range="max", callback=print)
# portfolioAggregateHistoryLight (marked as TODO)
```

#### Timeline/History (3 topics)
```python
async def timeline(self, after=None, callback=print)
async def timeline_actions(self, callback=print)
async def timeline_detail(self, id, callback=print)
```

#### Stock Details (3 topics)
```python
async def stock_details(self, isin, callback=print)
async def stock_detail_dividends(self, isin, callback=print)
async def stock_detail_kpis(self, isin, callback=print)
```

#### Watchlist (3 topics)
```python
async def add_to_watchlist(self, id, callback=print)
async def remove_from_watchlist(self, instrument_id, callback=print)
async def watchlist(self, callback=print)
```

#### Price Alarms (2 topics)
```python
async def create_price_alarm(self, isin, target_price, callback=print)
async def price_alarms(self, callback=print)
```

#### Savings Plans (3 topics)
```python
async def create_savings_plan(self, isin, amount, startDate, interval, warnings_shown, callback=print)
async def change_savings_plan(self, id, isin, amount, startDate, interval, warnings_shown, callback=print)
async def cancel_savings_plan(self, id, callback=print)
```

#### Other (8+ topics)
```python
async def instrument_exchange(self, instrument_id, callback=print)
async def home_instrument_exchange(self, instrument_id, callback=print)
async def instrument_suitability(self, instrument_id, callback=print)
async def neon_news(self, isin, callback=print)
async def neon_cards(self, callback=print)
async def message_of_the_day(self, callback=print)
async def derivatives(self, isin, product_category, callback=print)
async def frontend_experiment(self, operation, experimentId, identifier, callback=print)
```

### 3.2 Missing Topics (High Priority)

**Critical for Trading:**
1. `portfolio` - Full portfolio details (not just compact)
2. `timeline` - Transaction history
3. `timelineDetail` - Transaction details
4. `stockDetails` - Detailed stock information
5. `availableCash` - Available cash for trading

**Nice to Have:**
6. `neonNews` - News for instruments
7. `watchlist` - Watchlist management
8. `priceAlarms` - Price alerts
9. `portfolioAggregateHistory` - Portfolio performance over time
10. `savingsPlans` - Savings plan management

---

## 4. API Topic Payload Formats

### 4.1 ticker

#### ❌ FORMAT DIFFERENCE

**TradeRepublicApi (lines 640-651):**
```python
await self.sub(
    "ticker",
    callback=callback,
    payload={"type": "ticker", "id": f"{isin}.{exchange}"},
    key=f"ticker {isin} {exchange}",
)
```

Payload:
```json
{
  "type": "ticker",
  "id": "US62914V1061.LSX",
  "token": "session_token_here"
}
```

**Our Implementation:**
```typescript
{
  "type": "ticker",
  "isin": "US62914V1061",
  "exchange": "LSX"
}
```

**Status:** ❌ DIFFERENT - Python uses combined `id` field with format `{isin}.{exchange}`

**Risk:** Our format may not work if API expects `id` field!

### 4.2 aggregateHistory vs aggregateHistoryLight

#### ❌ TOPIC NAME DIFFERENCE

**TradeRepublicApi (lines 194-220):**
```python
async def aggregate_history_light(self, isin, range="max", resolution=604800000, exchange="LSX", callback=print):
    return await self.sub(
        "aggregateHistoryLight",
        payload={
            "type": "aggregateHistoryLight",
            "range": range,
            "id": f"{isin}.{exchange}",
            "resolution": resolution
        },
        callback=callback,
        key=f"aggregateHistoryLight {isin} {exchange} {range}",
    )
```

Payload:
```json
{
  "type": "aggregateHistoryLight",
  "id": "DE0007164600.LSX",
  "range": "1d",
  "resolution": 604800000,
  "token": "session_token_here"
}
```

**Our Implementation:**
```typescript
{
  "type": "aggregateHistory",  // Different topic name!
  "isin": "DE0007164600",
  "exchange": "LSX",
  "range": "1d"
}
```

**Differences:**
1. Topic name: `aggregateHistoryLight` vs `aggregateHistory`
2. Field format: `id: "{isin}.{exchange}"` vs separate `isin` and `exchange`
3. Missing `resolution` parameter

**Status:** ❌ CRITICAL - Topic name mismatch may cause failures!

### 4.3 neonSearch

#### ⚠️ PAYLOAD STRUCTURE

**TradeRepublicApi (lines 403-430):**
```python
filter = [
    {"key": "type", "value": instrument_type},
    {"key": "jurisdiction", "value": jurisdiction},
]
data = {
    "q": query,
    "page": page,
    "pageSize": page_size,
    "filter": filter
}
await self.sub(
    "neonSearch",
    callback=callback,
    payload={"type": "neonSearch", "data": data},
    key=f"neonSearch {query} {page} {page_size} {filter}",
)
```

Payload:
```json
{
  "type": "neonSearch",
  "data": {
    "q": "Apple",
    "page": 1,
    "pageSize": 20,
    "filter": [
      {"key": "type", "value": "stock"},
      {"key": "jurisdiction", "value": "DE"}
    ]
  },
  "token": "session_token_here"
}
```

**Our Implementation:**
Need to verify our exact payload structure matches this nested format.

**Python has validation lists:**
```python
exchange_list = ["LSX", "TDG", "LUS", "TUB", "BHS", "B2C"]
range_list = ["1d", "5d", "1m", "3m", "1y", "max"]
instrument_list = ["stock", "fund", "derivative", "crypto"]
jurisdiction_list = ["AT", "DE", "ES", "FR", "IT", "NL", "BE", "EE", "FI", "IE", "GR", "LU", "LT", "LV", "PT", "SI", "SK"]
expiry_list = ["gfd", "gtd", "gtc"]
order_type_list = ["buy", "sell"]
```

**We don't have these validation lists** - might accept invalid values.

### 4.4 simpleCreateOrder

#### ⚠️ NEED TO VERIFY

**TradeRepublicApi (lines 545-589):**
```python
payload = {
    "type": "simpleCreateOrder",
    "clientProcessId": order_id,
    "warningsShown": ["userExperience"],
    "acceptedWarnings": ["userExperience"],
    "parameters": {
        "instrumentId": isin,
        "exchangeId": exchange,
        "expiry": {"type": expiry},
        "limit": limit,
        "mode": "limit",
        "size": size,
        "type": order_type,
    },
    "token": sessionToken
}
```

**Status:** Need to verify our payload matches this exact structure, especially:
- `clientProcessId` vs our field name
- `warningsShown` and `acceptedWarnings` arrays
- `expiry` as object with `type` field
- `instrumentId` and `exchangeId` field names

### 4.5 orders

#### ⚠️ TERMINATED PARAMETER

**TradeRepublicApi (lines 498-504):**
```python
async def orders(self, terminated=False, callback=print):
    return await self.sub(
        "orders",
        callback=callback,
        payload={"type": "orders", "terminated": terminated},
        key=f"orders {terminated}"
    )
```

**Our Implementation:**
Need to verify if we support the `terminated` parameter to include completed/cancelled orders.

---

## 5. Validation Lists

### ❌ MISSING

**TradeRepublicApi provides predefined validation lists:**

```python
exchange_list = ["LSX", "TDG", "LUS", "TUB", "BHS", "B2C"]
range_list = ["1d", "5d", "1m", "3m", "1y", "max"]
instrument_list = ["stock", "fund", "derivative", "crypto"]
jurisdiction_list = ["AT", "DE", "ES", "FR", "IT", "NL", "BE", "EE", "FI", "IE", "GR", "LU", "LT", "LV", "PT", "SI", "SK"]
expiry_list = ["gfd", "gtd", "gtc"]
order_type_list = ["buy", "sell"]
```

**Our Implementation:**
We use Zod schemas but don't have explicit enum validation for these known values.

**Impact:**
- We might accept invalid exchanges, ranges, etc.
- Less user-friendly error messages
- Could send invalid requests to TR API

**Fix:** Add Zod enum validation with these known values.

---

## 6. Additional Features

### 6.1 ISIN List

**TradeRepublicApi (lines 811-817):**
```python
@classmethod
def all_isins(cls):
    folder = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(folder, "isins.txt")
    with open(path) as f:
        isins = f.read().splitlines()
    return isins
```

Includes file `trapi/isins.txt` with 39849 bytes of ISINs.

**Our Implementation:**
No built-in ISIN list.

**Status:** ⚠️ Missing feature (nice to have)

### 6.2 Blocking API Wrapper

**TradeRepublicApi provides two classes:**

1. **TRApi** (async with callbacks)
2. **TrBlockingApi** (synchronous wrappers)

**Example:**
```python
class TrBlockingApi(TRApi):
    def cash(self):
        return asyncio.get_event_loop().run_until_complete(
            self.get_one(super().cash())
        )
```

**Our Implementation:**
Single async class with event-based API.

**Status:** Different design pattern (neither better nor worse)

### 6.3 Deprecated Function Aliases

**TradeRepublicApi maintains backward compatibility:**

```python
@deprecated(reason="Use function neon_news")
async def news(self, isin, callback=print):
    await self.neon_news(isin, callback=callback)

@deprecated(reason="Use function aggregate_history_light")
async def stock_history(self, isin, range="max", callback=print):
    await self.aggregate_history_light(isin, range=range, callback=callback)
```

**Our Implementation:**
No deprecated aliases (fresh implementation).

---

## 7. Critical Issues Summary

### Priority 0: CRITICAL - Will Break Functionality

1. **Missing Delta Decoding**
   - Python has full `decode_updates()` implementation
   - We don't handle 'D' code messages with delta payloads
   - Real-time ticker/portfolio updates will fail
   - **Same issue found in pytr comparison**

2. **Topic Name Mismatch: aggregateHistory vs aggregateHistoryLight**
   - We use wrong topic name
   - Historical data requests may fail
   - **Fix:** Change to `aggregateHistoryLight`

3. **Payload Format: Combined id field**
   - Python uses `id: "{isin}.{exchange}"`
   - We use separate `isin` and `exchange` fields
   - API may reject our format
   - **Fix:** Use combined `id` field

### Priority 1: HIGH - May Break Functionality

4. **Protocol Version Mismatch**
   - Python uses `connect 21`
   - We use `connect 31`
   - **Action:** Verify which version Trade Republic expects

5. **Session Token Placement**
   - Python sends token in every subscription
   - We send token once in connect message
   - **Action:** Test if our approach works

6. **Different Authentication Methods**
   - Python uses app authentication with signed requests
   - We use web authentication without signatures
   - These are fundamentally different client types
   - **Status:** OK if we're targeting web clients

### Priority 2: MEDIUM - Limited Functionality

7. **Missing Topics (31 topics)**
   - We have 9 topics, Python has 40+
   - Missing: timeline, stockDetails, watchlist, priceAlarms, savingsPlans, etc.
   - **Impact:** Reduced feature set

8. **Missing Validation Lists**
   - No enum validation for exchanges, ranges, instrument types, etc.
   - Could accept invalid values
   - **Fix:** Add Zod enum schemas

9. **Missing `terminated` Parameter**
   - orders() topic may not support fetching completed orders
   - **Fix:** Add terminated parameter

### Priority 3: NICE TO HAVE

10. **No ISIN List**
11. **No Blocking API Wrapper**
12. **No Deprecated Aliases**

---

## 8. Recommended Actions

### Immediate (Before Production)

1. ✅ **Implement Delta Decoding**
   ```typescript
   private previousResponses: Map<number, string> = new Map();

   private calculateDelta(subscriptionId: number, deltaPayload: string[]): string {
     const previousResponse = this.previousResponses.get(subscriptionId) || '';
     let i = 0;
     const result: string[] = [];

     for (const diff of deltaPayload) {
       const sign = diff[0];
       if (sign === '+') {
         result.push(diff.substring(1));
       } else if (sign === '-') {
         i += parseInt(diff.substring(1), 10);
       } else if (sign === '=') {
         const count = parseInt(diff.substring(1), 10);
         result.push(previousResponse.substring(i, i + count));
         i += count;
       }
     }

     return result.join('');
   }
   ```

2. ✅ **Fix Topic Name**
   - Change `aggregateHistory` → `aggregateHistoryLight`
   - Add `resolution` parameter

3. ✅ **Fix Payload Format**
   - Change `{isin, exchange}` → `{id: "isin.exchange"}`
   - For all market data topics

4. ✅ **Test Protocol Version**
   - Try connecting with version 21
   - Verify version 31 works as expected

5. ✅ **Test Session Token Placement**
   - Test subscriptions without token in payload
   - Verify connect message token is sufficient

### Short Term (Post-MVP)

6. Add missing high-priority topics:
   - `portfolio` (full portfolio details)
   - `timeline` (transaction history)
   - `timelineDetail` (transaction details)
   - `stockDetails` (detailed stock info)
   - `availableCash` (trading cash)

7. Add validation enums for known values

8. Add `terminated` parameter to orders

### Long Term (Future Enhancement)

9. Add remaining 30+ topics
10. Add ISIN list utility
11. Consider adding blocking API wrapper
12. Add deprecated aliases for backward compat

---

## 9. Appendix: Code Snippets

### A. Device Registration (Python)

```python
def register_new_device(self, processId=None):
    self.signing_key = SigningKey.generate(curve=NIST256p, hashfunc=hashlib.sha512)

    if processId is None:
        r = requests.post(
            f"{self.url}/api/v1/auth/account/reset/device",
            json={"phoneNumber": self.number, "pin": self.pin},
        )
        processId = r.json()["processId"]

    pubkey = base64.b64encode(
        self.signing_key.get_verifying_key().to_string("uncompressed")
    ).decode("ascii")

    token = input("Enter your token: ")

    r = requests.post(
        f"{self.url}/api/v1/auth/account/reset/device/{processId}/key",
        json={"code": token, "deviceKey": pubkey},
    )
```

### B. Signed Request (Python)

```python
def do_request(self, path, payload):
    if self.signing_key is None:
        with open("key", "rb") as f:
            self.signing_key = SigningKey.from_pem(f.read(), hashfunc=hashlib.sha512)

    timestamp = int(time.time() * 1000)
    payload_string = json.dumps(payload)

    signature = self.signing_key.sign(
        bytes(f"{timestamp}.{payload_string}", "utf-8"),
        hashfunc=hashlib.sha512,
        sigencode=sigencode_der,
    )

    headers = dict()
    headers["X-Zeta-Timestamp"] = str(timestamp)
    headers["X-Zeta-Signature"] = base64.b64encode(signature).decode("ascii")
    headers["Content-Type"] = "application/json"

    return requests.request(
        method="POST", url=f"{self.url}{path}", data=payload_string, headers=headers
    )
```

### C. WebSocket Connection (Python)

```python
async def sub(self, payload_key, callback, **kwargs):
    if self.ws is None:
        self.ws = await websockets.connect("wss://api.traderepublic.com")
        msg = json.dumps({"locale": self.locale})
        await self.ws.send(f"connect 21 {msg}")
        response = await self.ws.recv()

        if not response == "connected":
            raise TRapiException(f"Connection Error: {response}")

    payload = kwargs.get("payload", {"type": payload_key})
    payload["token"] = self.sessionToken

    key = kwargs.get("key", payload_key)
    id = self.type_to_id(key)
    if id is None:
        async with self.mu:
            id = str(len(self.dict))
            self.dict[key] = id

    await self.ws.send(f"sub {id} {json.dumps(payload)}")
    self.callbacks[id] = callback
```

### D. Delta Decoding (Python)

```python
def decode_updates(self, key, payload):
    # payload is array of instructions like ['=23', '-5', '+64895']
    # Instructions:
    #   =N  : Keep N characters from previous response
    #   -N  : Skip N characters
    #   +VAL: Insert VAL string

    latest = self.latest_response[key]
    cur = 0
    rsp = ""

    for x in payload:
        instruction = x[0]
        rst = x[1:]

        if instruction == "=":
            num = int(rst)
            rsp += latest[cur: (cur + num)]
            cur += num
        elif instruction == "-":
            cur += int(rst)
        elif instruction == "+":
            rsp += rst
        else:
            raise TRapiException("Error in decode_updates()")

    return rsp
```

---

## 10. Comparison Matrix

| Feature | TradeRepublicApi (Python) | Our Implementation | Match? |
|---------|---------------------------|-------------------|---------|
| **Authentication** |
| Web login | ❌ Not supported | ✅ Supported | ⚠️ Different |
| App login | ✅ With ECDSA signature | ❌ Not supported | ⚠️ Different |
| Device registration | ✅ Explicit flow | ❌ Not implemented | ❌ |
| Request signing | ✅ X-Zeta-Signature | ❌ Not used | ❌ |
| Session refresh | ❌ Not implemented | ✅ Implemented | ⚠️ Different |
| **WebSocket** |
| Protocol version | `21` | `31` | ❌ |
| Connect payload | 1 field | 6 fields | ⚠️ Different |
| Session token | Per subscription | In connect | ⚠️ Different |
| Delta decoding | ✅ Full implementation | ❌ Not implemented | ❌ |
| Response codes | A/D/C/E | A/D/C/E | ✅ |
| **Topics** |
| compactPortfolio | ✅ | ✅ | ✅ |
| cash | ✅ | ✅ | ✅ |
| ticker | ✅ (different payload) | ✅ (different payload) | ⚠️ |
| aggregateHistory | `aggregateHistoryLight` | `aggregateHistory` | ❌ |
| neonSearch | ✅ | ✅ | ⚠️ |
| instrument | ✅ | ✅ | ✅ |
| simpleCreateOrder | ✅ | ✅ | ⚠️ |
| orders | ✅ (with terminated) | ✅ (verify terminated) | ⚠️ |
| cancelOrder | ✅ | ✅ | ✅ |
| portfolio | ✅ | ❌ | ❌ |
| timeline | ✅ | ❌ | ❌ |
| stockDetails | ✅ | ❌ | ❌ |
| watchlist | ✅ | ❌ | ❌ |
| priceAlarms | ✅ | ❌ | ❌ |
| savingsPlans | ✅ | ❌ | ❌ |
| **Validation** |
| Enum lists | ✅ | ❌ | ❌ |
| Zod schemas | ❌ | ✅ | ⚠️ Different approach |
| **Utilities** |
| ISIN list | ✅ | ❌ | ❌ |
| Blocking wrapper | ✅ | ❌ | ⚠️ Design choice |
| Deprecated aliases | ✅ | ❌ | ⚠️ New impl |

**Legend:**
- ✅ = Match or functionally equivalent
- ⚠️ = Different but both valid approaches
- ❌ = Missing or incompatible

---

## Conclusion

Our TypeScript implementation and the TradeRepublicApi Python library target **different authentication methods**:

- **TradeRepublicApi**: Mobile app authentication with ECDSA-signed requests
- **Our Implementation**: Web browser authentication without signatures

This explains many of the differences. Both are valid approaches for different client types.

The **critical issues** are:
1. Missing delta decoding (will break real-time updates)
2. Topic name mismatch (`aggregateHistory` vs `aggregateHistoryLight`)
3. Payload format differences (combined `id` field vs separate fields)

These must be fixed before production use.
