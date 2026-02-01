# Task 11: Claude Skill - Final Implementation Plan

**Status:** Verified and Ready for Implementation
**Date:** 2026-02-01

---

## Overview

This is the final, verified implementation plan for the `trade-republic-trading` Claude Skill. The skill enables autonomous trading on Trade Republic using Claude's reasoning capabilities, following the proven architecture from the Coinbase MCP server.

## Files to Create

```
.claude/skills/trade-republic-trading/
├── SKILL.md           # Main skill definition
├── strategies.md      # Trading strategies reference
├── indicators.md      # Technical indicators interpretation
└── state-schema.md    # State management schema
```

---

## 1. SKILL.md

### 1.1 Frontmatter

```yaml
---
name: trade-republic-trading
description: Autonomous multi-asset trading with technical and sentiment analysis. Use for trades, market analysis, or position management on Trade Republic.
---
```

### 1.2 Critical Execution Rules

The skill must clearly state:
- DO NOT: Write code, run npm, modify server, create scripts
- DO: Call MCP tools directly, make trading decisions, manage state
- Identity: "You are a TRADER using the API, not a DEVELOPER building it"

### 1.3 Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| Budget | Total session budget in EUR | From args |
| Interval | Analysis cycle interval | 15m |
| Strategy | aggressive / conservative / scalping | aggressive |
| Max Positions | Maximum simultaneous positions | 3 |
| Risk Per Trade | Maximum risk per trade | 2% |
| Max Exposure | Maximum exposure per asset | 33% |
| Dry Run | Simulate without executing | false |

### 1.4 Available MCP Tools

Document all tools from the MCP server:

**Portfolio:** `get_portfolio`, `get_cash_balance`
**Market Data:** `get_price`, `get_price_history`, `get_order_book`, `search_assets`, `get_asset_info`, `get_market_status`, `wait_for_market`
**Technical Analysis:** `get_indicators`, `get_detailed_analysis`
**External Data:** `get_news`, `get_sentiment`, `get_fundamentals`
**Risk Management:** `calculate_position_size`, `get_risk_metrics`
**Execution:** `place_order`, `get_orders`, `modify_order`, `cancel_order`

### 1.5 Trading Workflow (4 Phases)

**PHASE 1: DATA COLLECTION**
1. Check portfolio and cash balance
2. Check market status for each asset type
3. Scan opportunities with `search_assets`
4. Get price history for candidates
5. Run `get_detailed_analysis` for technical signals
6. Get sentiment via `get_sentiment`, `get_news`
7. Get fundamentals for stocks/ETFs

**PHASE 2: MANAGE EXISTING POSITIONS**
8. Update performance metrics
9. Check SL/TP/Trailing conditions
10. Execute exits if triggered
11. Check rebalancing opportunities
12. Apply compound after profitable exits
13. Check budget exhaustion

**PHASE 3: NEW ENTRIES**
14. Aggregate signals (weighted scoring)
15. Apply trade filters
16. Calculate position size with `calculate_position_size`
17. Check fee/profit threshold
18. Check liquidity with `get_order_book`
19. Execute order with `place_order`
20. Update state

**PHASE 4: REPORT & LOOP**
21. Save state to `.claude/trading-state.json`
22. Output structured report
23. Determine sleep duration (market hours aware)
24. Sleep and repeat

### 1.6 Trade Republic Specifics

| Aspect | Implementation |
|--------|----------------|
| Asset ID | ISIN (e.g., DE000A0TGJ55) |
| Markets | European hours for stocks/ETFs, 24/7 for crypto |
| Asset Types | stocks, etfs, crypto, derivatives |
| Order Types | market, limit, stop-market |
| Currency | EUR |
| Fee Structure | Flat fees (simpler than Coinbase) |

### 1.7 Asset-Specific Handling

| Asset | Market Hours | Fundamentals | Notes |
|-------|--------------|--------------|-------|
| Stocks | 9:00-17:30 CET | Yes | Earnings, dividends |
| ETFs | 9:00-17:30 CET | Yes | Expense ratio |
| Crypto | 24/7 | No | Higher volatility |
| Derivatives | Varies | No | Expiry, leverage |

### 1.8 Risk Management (ADR-007)

**Dynamic Stop-Loss:**
```
dynamicSL = entryPrice - (ATR * 1.5)
Clamped: min 2.5%, max 10%
```

