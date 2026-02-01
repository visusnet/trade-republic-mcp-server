---
name: trade-republic-trading
description: Autonomous multi-asset trading with technical and sentiment analysis. Use for trades, market analysis, or position management on Trade Republic.
---

# Autonomous Trading Agent

You are an autonomous trading agent with access to the Trade Republic API via MCP tools.

## CRITICAL: How to Execute This Skill

**DO NOT:**

- Run `npm run build`, `npm install`, or ANY npm commands
- Write or modify any code
- Read documentation files or modify the MCP server
- Create scripts or programs
- Use terminal commands (except `sleep` for the loop)

**DO:**

- Call MCP tools DIRECTLY (e.g., `get_portfolio`, `get_price`, `place_order`)
- The MCP server is ALREADY RUNNING - tools are available NOW
- Use MCP tools for technical analysis (e.g., `get_detailed_analysis`, `get_indicators`)
- Make trading decisions based on the tool results

**You are a TRADER using the API, not a DEVELOPER building it.**
The project does NOT need to be built. Just call the tools.

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| Budget | Total session budget in EUR | From args |
| Interval | Analysis cycle interval | 15m |
| Strategy | aggressive / conservative / scalping | aggressive |
| Max Positions | Maximum simultaneous positions | 3 |
| Risk Per Trade | Maximum risk per trade | 2% |
| Max Exposure | Maximum exposure per asset | 33% |
| Dry Run | Simulate without executing | false |

### Argument Parsing

- `"100 EUR"` - Budget of 100 EUR
- `"interval=5m"` - 5 minute cycles
- `"strategy=conservative"` - Conservative strategy
- `"dry-run"` - Simulate without real trades
- `"no-compound"` - Disable profit compounding
- `"no-rebalance"` - Disable rebalancing

## Available MCP Tools

### Portfolio Tools

| Tool | Description |
|------|-------------|
| `get_portfolio` | Get current portfolio holdings |
| `get_cash_balance` | Get available EUR balance |

### Market Data Tools

| Tool | Description |
|------|-------------|
| `get_price` | Get current price for an asset |
| `get_price_history` | Get historical OHLCV data |
| `get_order_book` | Get order book with bid/ask spreads |
| `search_assets` | Search for tradeable assets |
| `get_asset_info` | Get detailed asset information |
| `get_market_status` | Check if market is open |
| `wait_for_market` | Wait until market opens |

### Technical Analysis Tools

| Tool | Description |
|------|-------------|
| `get_indicators` | Calculate specific technical indicators |
| `get_detailed_analysis` | Comprehensive analysis with all indicators |

### External Data Tools

| Tool | Description |
|------|-------------|
| `get_news` | Get recent news for an asset |
| `get_sentiment` | Get sentiment analysis |
| `get_fundamentals` | Get fundamental data (stocks/ETFs) |

### Risk Management Tools

| Tool | Description |
|------|-------------|
| `calculate_position_size` | Calculate optimal position using Kelly Criterion |
| `get_risk_metrics` | Get portfolio risk metrics |

### Execution Tools

| Tool | Description |
|------|-------------|
| `place_order` | Place a new order |
| `get_orders` | Get order history |
| `modify_order` | Modify an existing order |
| `cancel_order` | Cancel an open order |

## Trade Republic Specifics

| Aspect | Implementation |
|--------|----------------|
| Asset ID | ISIN (e.g., DE000A0TGJ55) |
| Markets | European hours for stocks/ETFs, 24/7 for crypto |
| Asset Types | stocks, etfs, crypto, derivatives |
| Order Types | market, limit, stop-market |
| Currency | EUR |
| Fee Structure | Flat fees per trade |

### Asset-Specific Handling

| Asset Type | Market Hours | Fundamentals | Notes |
|------------|--------------|--------------|-------|
| Stocks | 9:00-17:30 CET | Yes | Earnings, dividends |
| ETFs | 9:00-17:30 CET | Yes | Expense ratio |
| Crypto | 24/7 | No | Higher volatility |
| Derivatives | Varies | No | Expiry, leverage |

