# Task 11: Claude Skill - Combined Implementation Plan

## Overview

This plan merges the best aspects from Plan 1 and Plan 2 for implementing the `trade-republic-trading` Claude Skill. The skill enables autonomous trading on Trade Republic using Claude's reasoning capabilities.

## 1. Directory Structure

```
.claude/skills/trade-republic-trading/
├── SKILL.md           # Main skill definition (~1500 lines)
├── strategies.md      # Trading strategies (~400 lines)
├── indicators.md      # Technical indicators reference (~500 lines)
└── state-schema.md    # State management schema (~300 lines)
```

## 2. SKILL.md Content

### 2.1 Frontmatter

```yaml
---
name: trade-republic-trading
description: Autonomous multi-asset trading with technical and sentiment analysis. Use for trades, market analysis, or position management on Trade Republic.
---
```

### 2.2 Critical Execution Rules

```
## CRITICAL: How to Execute This Skill

DO NOT:
- Write code
- Run npm commands
- Modify the MCP server
- Create scripts or files (except state)

DO:
- Call MCP tools directly
- Make trading decisions
- Manage positions via tools
- Save state to .claude/trading-state.json

You are a TRADER using the API, not a DEVELOPER building it.
```

### 2.3 Configuration Table

| Parameter | Description | Default |
|-----------|-------------|---------|
| Budget | Total session budget in EUR | From args |
| Interval | Analysis cycle interval | 15m |
| Strategy | aggressive / conservative / scalping | aggressive |
| Max Positions | Maximum simultaneous positions | 3 |
| Risk Per Trade | Maximum risk per trade | 2% |
| Max Exposure | Maximum exposure per asset | 33% |
| Dry Run | Simulate without executing | false |

### 2.4 Available MCP Tools

**Portfolio:**
- `get_portfolio` - Current positions with P/L
- `get_cash_balance` - Available EUR balance

**Market Data:**
- `get_price` - Current bid/ask/last price (by ISIN)
- `get_price_history` - Historical OHLCV candles
- `get_order_book` - Order book with spread
- `search_assets` - Search by name/symbol/ISIN
- `get_asset_info` - Detailed instrument info
- `get_market_status` - Market open/closed status
- `wait_for_market` - Wait for market to open

**Technical Analysis:**
- `get_indicators` - Calculate specific indicators
- `get_detailed_analysis` - Comprehensive analysis with signals

**External Data (Free - ADR-011):**
- `get_news` - News articles for ISIN
- `get_sentiment` - Sentiment analysis
- `get_fundamentals` - Company fundamentals (stocks/ETFs)

**Risk Management:**
- `calculate_position_size` - Kelly Criterion sizing
- `get_risk_metrics` - VaR, Sharpe, drawdown

**Execution:**
- `place_order` - Market/limit/stop orders
- `get_orders` - Order history
- `modify_order` - Modify pending orders
- `cancel_order` - Cancel pending orders

### 2.5 Trading Workflow (4 Phases)

**PHASE 1: DATA COLLECTION**
1. Check Portfolio (`get_portfolio`, `get_cash_balance`)
2. Check Market Status (`get_market_status`)
3. Scan Market Opportunities (`search_assets`)
4. Collect Price Data (`get_price_history`)
5. Technical Analysis (`get_detailed_analysis`)
6. Sentiment Analysis (`get_sentiment`, `get_news`)
7. Fundamental Check (`get_fundamentals` for stocks/ETFs)

**PHASE 2: MANAGE EXISTING POSITIONS**
8. Update performance metrics (current prices)
9. Check Stop-Loss thresholds
10. Check Take-Profit thresholds
11. Check Trailing Stop conditions
12. Execute exits if triggered
13. Rebalancing Check (stagnant positions)
14. Apply Compound (after profitable exits)
15. Budget Exhaustion Check

**PHASE 3: NEW ENTRIES**
16. Signal Aggregation (weighted scoring)
17. Apply trade filters (ADX, volatility)
18. Volatility-Based Position Sizing (`calculate_position_size`)
19. Fee & Profit Threshold Check
20. Pre-Trade Liquidity Check (`get_order_book`)
21. Execute Order (`place_order`)
22. Update state with new position

**PHASE 4: REPORT & LOOP**
23. Save state to `.claude/trading-state.json`
24. Output Structured Report
25. Determine sleep duration (market hours aware)
26. Sleep and GOTO PHASE 1

### 2.6 Key Differences from Coinbase Skill