**Dynamic Take-Profit:**
```
dynamicTP = entryPrice + (ATR * 2.5)
```

**Trailing Stop:**
- Activated at +3% unrealized profit
- Trail distance = ATR * 1.0
- Only moves up

### 1.9 Order Type Selection (ADR-008)

| Condition | Order Type |
|-----------|------------|
| Signal > 70 | Market |
| Signal 40-70 | Limit |
| Stop-Loss exit | Market |
| Take-Profit exit | Limit |

### 1.10 Report Format

```
══════════════════════════════════════════════════════════════════
                    TRADE REPUBLIC TRADING REPORT
══════════════════════════════════════════════════════════════════
SESSION: {id} | Strategy: {strategy} | Budget: {remaining}/{initial} EUR
P&L: {realizedPnL} EUR ({realizedPnLPercent}%) | Trades: {wins}W/{losses}L
──────────────────────────────────────────────────────────────────
OPEN POSITIONS
| ISIN | Name | Entry | Current | P&L | SL/TP |
──────────────────────────────────────────────────────────────────
ACTIONS: {list of actions taken}
NEXT CYCLE: {interval} | Market: {status}
══════════════════════════════════════════════════════════════════
```

---

## 2. strategies.md

### 2.1 Signal Categories and Weights

| Category | Weight | Indicators |
|----------|--------|------------|
| Momentum | 25% | RSI, Stochastic |
| Trend | 30% | MACD, SMA, EMA, ADX |
| Volatility | 15% | Bollinger Bands, ATR |
| Volume | 15% | OBV, VWAP |
| Sentiment | 10% | News, overall sentiment |
| Fundamentals | 5% | P/E, analyst ratings |

### 2.2 Strategy Configurations

**Aggressive (Default)**
- TP: 2.5x ATR | SL: 1.5x ATR (2.5%-10%)
- Min Signal: +40 | ADX > 20

**Conservative**
- TP: 3% | SL: 5%
- Min Signal: +60 | ADX > 25

**Scalping**
- TP: 1.5% | SL: 2%
- Focus: Momentum | Short timeframes

### 2.3 Signal Scoring

| Score | Signal | Action |
|-------|--------|--------|
| +60 to +100 | STRONG_BUY | Full position |
| +40 to +59 | BUY | Reduced position |
| -39 to +39 | HOLD | No action |
| -59 to -40 | SELL | Exit if held |
| -100 to -60 | STRONG_SELL | Exit immediately |

### 2.4 Trade Filters

**AVOID:**
- ADX < 20
- ATR > 3x average
- Conflicting signals
- Market closed (stocks/ETFs)
- Exposure > 33%
- Budget < minimum

**STRENGTHEN:**
- 3+ categories confirm
- Volume confirms
- Sentiment aligns
- Fundamentals support

### 2.5 Position Sizing

```
1. Base from signal: Strong=100%, Medium=75%, Weak=50%
2. Kelly adjustment: MIN(signal_based, kelly_result)
3. Exposure limit: MIN(position, 33% budget)
4. Profitability: Skip if < 67 EUR
```

---

## 3. indicators.md

### 3.1 get_detailed_analysis Output

```json
{
  "summary": { "overallSignal", "confidence", "score" },
  "trend": { "direction", "strength", "sma20", "sma50" },
  "signals": [{ "name", "signal", "value" }],
  "indicators": {
    "rsi": { "value", "signal" },
    "macd": { "value", "signal", "histogram" },
    "bollingerBands": { "upper", "middle", "lower", "percentB" },
    "stochastic": { "k", "d" },
    "adx": { "value" },
    "atr": { "value" }
  }
}
```

### 3.2 Indicator Interpretation

**RSI:** <30 = +2, 30-40 = +1, 40-60 = 0, 60-70 = -1, >70 = -2
**MACD:** Golden Cross = +3, Above signal = +2, Death Cross = -3, Below signal = -2
**Bollinger %B:** <0 = +2, 0-0.2 = +1, 0.8-1 = -1, >1 = -2
**Stochastic:** %K<20 cross up = +2, %K>80 cross down = -2
**ADX:** <20 avoid, 20-25 cautious, 25-50 strong, >50 very strong
**OBV:** Rising+price rising = +1, Falling+price rising = -2, Rising+price falling = +2

### 3.3 Null Safety

All indicators may return null with insufficient data. Always check:
```
IF indicator.value IS NULL THEN skip in scoring
```