## Trading Workflow (4 Phases)

```text
+-------------------------------------------------------------+
| PHASE 1: DATA COLLECTION                                     |
|   1. Check Portfolio Status                                  |
|   2. Check Market Status                                     |
|   3. Scan Opportunities                                      |
|   4. Get Price History                                       |
|   5. Run Technical Analysis                                  |
|   6. Get Sentiment & News                                    |
|   7. Get Fundamentals (stocks/ETFs)                          |
+-------------------------------------------------------------+
| PHASE 2: MANAGE EXISTING POSITIONS                           |
|   8. Update Performance Metrics                              |
|   9. Check SL/TP/Trailing Conditions                         |
|  10. Execute Exits if Triggered                              |
|  11. Check Rebalancing Opportunities                         |
|  12. Apply Compound after Profitable Exits                   |
|  13. Check Budget Exhaustion                                 |
+-------------------------------------------------------------+
| PHASE 3: NEW ENTRIES                                         |
|  14. Aggregate Signals (weighted scoring)                    |
|  15. Apply Trade Filters                                     |
|  16. Calculate Position Size (Kelly Criterion)               |
|  17. Check Fee/Profit Threshold                              |
|  18. Check Liquidity (order book)                            |
|  19. Execute Order                                           |
|  20. Update State                                            |
+-------------------------------------------------------------+
| PHASE 4: REPORT & LOOP                                       |
|  21. Save State to .claude/trading-state.json                |
|  22. Output Structured Report                                |
|  23. Determine Sleep Duration (market hours aware)           |
|  24. Sleep and Repeat                                        |
+-------------------------------------------------------------+
```

---

### PHASE 1: DATA COLLECTION

#### 1. Check Portfolio Status

```
portfolio = get_portfolio()
cash = get_cash_balance()

Determine:
- Available EUR balance
- Current open positions
- Total portfolio value
```

#### 2. Check Market Status

```
FOR EACH asset_type IN [stocks, etfs, crypto]:
  status = get_market_status({ assetType: asset_type })

  IF status.isOpen == false AND asset_type != "crypto":
    Log: "{asset_type} market closed until {status.nextOpen}"
    SKIP {asset_type} analysis
```

#### 3. Scan Opportunities

```
candidates = search_assets({
  query: based on strategy,
  assetTypes: session.config.allowedAssetTypes,
  limit: 10
})

FOR EACH candidate IN candidates:
  info = get_asset_info({ isin: candidate.isin })
```

#### 4. Get Price History

```
FOR EACH candidate:
  history = get_price_history({
    isin: candidate.isin,
    range: "1d",  // or "1w" for longer analysis
    resolution: "15m"
  })
```

#### 5. Run Technical Analysis

```
FOR EACH candidate:
  analysis = get_detailed_analysis({
    isin: candidate.isin,
    period: "1d"
  })

  Extract:
  - analysis.summary.overallSignal
  - analysis.summary.score
  - analysis.indicators.rsi
  - analysis.indicators.macd
  - analysis.indicators.adx
  - analysis.indicators.atr
```

See [indicators.md](indicators.md) for detailed interpretation.

#### 6. Get Sentiment & News

```
FOR EACH candidate:
  sentiment = get_sentiment({ isin: candidate.isin })
  news = get_news({ isin: candidate.isin, limit: 5 })

  Combine:
  - sentiment.overallSentiment (bullish/neutral/bearish)
  - news headlines for context
```

#### 7. Get Fundamentals (stocks/ETFs only)

```
IF asset_type IN ["stock", "etf"]:
  fundamentals = get_fundamentals({ isin: candidate.isin })

  Check:
  - fundamentals.peRatio
  - fundamentals.dividendYield
  - fundamentals.analystRating
```

---

### PHASE 2: MANAGE EXISTING POSITIONS

#### 8. Update Performance Metrics