| Aspect | Coinbase | Trade Republic |
|--------|----------|----------------|
| Asset ID | Product ID (BTC-EUR) | ISIN (DE000A0TGJ55) |
| Markets | 24/7 Crypto | European hours + 24/7 crypto |
| Asset Types | Crypto only | Stocks, ETFs, Crypto, Derivatives |
| Order Types | Market, Limit | Market, Limit, Stop-Market |
| Currency | EUR pairs | EUR (German broker) |
| Fundamentals | N/A | Available for stocks/ETFs |

### 2.7 Asset-Specific Considerations

| Asset Type | Market Hours | Fundamentals | Special Notes |
|------------|--------------|--------------|---------------|
| Stocks | 9:00-17:30 CET | Yes | Earnings, dividends |
| ETFs | 9:00-17:30 CET | Yes | Expense ratio |
| Crypto | 24/7 | No | Higher volatility |
| Derivatives | Varies | No | Expiry dates, leverage |

### 2.8 Dynamic Risk Management (ADR-007)

**Stop-Loss Calculation:**
```
dynamicSL = entryPrice - (ATR * 1.5)
// Clamped to min 2.5%, max 10%
```

**Take-Profit Calculation:**
```
dynamicTP = entryPrice + (ATR * 2.5)
```

**Trailing Stop:**
- Activated when unrealized profit >= 3%
- Trail distance = ATR * 1.0
- Only moves up, never down

### 2.9 Order Type Selection (ADR-008)

| Condition | Order Type | Rationale |
|-----------|------------|-----------|
| Signal > 70 | Market | Urgent entry |
| Signal 40-70 | Limit | Patient entry |
| Stop-Loss triggered | Market | Immediate exit |
| Take-Profit triggered | Limit | Optimal exit |

### 2.10 Report Format

```
══════════════════════════════════════════════════════════════════
                    TRADE REPUBLIC TRADING REPORT
══════════════════════════════════════════════════════════════════

SESSION SUMMARY
───────────────────────────────────────────────────────────────────
Session ID:       {id}
Started:          {startTime}
Strategy:         {strategy}
Budget:           {initial} EUR → {remaining} EUR
Realized P&L:     {realizedPnL} EUR ({realizedPnLPercent}%)
Trades:           {wins}W / {losses}L

OPEN POSITIONS
───────────────────────────────────────────────────────────────────
| ISIN           | Name       | Entry  | Current | P&L    | SL/TP |
|----------------|------------|--------|---------|--------|-------|
| {isin}         | {name}     | {entry}| {curr}  | {pnl}% | {sl}  |

TECHNICAL ANALYSIS
───────────────────────────────────────────────────────────────────
{detailed analysis per asset}

ACTIONS TAKEN
───────────────────────────────────────────────────────────────────
{list of actions}

NEXT CYCLE
───────────────────────────────────────────────────────────────────
Next analysis in: {interval}
Market Status:    {open/closed}
══════════════════════════════════════════════════════════════════
```

## 3. strategies.md Content

### 3.1 Signal Categories and Weights

| Category | Weight | Indicators |
|----------|--------|------------|
| Momentum | 25% | RSI, Stochastic |
| Trend | 30% | MACD, SMA, EMA, ADX |
| Volatility | 15% | Bollinger Bands, ATR |
| Volume | 15% | OBV, VWAP |
| Sentiment | 10% | News sentiment, overall |
| Fundamentals | 5% | P/E, analyst ratings (stocks only) |

### 3.2 Strategy Configurations

**Aggressive (Default)**
- Take-Profit: 2.5x ATR (dynamic)
- Stop-Loss: 1.5x ATR (dynamic, min 2.5%, max 10%)
- Min Signal Strength: +40
- ADX Threshold: > 20

**Conservative**
- Take-Profit: 3% (fixed)
- Stop-Loss: 5% (fixed)
- Min Signal Strength: +60
- ADX Threshold: > 25

**Scalping**
- Take-Profit: 1.5% (fixed)
- Stop-Loss: 2% (fixed)
- Focus: Momentum indicators
- Shorter timeframes

### 3.3 Signal Scoring Reference

| Score Range | Signal | Action |
|-------------|--------|--------|
| +60 to +100 | STRONG_BUY | Full position |
| +40 to +59 | BUY | Reduced position |
| -39 to +39 | HOLD | No action |
| -59 to -40 | SELL | Exit if held |
| -100 to -60 | STRONG_SELL | Exit immediately |

### 3.4 Trade Filters

**AVOID Trading When:**
- ADX < 20 (no clear trend)
- ATR > 3x average (extreme volatility)
- Conflicting signals between major categories
- Market closed (for stocks/ETFs)
- Position would exceed 33% exposure
- Available budget < minimum profitable position

