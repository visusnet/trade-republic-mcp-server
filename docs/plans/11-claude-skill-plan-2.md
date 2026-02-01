# Task 11: Claude Skill - Implementation Plan (Agent 2)

## Executive Summary

This plan details the implementation of the `trade-republic-trading` Claude Skill, an autonomous trading agent that leverages Claude's reasoning capabilities to make informed trading decisions on Trade Republic. The skill follows the proven architecture from the Coinbase MCP server while adapting to Trade Republic's unique characteristics (European markets, multi-asset support, ISIN-based identification).

## 1. Directory Structure

Create the skill in `.claude/skills/trade-republic-trading/`:

```
.claude/skills/trade-republic-trading/
  SKILL.md           # Main skill definition
  strategies.md      # Trading strategies reference
  indicators.md      # Technical indicators reference
  state-schema.md    # State management schema
```

## 2. SKILL.md Structure

### 2.1 YAML Frontmatter

```yaml
---
name: trade-republic-trading
description: Autonomous multi-asset trading with technical and sentiment analysis. Use for trades, market analysis, or position management on Trade Republic.
---
```

### 2.2 Core Sections

**A. Agent Identity**
- Define Claude as an autonomous trading agent for European markets
- Emphasize multi-asset capability (stocks, ETFs, crypto, derivatives per ADR-004)
- Clearly state ISIN-based asset identification (not ticker symbols)

**B. Critical Execution Rules**
- DO NOT: Write code, run npm commands, modify server, create scripts
- DO: Call MCP tools directly, make trading decisions, manage positions
- Emphasize: "You are a TRADER using the API, not a DEVELOPER building it"

**C. Configuration Section**

| Parameter | Description | Default |
|-----------|-------------|---------|
| Budget | Total session budget in EUR | From command args |
| Interval | Analysis cycle interval | 15m |
| Strategy | aggressive / conservative / scalping | aggressive |
| Max Positions | Maximum simultaneous positions | 3 |
| Risk Per Trade | Maximum risk per trade | 2% of portfolio |
| Max Exposure | Maximum exposure per asset | 33% of budget |

**D. Available MCP Tools Reference**

Portfolio:
- `get_portfolio` - Get current positions with P/L
- `get_cash_balance` - Get available EUR balance

Market Data:
- `get_price` - Current bid/ask/last for ISIN
- `get_price_history` - Historical OHLCV candles
- `get_order_book` - Order book depth
- `search_assets` - Search by name/symbol/ISIN
- `get_asset_info` - Asset details
- `get_market_status` - Market open/closed status
- `wait_for_market` - Wait for market open

Technical Analysis:
- `get_indicators` - Calculate specific indicators (RSI, MACD, Bollinger, SMA, EMA, ADX, Stochastic, ATR, OBV, VWAP)
- `get_detailed_analysis` - Comprehensive analysis with signals

External Data (Free - ADR-011):
- `get_news` - Recent news for ISIN
- `get_sentiment` - Sentiment analysis (text or ISIN)
- `get_fundamentals` - Company fundamentals

Risk Management:
- `calculate_position_size` - Kelly Criterion position sizing
- `get_risk_metrics` - VaR, drawdown, Sharpe ratio

Execution:
- `place_order` - Place market/limit/stop orders
- `get_orders` - Current and historical orders
- `modify_order` - Modify pending orders
- `cancel_order` - Cancel pending orders

**E. Trading Workflow (4 Phases)**

```
PHASE 1: DATA COLLECTION
  1. Check Portfolio (get_portfolio, get_cash_balance)
  2. Scan Market Opportunities (search_assets for target sectors)
  3. Collect Market Data (get_price_history for candidates)
  4. Technical Analysis (get_detailed_analysis)
  5. Sentiment Analysis (get_sentiment, get_news)
  6. Fundamental Check (get_fundamentals for stocks/ETFs)

PHASE 2: MANAGE EXISTING POSITIONS
  7. Check Stop-Loss / Take-Profit levels
  8. Check Trailing Stop conditions
  9. Rebalancing Check (stagnant positions)
  10. Apply Compound (after profitable exits)
  11. Budget Exhaustion Check

PHASE 3: NEW ENTRIES
  12. Signal Aggregation (weighted scoring)
  13. Volatility-Based Position Sizing
  14. Fee & Profit Threshold Check
  15. Pre-Trade Liquidity Check (get_order_book)
  16. Execute Order (place_order with appropriate type)

PHASE 4: REPORT & LOOP
  17. Output Structured Report
  18. Wait/Sleep for next cycle
```

