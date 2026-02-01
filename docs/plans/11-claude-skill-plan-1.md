# Task 11: Claude Skill - Implementation Plan (Agent 1)

## Summary of Research

Based on my exploration, I have gathered the following information:

### Available MCP Tools (Trade Republic Bot)

**Portfolio Tools:**
- `get_portfolio` - Current portfolio with positions
- `get_cash_balance` - Available cash balance

**Market Data Tools:**
- `get_price` - Current bid/ask/last price
- `get_price_history` - Historical OHLCV candles
- `get_order_book` - Order book with spread
- `search_assets` - Search by name/symbol/ISIN
- `get_asset_info` - Detailed instrument info
- `get_market_status` - Market open/closed status
- `wait_for_market` - Wait for market to open

**Technical Analysis Tools:**
- `get_indicators` - Calculate specific indicators (RSI, MACD, Bollinger, SMA, EMA, ADX, Stochastic, ATR, OBV, VWAP)
- `get_detailed_analysis` - Comprehensive analysis with signals

**External Data Tools:**
- `get_news` - News articles for instrument
- `get_sentiment` - Sentiment analysis
- `get_fundamentals` - Fundamental data

**Risk Management Tools:**
- `calculate_position_size` - Kelly Criterion position sizing
- `get_risk_metrics` - VaR, Sharpe, drawdown, etc.

**Execution Tools:**
- `place_order` - Market/limit/stop orders
- `get_orders` - Order history
- `modify_order` - Modify pending orders
- `cancel_order` - Cancel pending orders

### Key ADRs Referenced:
- ADR-004: Support all asset types (stocks, ETFs, crypto, derivatives)
- ADR-005: Claude-driven decisions
- ADR-006: Multi-factor adaptive edge
- ADR-007: Dynamic risk management with Kelly Criterion
- ADR-008: Smart order routing
- ADR-009: Hybrid triggering mechanism
- ADR-010: Same architecture as Coinbase MCP
- ADR-011: Free external data sources

### Coinbase Skill Structure (Reference):
```
.claude/skills/coinbase-trading/
  SKILL.md          (50KB - main skill definition)
  strategies.md     (11KB - trading strategies)
  indicators.md     (21KB - indicator reference)
  state-schema.md   (21KB - state management)
```

### Key Differences for Trade Republic:
1. **Asset Types**: Trade Republic supports stocks, ETFs, crypto, AND derivatives (vs Coinbase crypto-only)
2. **Market Hours**: Non-24/7 markets for stocks/ETFs require market status awareness
3. **Instrument Identification**: Uses ISINs instead of product IDs
4. **External Data**: Uses yahoo-finance2 and sentiment npm packages
5. **Technical Analysis**: Uses `get_detailed_analysis` instead of individual indicator tools

---

## Implementation Plan for Task 11: Claude Skill

### Critical Files for Implementation
- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/SKILL.md` - Main skill definition (to create)
- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/strategies.md` - Trading strategies (to create)
- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/indicators.md` - Technical indicators reference (to create)
- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/state-schema.md` - State management schema (to create)
- `/Users/rosea/Development/coinbase-mcp-server/.claude/skills/coinbase-trading/SKILL.md` - Reference implementation to follow

### 1. Directory Structure

Create the skills directory:
```
.claude/skills/trade-republic-trading/
  SKILL.md          (main skill definition)
  strategies.md     (trading strategies)
  indicators.md     (technical indicators reference)
  state-schema.md   (state management schema)
```

### 2. SKILL.md Structure

**Frontmatter:**
```yaml
---
name: trade-republic-trading
description: Autonomous trading with technical and sentiment analysis. Use when executing trades, analyzing markets, or managing positions on Trade Republic.
---
```

**Key Sections:**

1. **Critical: How to Execute This Skill**
   - DO NOT: npm commands, write code, modify server
   - DO: Call MCP tools directly, make trading decisions

2. **Configuration**
   - Budget (from arguments, e.g., "100 EUR" or "0.01 BTC")
   - Interval (default: 15m for stocks during market hours)
   - Strategy: Aggressive, Conservative, Scalping
   - Asset Types: stocks, ETFs, crypto, derivatives
   - Market Hours Awareness (critical for non-crypto assets)

3. **Available MCP Tools**
   - Reference the TR-specific tools
   - Note: Use `get_detailed_analysis` for comprehensive technical signals
   - Note: ISIN-based identification

4. **Workflow Phases**
   - Phase 1: Data Collection (portfolio, prices, analysis, sentiment)
   - Phase 2: Manage Existing Positions (SL/TP/trailing)
   - Phase 3: New Entries (signal aggregation, position sizing, execution)
   - Phase 4: Report and Loop

5. **Asset-Specific Considerations**
   - Stocks/ETFs: Check market status, respect trading hours
   - Crypto: 24/7 available, higher volatility expected
   - Derivatives: Complex instruments, additional risk warnings
   - All: Use ISIN for identification

6. **Dynamic Stop-Loss / Take-Profit** (ATR-based per ADR-007)

7. **Trailing Stop Strategy**

8. **Fee Optimization**
   - Trade Republic fee structure (simpler than Coinbase tiers)
   - Minimum profit thresholds

9. **Liquidity Filter**
   - Check spread for illiquid instruments

10. **Output Report Format**

