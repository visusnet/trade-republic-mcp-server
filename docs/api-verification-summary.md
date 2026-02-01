# Trade Republic API Verification Summary

**Verification Date:** 2026-02-01
**Task:** Compare our implementation against TradeRepublicApi Python library (354 stars)
**Result:** Different authentication methods, critical issues identified

---

## Quick Status

| Category | Status | Notes |
|----------|--------|-------|
| Authentication | ⚠️ DIFFERENT | We use web login, Python uses app login |
| WebSocket Protocol | ❌ CRITICAL ISSUES | Missing delta decoding, different versions |
| Topic Coverage | ⚠️ PARTIAL | 9 topics vs 40+, different payloads |
| Overall | ⚠️ NEEDS FIXES | 3 critical issues must be fixed |

---

## Critical Findings

### 1. ❌ Missing Delta Decoding (CRITICAL)

**Impact:** Real-time updates will fail

Both pytr and TradeRepublicApi implement delta message decoding for WebSocket messages with code 'D'. Our implementation completely lacks this feature.

**Example Delta:**
```
Previous: {"bid":{"price":13.873},"ask":{"price":13.915}}
Delta: ['=23', '-5', '+64895', '=14']
Result: {"bid":{"price":64.895},"ask":{"price":13.915}}
```

**Fix Required:** Implement `calculateDelta()` method with previous response tracking.

**Reference:** `/Users/rosea/Development/trade-republic-bot/docs/api-comparison-traderepublicapi.md` Section 2.6

---

### 2. ❌ Topic Name Mismatch (CRITICAL)

**Impact:** Historical data requests may fail

**TradeRepublicApi:** Uses `aggregateHistoryLight`
**Our Implementation:** Uses `aggregateHistory`

**Fix Required:** Change topic name to `aggregateHistoryLight` and add `resolution` parameter.

---

### 3. ❌ Payload Format Differences (HIGH)

**Impact:** API may reject our requests

**Example - ticker topic:**

TradeRepublicApi:
```json
{
  "type": "ticker",
  "id": "US62914V1061.LSX",
  "token": "session_token"
}
```

Our Implementation:
```json
{
  "type": "ticker",
  "isin": "US62914V1061",
  "exchange": "LSX"
}
```

**Fix Required:** Use combined `id` field with format `{isin}.{exchange}` for all market data topics.

---

## Authentication Differences

### ⚠️ Different Client Types (NOT AN ISSUE)

**TradeRepublicApi (Python):** Mobile app authentication
- Uses `/api/v1/auth/login` endpoint
- Requires ECDSA signatures on all requests (X-Zeta-Timestamp, X-Zeta-Signature headers)
- Includes device registration flow

**Our Implementation (TypeScript):** Web browser authentication
- Uses `/auth/web/login` endpoint
- No request signing required
- Simpler 2FA flow

**Conclusion:** Both are valid approaches for different client types. No changes needed.

---

## WebSocket Protocol Differences

### ⚠️ Protocol Version (NEEDS TESTING)

**TradeRepublicApi:** Uses `connect 21`
**Our Implementation:** Uses `connect 31`

**Action Required:** Test if version 31 works correctly or switch to version 21.

### ⚠️ Session Token Placement (NEEDS TESTING)

**TradeRepublicApi:** Sends token in every subscription payload
**Our Implementation:** Sends token once in connect message

**Hypothesis:** Protocol version 21 (app) requires token per subscription, version 31 (web) accepts token in connect message.

**Action Required:** Verify our approach works in production.

---

## Missing Topics

**We have:** 9 topics
**Python has:** 40+ topics

### High Priority Missing Topics

1. `portfolio` - Full portfolio details (not just compact)
2. `timeline` - Transaction history
3. `timelineDetail` - Transaction details
4. `stockDetails` - Detailed stock information
5. `availableCash` - Available cash for trading
6. `neonNews` - News for instruments