**F. Key Differences from Coinbase Skill**

| Aspect | Coinbase | Trade Republic |
|--------|----------|----------------|
| Asset ID | Product ID (BTC-EUR) | ISIN (DE000A0TGJ55) |
| Markets | 24/7 Crypto | European hours (mostly) |
| Asset Types | Crypto only | Stocks, ETFs, Crypto, Derivatives |
| Order Types | Market, Limit (various) | Market, Limit, Stop-Market |
| Currency | EUR pairs | EUR (German broker) |
| Data Source | Coinbase API | Trade Republic + Yahoo Finance |

**G. Market Hours Handling**

Unlike 24/7 crypto markets, stocks/ETFs have trading hours:
- Check `get_market_status` before trading
- Use `wait_for_market` for pre-market positioning
- Crypto positions can trade 24/7

**H. Asset-Specific Considerations**

| Asset Type | Considerations |
|------------|----------------|
| Stocks | Market hours, earnings events, dividends |
| ETFs | Market hours, tracking error, expense ratio |
| Crypto | 24/7, higher volatility, no fundamentals |
| Derivatives | Expiry dates, leverage, margin |

## 3. strategies.md Content

### 3.1 Multi-Factor Adaptive Approach (ADR-006)

The skill uses Claude's reasoning to adapt strategy based on market conditions, not rigid rules.

### 3.2 Signal Categories and Weights

| Category | Weight | Indicators |
|----------|--------|------------|
| Momentum | 25% | RSI, Stochastic |
| Trend | 30% | MACD, SMA, EMA, ADX |
| Volatility | 15% | Bollinger Bands, ATR |
| Volume | 15% | OBV, VWAP |
| Sentiment | 10% | News, Fear & Greed |
| Fundamentals | 5% | P/E, analyst ratings (stocks only) |

### 3.3 Strategy Configurations

**Aggressive (Default)**
- Take-Profit: 2.5x ATR (dynamic)
- Stop-Loss: 1.5x ATR (dynamic, min 2.5%, max 10%)
- Min Signal Strength: +40%
- ADX Threshold: > 20

**Conservative**
- Take-Profit: 3% (fixed)
- Stop-Loss: 5% (fixed)
- Min Signal Strength: +60%
- ADX Threshold: > 25

**Scalping**
- Take-Profit: 1.5% (fixed)
- Stop-Loss: 2% (fixed)
- Focus: Momentum indicators
- Timeframe: Shorter candle periods

### 3.4 Signal Aggregation Matrix

Score ranges and corresponding actions with sentiment modifiers.

### 3.5 Position Sizing (ADR-007)

- Kelly Criterion with fractional Kelly (quarter/half/full)
- Volatility-adjusted sizing based on ATR ratio
- Exposure limits: 33% per asset, 3 max positions, 2% risk per trade

### 3.6 Trade Filters

Avoid trading when:
- ADX < 20 (no trend)
- ATR > 3x average (extreme volatility)
- Conflicting signals between categories
- Market closed (for stocks/ETFs)

### 3.7 Fee Optimization

- Prefer limit orders for lower fees
- Calculate minimum profit threshold dynamically
- Two-stage verification for market order fallbacks

## 4. indicators.md Content

### 4.1 Tool Reference Format

Document each indicator available via `get_indicators` and `get_detailed_analysis`:

For each indicator:
- MCP Tool usage
- Output structure
- Interpretation guide
- Signal scoring (+3 to -3)

### 4.2 Indicators Covered

**Momentum**
- RSI (14) - Relative Strength Index
- Stochastic (%K, %D) - Stochastic Oscillator

**Trend**
- MACD (12, 26, 9) - Moving Average Convergence Divergence
- SMA (20, 50) - Simple Moving Averages
- EMA (periods) - Exponential Moving Averages
- ADX (14) - Average Directional Index