11. **Autonomous Loop Mode**
    - Market hours awareness for sleep scheduling
    - Use `wait_for_market` for non-crypto assets

### 3. strategies.md Content

Based on ADR-006 (Multi-Factor Adaptive Edge), include:

1. **Enhanced Signal Aggregation**
   - Technical Signal Categories with weights:
     - Momentum (25%): RSI, Stochastic, etc.
     - Trend (30%): MACD, EMA, ADX
     - Volatility (15%): Bollinger, ATR
     - Volume (15%): OBV, VWAP (when available)
     - S/R (10%): Pivot points, support levels
     - Patterns (5%): Candlestick patterns

2. **Strategy Configurations**
   - Aggressive: 2.5x ATR TP, 1.5x ATR SL
   - Conservative: 3% TP, 5% SL
   - Scalping: 1.5% TP, 2% SL

3. **Technical + Sentiment Combination Matrix**

4. **Position Sizing**
   - Based on signal confidence
   - Based on volatility (ATR)
   - Kelly Criterion fallback (ADR-007)

5. **Trade Filters**
   - When to avoid trading
   - When signals are strengthened

6. **Asset-Type Specific Strategies**
   - Stocks: Trend-following, earnings plays
   - ETFs: Sector rotation, correlation analysis
   - Crypto: Momentum, volatility breakouts
   - Derivatives: Options strategies (covered calls, protective puts)

### 4. indicators.md Content

Reference document for interpreting `get_detailed_analysis` output:

1. **Available Indicators**
   - RSI, MACD, Bollinger Bands, Stochastic, ADX, ATR, SMA, EMA, OBV, VWAP

2. **get_detailed_analysis Output Structure**
   ```json
   {
     "summary": { "overallSignal", "confidence", "score" },
     "trend": { "direction", "strength", "sma20", "sma50" },
     "signals": [...],
     "indicators": { "rsi", "macd", "bollingerBands", "stochastic", "adx", "atr" }
   }
   ```

3. **Interpretation Guidelines**
   - Signal scoring (-3 to +3)
   - Confirmation rules
   - Null-safety considerations

4. **get_indicators for Custom Calculations**
   - When to use individual indicator requests
   - Period customization

### 5. state-schema.md Content

State file: `.claude/trading-state.json`

**Schema Structure:**

1. **Session Object**
   - id, startTime, lastUpdated
   - budget: initial, remaining, currency, source
   - stats: tradesOpened, tradesClosed, wins, losses, fees, PnL
   - config: strategy, interval, dryRun, assetTypes
   - compound: enabled, rate, maxBudget, paused
   - rebalancing: enabled, parameters

2. **Open Positions Array**
   - id, isin (not pair), side, size
   - entry: price, time, orderType, fee
   - analysis: signalStrength, technicalScore, sentiment
   - riskManagement: entryATR, dynamicSL, dynamicTP, trailingStop
   - performance: currentPrice, unrealizedPnL, holdingTimeHours
   - assetType: stock, etf, crypto, derivative

3. **Trade History Array**
   - Complete trade records with entry, exit, result

4. **Operations**
   - Initialize Session
   - Open Position
   - Update Position (Each Cycle)
   - Close Position

5. **Validation Rules**
   - Position performance validation
   - Budget consistency validation
   - Division by zero protection

### 6. Main Trading Loop Logic

```
LOOP:
  1. Load state from trading-state.json
  2. Check market status (for non-crypto positions)
  3. If market closed for all assets:
     - If crypto enabled: continue with crypto only
     - Else: use wait_for_market or calculate sleep time
  4. Get portfolio and cash balance
  5. For each open position:
     - Check SL/TP/Trailing conditions
     - Execute exits if triggered
     - Check for rebalancing opportunities
  6. Apply compound (if any profitable exits)
  7. Check budget exhaustion
  8. If budget available:
     - Scan tradeable assets (respecting market hours)
     - Get detailed analysis for candidates
     - Aggregate signals with sentiment
     - Apply trade filters
     - Calculate position size (volatility-adjusted, Kelly-backed)
     - Check fees and profit threshold
     - Check liquidity (spread)
     - Execute order if criteria met
  9. Save state to trading-state.json
  10. Output trading report
  11. Sleep (respecting market hours for non-crypto)
  12. GOTO LOOP
```

### 7. Trade Republic Specific Adaptations

1. **ISIN-based Identification**
   - All tools use `isin` instead of `productId`
   - Use `search_assets` to find ISINs

2. **Market Hours Awareness**
   - Stocks: European market hours (~9:00-17:30 CET)
   - Crypto: 24/7
   - Check with `get_market_status` before trading

3. **Asset Type Handling**
   - Include `assetType` in position tracking
   - Different risk parameters per asset type

4. **Fee Structure**
   - Trade Republic uses flat fees (simpler than Coinbase tiers)
   - Adjust MIN_PROFIT calculation accordingly

5. **Order Types**
   - Market, limit, stop-market supported
   - Expiry options: gfd, gtc, gtd

### 8. Implementation Sequence

1. Create `.claude/skills/trade-republic-trading/` directory
2. Create `state-schema.md` (foundation for state management)
3. Create `indicators.md` (reference for technical analysis)
4. Create `strategies.md` (trading strategy configurations)
5. Create `SKILL.md` (main skill definition)
6. Test skill invocation with dry-run mode