### Nice to Have

7. `watchlist` - Watchlist management
8. `priceAlarms` - Price alerts
9. `portfolioAggregateHistory` - Performance over time
10. Savings plans (3 topics)

**Impact:** Reduced feature set but sufficient for core trading functionality.

---

## Missing Features

### ⚠️ Validation Lists

TradeRepublicApi provides validation enums:
```python
exchange_list = ["LSX", "TDG", "LUS", "TUB", "BHS", "B2C"]
range_list = ["1d", "5d", "1m", "3m", "1y", "max"]
instrument_list = ["stock", "fund", "derivative", "crypto"]
jurisdiction_list = ["AT", "DE", "ES", "FR", "IT", "NL", "BE", "EE", "FI", "IE", "GR", "LU", "LT", "LV", "PT", "SI", "SK"]
expiry_list = ["gfd", "gtd", "gtc"]
order_type_list = ["buy", "sell"]
```

**Our Implementation:** Uses Zod schemas but no explicit enum validation.

**Fix:** Add Zod enum schemas with these known values.

---

### ⚠️ Other Missing Features

- **ISIN list utility** - Python includes 39,849 bytes of ISINs
- **Blocking API wrapper** - Python provides synchronous wrappers
- **Deprecated aliases** - Python maintains backward compatibility

**Impact:** Nice to have, not required for core functionality.

---

## Recommended Actions

### Immediate (Before Production)

1. **Implement delta decoding** (CRITICAL)
   - Add `previousResponses` Map
   - Implement `calculateDelta()` method
   - Handle '=', '-', '+' instructions

2. **Fix topic name** (CRITICAL)
   - Change `aggregateHistory` → `aggregateHistoryLight`
   - Add `resolution` parameter (default: 604800000 = 7 days)

3. **Fix payload formats** (HIGH)
   - Change `{isin, exchange}` → `{id: "isin.exchange"}`
   - Apply to: ticker, aggregateHistoryLight, all market data topics

4. **Test protocol version** (HIGH)
   - Verify version 31 works
   - Fallback to version 21 if needed

5. **Test session token placement** (HIGH)
   - Confirm connect message token is sufficient
   - Add token to subscriptions if required

### Short Term (Post-MVP)

6. Add missing high-priority topics (portfolio, timeline, stockDetails, etc.)
7. Add validation enum schemas
8. Verify and document all payload structures

### Long Term (Future)

9. Add remaining 30+ topics
10. Add ISIN list utility
11. Consider blocking API wrapper

---

## Verification Evidence

**Source Repository:** https://github.com/Zarathustra2/TradeRepublicApi (master branch)
**Main File:** `trapi/api.py` (996 lines)
**Analysis Date:** 2026-02-01
**Method:** Direct source code comparison

**Detailed Report:** `/Users/rosea/Development/trade-republic-bot/docs/api-comparison-traderepublicapi.md`

---

## Related Findings

This verification complements the earlier pytr comparison (Task 13). Both Python libraries:
- Implement delta decoding (we don't)
- Use different payload formats
- Support more topics

The key difference is **authentication method**:
- pytr: Web login (like us)
- TradeRepublicApi: App login (different)

Both comparisons confirm the same critical issue: **missing delta decoding**.

---

## Success Metrics

After implementing fixes:
- ✅ Delta messages decode correctly
- ✅ Historical data requests succeed
- ✅ Real-time ticker updates work
- ✅ Order placement succeeds
- ✅ All 9 core topics functional

---

## Conclusion

Our implementation is fundamentally sound but has **3 critical issues** that will cause failures:

1. Missing delta decoding
2. Wrong topic name for historical data
3. Wrong payload format for market data

These can be fixed with targeted changes to:
- `TradeRepublicApiService.websocket.ts` (delta decoding)
- `MarketDataService.ts` (topic name and payload format)

After fixes, our implementation should be production-ready for the 9 core topics we support.