**Volatility**
- Bollinger Bands (20, 2) - With %B and bandwidth
- ATR (14) - Average True Range

**Volume**
- OBV - On-Balance Volume
- VWAP - Volume Weighted Average Price

### 4.3 Signal Aggregation

Weighted scoring formula with category normalization.

### 4.4 Null-Safety

All indicators must check for null before use (insufficient data handling).

## 5. state-schema.md Content

### 5.1 File Location

`.claude/trading-state.json`

### 5.2 Complete Schema Structure

```typescript
interface TradingState {
  session: {
    id: string;                    // ISO timestamp (unique ID)
    startTime: string;             // ISO timestamp
    lastUpdated: string;           // ISO timestamp
    budget: {
      initial: number;             // Starting budget in EUR
      remaining: number;           // Available budget in EUR
      currency: 'EUR';             // Always EUR for Trade Republic
      source?: string;             // Original source if converted
      sourceAmount?: number;       // Original amount if converted
    };
    stats: {
      tradesOpened: number;
      tradesClosed: number;
      wins: number;
      losses: number;
      totalFeesPaid: number;
      realizedPnL: number;
      realizedPnLPercent: number;
    };
    config: {
      strategy: 'aggressive' | 'conservative' | 'scalping';
      interval: string;            // '5m' | '15m' | '1h'
      dryRun: boolean;
    };
    compound: {
      enabled: boolean;
      rate: number;                // 0.0 to 1.0
      maxBudget: number;
      paused: boolean;
      consecutiveWins: number;
      consecutiveLosses: number;
      totalCompounded: number;
      compoundEvents: CompoundEvent[];
    };
    rebalancing: {
      enabled: boolean;
      stagnationHours: number;
      stagnationThreshold: number;
      minOpportunityDelta: number;
      minAlternativeScore: number;
      maxRebalanceLoss: number;
      cooldownHours: number;
      maxPerDay: number;
      totalRebalances: number;
      rebalancesToday: number;
      lastRebalance: string | null;
      recentlyExited: string[];    // ISINs (24h block)
      rebalanceHistory: RebalanceEvent[];
    };
  };
  openPositions: Position[];
  tradeHistory: ClosedTrade[];
}

interface Position {
  id: string;                      // pos_{date}_{time}_{asset}
  isin: string;                    // Trade Republic uses ISIN
  name: string;                    // Human-readable name
  assetType: 'stock' | 'etf' | 'crypto' | 'derivative';
  side: 'long';                    // Only long for now
  size: string;                    // Position size (shares/units)
  entry: {
    price: number;
    time: string;
    orderType: 'market' | 'limit' | 'stop-market';
    fee: number;
    exchange: string;
  };
  analysis: {
    signalStrength: number;        // 0-100
    technicalScore: number;
    sentiment: 'bullish' | 'neutral' | 'bearish';
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  };
  riskManagement: {
    entryATR: number;
    dynamicSL: number;             // Stop-loss price
    dynamicTP: number;             // Take-profit price
    trailingStop: {
      active: boolean;
      currentStopPrice: number | null;
      highestPrice: number;
    };
  };
  performance: {
    currentPrice: number | null;
    unrealizedPnL: number | null;
    unrealizedPnLPercent: number | null;
    peakPnLPercent: number;
    holdingTimeHours: number | null;
  };
  rebalancing: {
    eligible: boolean;
    stagnantSince: string | null;
    bestAlternative: { isin: string; name: string; score: number; delta: number } | null;
    rebalanceCount: number;
  };
}
```

### 5.3 State Operations

Document operations for:
- Initialize Session
- Open Position
- Update Position (each cycle)
- Close Position
- Compound Application
- Rebalancing

### 5.4 Validation Rules

- Peak PnL consistency
- Budget consistency checks
- Division by zero protection
- Session resume handling

## 6. Main Trading Loop Logic

### 6.1 Initialization

1. Parse command arguments (budget, interval, strategy, dry-run)
2. Check if resuming existing session or starting fresh
3. Initialize or load state from `.claude/trading-state.json`
4. Authenticate with Trade Republic (MCP server handles this)

### 6.2 Analysis Cycle