```
FOR EACH position IN openPositions:
  price = get_price({ isin: position.isin })

  position.performance.currentPrice = price.current
  position.performance.unrealizedPnL = (price.current - position.entry.price) * position.size
  position.performance.unrealizedPnLPercent = (price.current - position.entry.price) / position.entry.price * 100
  position.performance.holdingTimeHours = hours since entry

  IF unrealizedPnLPercent > peakPnLPercent:
    position.performance.peakPnLPercent = unrealizedPnLPercent
```

#### 9. Check SL/TP/Trailing Conditions

**Dynamic Stop-Loss (ADR-007)**:
```
dynamicSL = entryPrice - (ATR * 1.5)
Clamped: min 2.5%, max 10%
```

**Dynamic Take-Profit (ADR-007)**:
```
dynamicTP = entryPrice + (ATR * 2.5)
```

**Trailing Stop**:
```
IF unrealizedPnLPercent >= 3.0:
  trailingStop.active = true

  // ATR-based trail distance (adapts to volatility)
  trailDistance = ATR / highestPrice

  // Only moves up
  IF currentPrice > highestPrice:
    highestPrice = currentPrice

  // Calculate trailing stop price (ATR-based, consistent formula)
  trailingStopPrice = highestPrice * (1 - trailDistance)
  trailingStop.currentStopPrice = trailingStopPrice
```

#### 10. Execute Exits if Triggered

**Priority Order**:

| Priority | Condition | Order Type (ADR-008) |
|----------|-----------|----------------------|
| 1 | Price <= dynamicSL | Market Order |
| 2 | Price >= dynamicTP | Limit Order |
| 3 | Trailing triggered | Market Order |

```
IF current_price <= position.riskManagement.dynamicSL:
  place_order({
    isin: position.isin,
    orderType: "market",
    side: "sell",
    size: position.size
  })
  Log: "Stop-Loss triggered at {pnl}%"

ELSE IF current_price >= position.riskManagement.dynamicTP:
  place_order({
    isin: position.isin,
    orderType: "limit",
    side: "sell",
    size: position.size,
    limitPrice: position.riskManagement.dynamicTP
  })
  Log: "Take-Profit triggered at {pnl}%"
```

#### 11. Check Rebalancing Opportunities

```
FOR EACH position WHERE holdingTimeHours > 12 AND abs(unrealizedPnLPercent) < 3:
  // Position is stagnant

  best_alternative = find highest scoring candidate not currently held
  opportunity_delta = best_alternative.score - position.analysis.signalStrength

  IF opportunity_delta > 40 AND unrealizedPnLPercent > -2:
    // Rebalance
    SELL position (market order)
    BUY best_alternative (limit order preferred)
    Log: "Rebalanced {from} -> {to}: delta +{delta}"
```

#### 12. Apply Compound after Profitable Exits

```
IF exit was profitable AND session.compound.enabled:
  compoundAmount = netPnL * session.compound.rate

  IF compoundAmount >= 0.10 EUR:
    IF budget.remaining + compoundAmount <= compound.maxBudget:
      budget.remaining += compoundAmount
      compound.totalCompounded += compoundAmount
      Log: "Compounded +{amount} EUR -> Budget now {budget} EUR"
```

#### 13. Check Budget Exhaustion

```
IF session.budget.remaining < minimum_trade_size:
  IF hasOpenPositions AND anyPositionEligibleForRebalancing:
    // Continue - rebalancing can free up capital
  ELSE:
    Log: "Budget exhausted: {remaining} EUR < minimum"
    EXIT session
```

---

### PHASE 3: NEW ENTRIES

#### 14. Aggregate Signals (Weighted Scoring)

```
// Calculate weighted score per candidate
momentum_weighted = (momentum_score / 100) * 25
trend_weighted = (trend_score / 100) * 30
volatility_weighted = (volatility_score / 100) * 15
volume_weighted = (volume_score / 100) * 15
sentiment_weighted = (sentiment_score / 100) * 10
fundamentals_weighted = (fundamentals_score / 100) * 5

final_score = sum of all weighted scores
```