**STRENGTHEN Signal When:**
- Multiple categories confirm (3+)
- Volume confirms price movement (OBV alignment)
- Sentiment aligns with technical
- Fundamentals support (for stocks)

### 3.5 Position Sizing

```
1. Base position from signal strength:
   - Strong (>60): 100% of calculated
   - Medium (40-60): 75% of calculated
   - Weak (<40): 50% of calculated

2. Kelly Criterion adjustment:
   kelly = calculate_position_size(...)
   position = MIN(signal_based, kelly)

3. Exposure limits:
   position = MIN(position, 33% of budget)
   position = MIN(position, remaining budget)

4. Profitability check:
   IF position < 67 EUR THEN skip (fees > profit)
```

## 4. indicators.md Content

### 4.1 Available Indicators

**From `get_detailed_analysis`:**
```json
{
  "summary": {
    "overallSignal": "buy" | "sell" | "neutral",
    "confidence": "high" | "medium" | "low",
    "score": -100 to +100
  },
  "trend": {
    "direction": "up" | "down" | "sideways",
    "strength": "strong" | "moderate" | "weak",
    "sma20": number,
    "sma50": number
  },
  "signals": [
    { "name": string, "signal": string, "value": number }
  ],
  "indicators": {
    "rsi": { "value": number, "signal": string },
    "macd": { "value": number, "signal": number, "histogram": number },
    "bollingerBands": { "upper": number, "middle": number, "lower": number, "percentB": number },
    "stochastic": { "k": number, "d": number },
    "adx": { "value": number },
    "atr": { "value": number }
  }
}
```

### 4.2 Indicator Interpretation

**RSI (Relative Strength Index)**
| Value | Interpretation | Score |
|-------|----------------|-------|
| < 30 | Oversold | +2 |
| 30-40 | Slightly oversold | +1 |
| 40-60 | Neutral | 0 |
| 60-70 | Slightly overbought | -1 |
| > 70 | Overbought | -2 |

**MACD**
| Condition | Score |
|-----------|-------|
| Golden Cross (MACD crosses signal up) | +3 |
| MACD > signal + positive histogram | +2 |
| Death Cross (MACD crosses signal down) | -3 |
| MACD < signal + negative histogram | -2 |

**Bollinger Bands (%B)**
| Value | Interpretation | Score |
|-------|----------------|-------|
| < 0 | Below lower band | +2 |
| 0-0.2 | Near lower band | +1 |
| 0.8-1.0 | Near upper band | -1 |
| > 1 | Above upper band | -2 |

**Stochastic**
| Condition | Score |
|-----------|-------|
| %K < 20 AND %K crosses above %D | +2 |
| %K > 80 AND %K crosses below %D | -2 |

**ADX**
| Value | Interpretation | Use |
|-------|----------------|-----|
| < 20 | No trend | Avoid trading |
| 20-25 | Weak trend | Trade cautiously |
| 25-50 | Strong trend | Confirms signals |
| > 50 | Very strong trend | Strong confirmation |

**ATR**
- Used for dynamic SL/TP calculation
- Compare to historical average for volatility assessment
- High ATR = wider stops required

**OBV**
| Condition | Score |
|-----------|-------|
| OBV rising + price rising | +1 (confirmation) |
| OBV falling + price rising | -2 (bearish divergence) |
| OBV rising + price falling | +2 (bullish divergence) |

**VWAP**
| Condition | Score |
|-----------|-------|
| Price above VWAP | +1 (bullish) |
| Price below VWAP | -1 (bearish) |

### 4.3 Null Safety

All indicator values may be `null` if insufficient data. Always check before use:
```
IF indicator.value IS NULL THEN skip this indicator in scoring
```

## 5. state-schema.md Content

### 5.1 State File Location

`.claude/trading-state.json`

### 5.2 Complete Schema

```json
{
  "session": {
    "id": "2026-02-01T10:00:00Z",
    "startTime": "2026-02-01T10:00:00Z",
    "lastUpdated": "2026-02-01T11:30:00Z",
    "budget": {
      "initial": 100.00,
      "remaining": 85.50,
      "currency": "EUR"
    },
    "stats": {
      "tradesOpened": 2,
      "tradesClosed": 1,
      "wins": 1,
      "losses": 0,
      "totalFeesPaid": 3.00,
      "realizedPnL": 8.50,
      "realizedPnLPercent": 8.5
    },
    "config": {
      "strategy": "aggressive",
      "interval": "15m",
      "dryRun": false,
      "allowedAssetTypes": ["stock", "etf", "crypto"]
    },
    "compound": {
      "enabled": true,
      "rate": 0.50,
      "maxBudget": 200.00,
      "paused": false,
      "consecutiveWins": 1,
      "consecutiveLosses": 0,
      "totalCompounded": 4.25
    },
    "rebalancing": {
      "enabled": true,
      "stagnationHours": 12,
      "maxPerDay": 3,
      "rebalancesToday": 0
    }
  },
  "openPositions": [],
  "tradeHistory": []
}
```