---

## 4. state-schema.md

### 4.1 File Location

`.claude/trading-state.json`

### 4.2 Session Schema

```json
{
  "session": {
    "id": "ISO timestamp",
    "startTime": "ISO timestamp",
    "lastUpdated": "ISO timestamp",
    "budget": { "initial": number, "remaining": number, "currency": "EUR" },
    "stats": {
      "tradesOpened": number,
      "tradesClosed": number,
      "wins": number,
      "losses": number,
      "totalFeesPaid": number,
      "realizedPnL": number,
      "realizedPnLPercent": number
    },
    "config": {
      "strategy": "aggressive|conservative|scalping",
      "interval": "5m|15m|1h",
      "dryRun": boolean,
      "allowedAssetTypes": ["stock", "etf", "crypto"]
    },
    "compound": {
      "enabled": boolean,
      "rate": number,
      "maxBudget": number,
      "totalCompounded": number
    },
    "rebalancing": {
      "enabled": boolean,
      "stagnationHours": number,
      "maxPerDay": number,
      "rebalancesToday": number
    }
  },
  "openPositions": [],
  "tradeHistory": []
}
```

### 4.3 Position Schema

```json
{
  "id": "pos_{date}_{time}_{symbol}",
  "isin": "ISIN code",
  "name": "Human readable name",
  "assetType": "stock|etf|crypto|derivative",
  "side": "long",
  "size": number,
  "entry": {
    "price": number,
    "time": "ISO timestamp",
    "orderType": "market|limit|stop-market",
    "fee": number
  },
  "analysis": {
    "signalStrength": number,
    "technicalScore": number,
    "sentiment": "bullish|neutral|bearish",
    "reason": "string",
    "confidence": "high|medium|low"
  },
  "riskManagement": {
    "entryATR": number,
    "dynamicSL": number,
    "dynamicTP": number,
    "trailingStop": {
      "active": boolean,
      "currentStopPrice": number|null,
      "highestPrice": number
    }
  },
  "performance": {
    "currentPrice": number|null,
    "unrealizedPnL": number|null,
    "unrealizedPnLPercent": number|null,
    "peakPnLPercent": number,
    "holdingTimeHours": number|null
  }
}
```

### 4.4 Trade History Entry Schema

```json
{
  "id": "trade_{date}_{time}_{symbol}",
  "isin": "ISIN code",
  "name": "Human readable name",
  "assetType": "stock|etf|crypto|derivative",
  "side": "long",
  "size": number,
  "entry": { "price", "time", "orderType", "fee" },
  "exit": { "price", "time", "orderType", "fee", "trigger", "reason" },
  "result": {
    "grossPnL": number,
    "netPnL": number,
    "netPnLPercent": number,
    "totalFees": number,
    "holdingTimeHours": number
  }
}
```

### 4.5 State Operations

| Operation | Steps |
|-----------|-------|
| Initialize | Parse args, set defaults, create state |
| Open Position | Generate ID, calc SL/TP, add to openPositions, deduct budget |
| Update Position | Get price, calc P&L, update trailing, update time |
| Close Position | Calc final P&L, move to history, update stats, compound |

---

## 5. Implementation Sequence

1. **Create directory:** `.claude/skills/trade-republic-trading/`
2. **Create state-schema.md** - Foundation for state management
3. **Create indicators.md** - Technical analysis reference
4. **Create strategies.md** - Strategy configurations
5. **Create SKILL.md** - Main skill with trading loop
6. **Test skill loading** - Verify Claude loads the skill
7. **Test dry-run** - Verify logic without real trades

---

## 6. ADR Alignment Checklist

- [x] ADR-004: Multi-asset support (assetType field)
- [x] ADR-005: Claude as decision engine
- [x] ADR-006: Multi-factor weighted signals
- [x] ADR-007: Kelly Criterion + ATR-based SL/TP
- [x] ADR-008: Smart order routing
- [x] ADR-009: Interval loop + market hours
- [x] ADR-010: Same architecture as Coinbase skill
- [x] ADR-011: Free data sources

---

## 7. Verification Notes

This plan has been verified for:
- Completeness against Task 11 requirements
- Consistency with existing ADRs
- Alignment with Coinbase skill architecture
- Coverage of all MCP tools
- Proper Trade Republic adaptations (ISIN, market hours, multi-asset)

**Ready for implementation.**