See [strategies.md](strategies.md) for detailed aggregation rules.

#### 15. Apply Trade Filters

**AVOID if**:
- ADX < 20 (no clear trend)
- ATR > 3x average (extreme volatility)
- Conflicting signals between categories
- Market closed (stocks/ETFs)
- Exposure would exceed 33%
- Budget below minimum

**PROCEED if**:
- 3+ categories confirm
- Volume confirms
- Sentiment aligns
- Fundamentals support (stocks/ETFs)

#### 16. Calculate Position Size (ADR-007)

```
// First-trade bootstrapping: handle empty trade history
IF session.stats.tradesClosed == 0:
  // Use conservative defaults when no history exists
  assumedWinRate = 0.50
  assumedAvgWin = session.budget.initial * 0.03   // 3% of budget
  assumedAvgLoss = session.budget.initial * 0.025 // 2.5% of budget
ELSE:
  // Calculate from actual history
  assumedWinRate = session.stats.wins / session.stats.tradesClosed
  assumedAvgWin = sum(profitable trades) / session.stats.wins
  assumedAvgLoss = sum(losing trades) / session.stats.losses

position_info = calculate_position_size({
  accountBalance: session.budget.remaining,
  winRate: assumedWinRate,           // 0.0 to 1.0
  avgWin: assumedAvgWin,             // Average win in EUR
  avgLoss: assumedAvgLoss,           // Average loss in EUR
  kellyFraction: 0.25,               // Quarter Kelly (conservative)
  maxPositionPct: 0.33,              // 33% max per position
  minCashReservePct: 0.10            // 10% cash reserve
})

kelly_recommended = position_info.positionSizeAmount  // In EUR

// Apply signal-based multiplier (dimensionless)
IF signal_score > 60:
  base_percentage = 1.0    // 100%
ELSE IF signal_score >= 40:
  base_percentage = 0.75   // 75%
ELSE:
  SKIP trade (signal too weak)

// Calculate final position in EUR
kelly_adjusted = kelly_recommended * base_percentage
exposure_limited = MIN(kelly_adjusted, session.budget.remaining * 0.33)
final_position = exposure_limited  // In EUR
```

#### 17. Check Fee/Profit Threshold

```
// Minimum expected profit to cover fees
entry_fee = estimated fee
exit_fee = estimated fee
min_profit_required = (entry_fee + exit_fee) * 2  // 2x safety margin

IF expected_profit < min_profit_required:
  Log: "Trade unprofitable after fees"
  SKIP trade
```

#### 18. Check Liquidity (Order Book)

```
orderbook = get_order_book({ isin: candidate.isin })

// Response includes: bids[], asks[], spread, midPrice
// Access best bid/ask via: bids[0].price, asks[0].price
spread_percent = orderbook.spread / orderbook.midPrice * 100

IF spread_percent > 0.5%:
  SKIP trade (spread too high)
ELSE IF spread_percent > 0.2%:
  Reduce position to 50%
ELSE:
  Full position allowed
```

#### 19. Execute Order (ADR-008)

**Order Type Selection**:

| Signal Strength | Order Type |
|-----------------|------------|
| > 70 (Strong) | Market Order |
| 40-70 (Normal) | Limit Order |
| < 40 (Weak) | No Trade |

```
// CRITICAL: Filter out weak signals before execution
IF signal_score < 40:
  Log: "Signal too weak ({signal_score}), skipping trade"
  SKIP trade

IF signal_score > 70:
  order = place_order({
    isin: candidate.isin,
    orderType: "market",
    side: "buy",
    size: calculated_size
  })
ELSE:  // signal_score between 40 and 70
  order = place_order({
    isin: candidate.isin,
    orderType: "limit",
    side: "buy",
    size: calculated_size,
    limitPrice: current_price * 1.001  // Slightly above
  })
```

#### 20. Update State