### 5.3 Open Position Schema

```json
{
  "id": "pos_20260201_103000_AAPL",
  "isin": "US0378331005",
  "name": "Apple Inc.",
  "assetType": "stock",
  "side": "long",
  "size": 0.5,
  "entry": {
    "price": 182.50,
    "time": "2026-02-01T10:30:00Z",
    "orderType": "limit",
    "fee": 1.00
  },
  "analysis": {
    "signalStrength": 65,
    "technicalScore": 45,
    "sentiment": "bullish",
    "reason": "MACD Golden Cross + Strong fundamentals",
    "confidence": "medium"
  },
  "riskManagement": {
    "entryATR": 3.2,
    "dynamicSL": 164.25,
    "dynamicTP": 197.10,
    "trailingStop": {
      "active": false,
      "currentStopPrice": null,
      "highestPrice": 182.50
    }
  },
  "performance": {
    "currentPrice": null,
    "unrealizedPnL": null,
    "unrealizedPnLPercent": null,
    "peakPnLPercent": 0,
    "holdingTimeHours": null
  }
}
```

### 5.4 Trade History Entry Schema

```json
{
  "id": "trade_20260201_093000_BTC",
  "isin": "XF000BTC0EUR",
  "name": "Bitcoin",
  "assetType": "crypto",
  "side": "long",
  "size": 0.001,
  "entry": {
    "price": 45000.00,
    "time": "2026-02-01T09:30:00Z",
    "orderType": "market",
    "fee": 1.00
  },
  "exit": {
    "price": 46500.00,
    "time": "2026-02-01T11:15:00Z",
    "orderType": "limit",
    "fee": 1.00,
    "trigger": "takeProfit",
    "reason": "Dynamic TP hit at +3.3%"
  },
  "result": {
    "grossPnL": 1.50,
    "netPnL": -0.50,
    "netPnLPercent": -1.1,
    "totalFees": 2.00,
    "holdingTimeHours": 1.75
  }
}
```

### 5.5 State Operations

**Initialize Session:**
1. Parse budget from arguments
2. Set strategy (default: aggressive)
3. Set interval (default: 15m)
4. Initialize stats to 0
5. Save state

**Open Position:**
1. Generate ID: `pos_{YYYYMMDD}_{HHMMSS}_{SYMBOL}`
2. Calculate dynamic SL/TP using ATR
3. Add to openPositions
4. Update session.stats.tradesOpened
5. Deduct from budget.remaining
6. Save state

**Update Position:**
1. Get current price
2. Calculate unrealized P&L
3. Update highestPrice if new high
4. Check trailing stop activation
5. Update holdingTimeHours
6. Save state

**Close Position:**
1. Calculate final P&L
2. Move from openPositions to tradeHistory
3. Update wins/losses count
4. Update realizedPnL
5. Return funds to budget.remaining
6. Apply compound if profitable
7. Save state

## 6. Implementation Sequence

1. Create `.claude/skills/trade-republic-trading/` directory
2. Create `state-schema.md` - Foundation for state management
3. Create `indicators.md` - Reference for technical analysis
4. Create `strategies.md` - Trading strategy configurations
5. Create `SKILL.md` - Main skill definition with trading loop
6. Test skill loading in Claude
7. Test with dry-run mode

## 7. Critical Files

| File | Purpose |
|------|---------|
| `.claude/skills/trade-republic-trading/SKILL.md` | Main skill definition |
| `.claude/skills/trade-republic-trading/strategies.md` | Strategy configurations |
| `.claude/skills/trade-republic-trading/indicators.md` | Indicator interpretation |
| `.claude/skills/trade-republic-trading/state-schema.md` | State management |
| `.claude/trading-state.json` | Runtime state (created by skill) |

## 8. ADR Alignment

| ADR | How Implemented |
|-----|-----------------|
| ADR-004 | Multi-asset support with assetType field |
| ADR-005 | Claude as decision engine, tools provide data |
| ADR-006 | Multi-factor weighted signal aggregation |
| ADR-007 | Kelly Criterion + ATR-based dynamic SL/TP |
| ADR-008 | Order type selection based on signal strength |
| ADR-009 | Interval-based loop + market hours awareness |
| ADR-010 | Same skill architecture as Coinbase |
| ADR-011 | Free data sources (yahoo-finance2, sentiment) |