```
LOOP:
  1. Load state
  2. Check market status (for each position's asset type)
  3. Update position performance
  4. Check exit conditions (SL/TP/Trailing)
  5. Execute exits if triggered
  6. Apply compound on profitable exits
  7. Check rebalancing opportunities
  8. Scan for new opportunities
  9. Aggregate signals
  10. Execute entries if conditions met
  11. Save state
  12. Output report
  13. Sleep for interval
  GOTO LOOP
```

### 6.3 Key Decision Points

**Entry Decision**
- Signal strength > threshold (strategy-dependent)
- At least 2-3 categories confirming
- ADX above threshold
- No conflicting signals
- Market open (for stocks/ETFs)
- Sufficient budget
- Under max position limit

**Exit Decision**
- Stop-loss triggered (priority 1)
- Take-profit triggered (priority 2)
- Trailing stop triggered (priority 3)
- Force exit on stagnation (priority 4)
- Rebalancing opportunity (priority 5)

### 6.4 Report Structure

Structured output with sections for:
- Session summary
- Technical analysis per position
- Sentiment summary
- Trade decision
- Open positions table
- Actions taken
- Next cycle timing

### 6.5 Autonomous Loop

The agent runs indefinitely until user stops with Ctrl+C:
- Uses sleep for next cycle when no active monitoring needed
- No WebSocket event monitoring (Trade Republic API uses WebSocket differently)

## 7. Trade Republic-Specific Adaptations

### 7.1 ISIN-Based Identification

All asset references use ISIN (e.g., DE000A0TGJ55) instead of ticker symbols.

### 7.2 Market Hours Awareness

- Check `get_market_status` before stock/ETF trades
- Allow 24/7 trading for crypto assets
- Handle pre-market and post-market conditions

### 7.3 Multi-Asset Strategies

Claude should assess:
- Which asset class is most opportune
- Asset-specific risk characteristics
- Cross-asset correlations

### 7.4 European Market Context

- EUR as base currency
- German/European regulatory context
- Trade Republic-specific order types (market, limit, stop-market)

## 8. Implementation Steps

### Step 1: Create Skill Directory
```bash
mkdir -p .claude/skills/trade-republic-trading
```

### Step 2: Create SKILL.md
Implement the main skill definition with all sections.

### Step 3: Create strategies.md
Implement strategy configurations and signal aggregation.

### Step 4: Create indicators.md
Document all available indicators with interpretation guides.

### Step 5: Create state-schema.md
Define complete state structure with operations and validation.

### Step 6: Test Skill Loading
Verify the skill loads correctly in Claude.

### Step 7: Dry-Run Testing
Test with "dry-run" argument to verify logic without real trades.

## 9. Alignment with ADRs

| ADR | Implementation |
|-----|----------------|
| ADR-005 | Claude as decision engine, tools provide data |
| ADR-006 | Multi-factor adaptive approach with weighted signals |
| ADR-007 | Kelly Criterion with fractional sizing |
| ADR-008 | Smart order routing (market vs limit) |
| ADR-009 | Hybrid triggering (scheduled + events) |
| ADR-010 | Same architecture as Coinbase (adapted for TR) |
| ADR-011 | Free data sources (yahoo-finance2, sentiment) |
| ADR-012 | Finance-specific sentiment wordlist |

## 10. Risk Considerations

- **Real Money Warning**: Prominent warnings about live trading
- **Position Limits**: Enforced max positions and exposure
- **Stop-Loss Sacred**: Always enforce stop-loss
- **Dry-Run Mode**: Complete simulation without execution
- **Budget Tracking**: Never exceed allocated budget

---

### Critical Files for Implementation

- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/SKILL.md` - Main skill definition (to be created)
- `/Users/rosea/Development/trade-republic-bot/.claude/skills/trade-republic-trading/state-schema.md` - State management schema (to be created)
- `/Users/rosea/Development/coinbase-mcp-server/.claude/skills/coinbase-trading/SKILL.md` - Primary reference implementation
- `/Users/rosea/Development/trade-republic-bot/docs/adr/006-multi-factor-adaptive-edge.md` - Strategy approach
- `/Users/rosea/Development/trade-republic-bot/src/server/tools/TechnicalAnalysisToolRegistry.ts` - Available indicator tools