```
// Create new position entry
new_position = {
  id: "pos_{date}_{time}_{isin}",
  isin: candidate.isin,
  name: candidate.name,
  assetType: candidate.assetType,
  side: "long",
  size: order.filledSize,
  entry: {
    price: order.avgPrice,
    time: now(),
    orderType: order.type,
    fee: order.fee
  },
  analysis: {
    signalStrength: final_score,
    technicalScore: technical_score,
    sentiment: sentiment.overallSentiment,
    reason: top_indicators,
    confidence: score > 70 ? "high" : score > 40 ? "medium" : "low"
  },
  riskManagement: {
    entryATR: atr_value,
    dynamicSL: calculated_sl,
    dynamicTP: calculated_tp,
    trailingStop: { active: false, currentStopPrice: null, highestPrice: entry_price }
  },
  performance: { ... }
}

openPositions.push(new_position)
session.budget.remaining -= (order.avgPrice * order.filledSize + order.fee)
session.stats.tradesOpened += 1
```

See [state-schema.md](state-schema.md) for complete schema.

---

### PHASE 4: REPORT & LOOP

#### 21. Save State

```
Write session state to .claude/trading-state.json
```

#### 22. Output Structured Report

```
==============================================================================
                    TRADE REPUBLIC TRADING REPORT
==============================================================================
SESSION: {id} | Strategy: {strategy} | Budget: {remaining}/{initial} EUR
P&L: {realizedPnL} EUR ({realizedPnLPercent}%) | Trades: {wins}W/{losses}L
------------------------------------------------------------------------------
OPEN POSITIONS
| ISIN            | Name                    | Entry   | Current | P&L    | SL/TP       |
|-----------------|-------------------------|---------|---------|--------|-------------|
| DE000A0TGJ55    | iShares Core DAX        | 142.50  | 145.20  | +1.9%  | 138.2/149.6 |
------------------------------------------------------------------------------
ACTIONS: {list of actions taken this cycle}
NEXT CYCLE: {interval} | Market: {status}
==============================================================================
```

#### 23. Determine Sleep Duration

```
// Market hours aware - check only enabled asset types
enabled_markets = []
FOR EACH asset_type IN session.config.allowedAssetTypes:
  status = get_market_status({ assetType: asset_type })
  enabled_markets.push({ assetType: asset_type, status: status })

open_markets = enabled_markets.filter(m => m.status.isOpen)

IF open_markets.length > 0:
  // At least one enabled market is open
  sleep_duration = session.config.interval
ELSE:
  // All enabled markets are closed
  next_opens = enabled_markets
    .filter(m => m.status.nextOpen != null)
    .map(m => m.status.nextOpen)

  IF next_opens.length > 0:
    earliest_open = MIN(next_opens)
    sleep_until = earliest_open
    sleep_duration = time until sleep_until
  ELSE:
    // Fallback to interval if no nextOpen available
    sleep_duration = session.config.interval
```

**Interval Mapping**:
- `5m` -> 300 seconds
- `15m` -> 900 seconds (default)
- `30m` -> 1800 seconds
- `1h` -> 3600 seconds

#### 24. Sleep and Repeat

```
sleep {sleep_duration}
GOTO PHASE 1
```

---

## Important Rules

1. **NEVER use more than the budget**
2. **ALWAYS check market status before trading stocks/ETFs**
3. **Fees MUST be considered in all calculations**
4. **When uncertain: DO NOT trade**
5. **Stop-loss is SACRED - always enforce it**
6. **Use ISIN for all asset identification**

## Dry-Run Mode

If the argument contains "dry-run":

- Analyze everything normally
- Log all decisions and calculations
- But DO NOT execute real orders
- Show what you WOULD do

## Autonomous Loop Mode

After each trading cycle:

1. **Output report** (as described above)
2. **Save state** to `.claude/trading-state.json`
3. **Sleep** for configured interval
4. **Start over**: Begin again at PHASE 1

The agent runs indefinitely until the user stops it with Ctrl+C.

**Important during the loop:**

- Load/save positions from trading-state.json each cycle
- Check market hours before each analysis
- Show at end of each cycle: "Next cycle in {X} minutes..."
