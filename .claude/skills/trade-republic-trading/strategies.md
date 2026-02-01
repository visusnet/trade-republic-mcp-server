# Trading Strategies

> **Note**: All indicators mentioned in this document are available as MCP tools.
> Use `get_indicators` and `get_detailed_analysis` instead of manual calculation.
> See [indicators.md](indicators.md) for complete MCP tool reference.

## Signal Categories and Weights

| Category | Weight | Indicators |
|----------|--------|------------|
| **Momentum** | 25% | RSI, Stochastic |
| **Trend** | 30% | MACD, SMA, EMA, ADX |
| **Volatility** | 15% | Bollinger Bands, ATR |
| **Volume** | 15% | OBV, VWAP |
| **Sentiment** | 10% | News, overall sentiment |
| **Fundamentals** | 5% | P/E, analyst ratings |

## Strategy Configurations

### Aggressive (Default)

- **Take-Profit**: 2.5x ATR (dynamic, typically 2.5-10%)
- **Stop-Loss**: 1.5x ATR (dynamic, clamped 2.5%-10%)
- **Min Signal Strength**: +40
- **Min Categories Confirming**: 2+
- **ADX Threshold**: > 20

### Conservative

- **Take-Profit**: 3% (fixed)
- **Stop-Loss**: 5% (fixed)
- **Min Signal Strength**: +60
- **Min Categories Confirming**: 3+
- **ADX Threshold**: > 25

### Scalping

- **Take-Profit**: 1.5% (fixed)
- **Stop-Loss**: 2% (fixed)
- **Timeframe**: Short intervals (5m)
- **Focus**: Momentum indicators
- **Volume confirmation required**

## Signal Scoring

| Score | Signal | Action |
|-------|--------|--------|
| +60 to +100 | STRONG_BUY | Full position |
| +40 to +59 | BUY | Reduced position (75%) |
| -39 to +39 | HOLD | No action |
| -59 to -40 | SELL | Exit if held |
| -100 to -60 | STRONG_SELL | Exit immediately |

## Quick Reference: Key Signals

| Condition | Signal | Score |
|-----------|--------|-------|
| RSI < 30 | BUY | +2 |
| RSI > 70 | SELL | -2 |
| RSI Bullish Divergence | BUY | +3 |
| Stochastic %K < 20, crosses %D up | BUY | +2 |
| Stochastic %K > 80, crosses %D down | SELL | -2 |
| MACD Golden Cross | BUY | +3 |
| MACD Death Cross | SELL | -3 |
| EMA 50/200 Golden Cross | BUY | +3 |
| EMA 50/200 Death Cross | SELL | -3 |
| ADX > 25 with +DI > -DI | BUY | +2 |
| ADX > 25 with -DI > +DI | SELL | -2 |
| Price at lower Bollinger Band | BUY | +2 |
| Price at upper Bollinger Band | SELL | -2 |
| OBV Bullish Divergence | BUY | +2 |
| OBV Bearish Divergence | SELL | -2 |

## Signal Aggregation Matrix

### Technical + Sentiment Combination

| Technical Score | Sentiment | Final Action |
|-----------------|-----------|--------------|
| Strong BUY (>+60%) | Bullish/Neutral | **STRONG BUY** |
| Strong BUY (>+60%) | Bearish | BUY (reduced) |
| BUY (+40% to +60%) | Bullish/Neutral | **BUY** |
| BUY (+40% to +60%) | Bearish | HOLD (conflict) |
| Weak BUY (+20% to +40%) | Bullish | **BUY** |
| Weak BUY (+20% to +40%) | Neutral/Bearish | HOLD |
| Neutral (-20% to +20%) | Any | **HOLD** |
| Weak SELL (-40% to -20%) | Bearish | **SELL** |
| Weak SELL (-40% to -20%) | Neutral/Bullish | HOLD |
| SELL (-60% to -40%) | Bearish/Neutral | **SELL** |
| SELL (-60% to -40%) | Bullish | HOLD (conflict) |
| Strong SELL (<-60%) | Any | **STRONG SELL** |

## Trade Filters

### Conditions to AVOID Trading

1. **Low ADX** (< 20): No clear trend
2. **High ATR** (> 3x average): Extreme volatility
3. **Conflicting Signals**: Categories disagree
4. **Market Closed**: Stocks/ETFs outside trading hours
5. **Exposure Limit**: > 33% in single asset
6. **Insufficient Budget**: Below minimum trade size

### Conditions that STRENGTHEN Signals

1. **3+ Categories Confirm**: Multiple alignment
2. **Volume Confirms**: Above average volume
3. **Sentiment Aligns**: News/sentiment matches technical
4. **Fundamentals Support**: Good P/E, earnings, ratings
5. **Higher Timeframe Agreement**: Multi-timeframe confirmation

## Position Sizing

### Based on Signal Confidence

| Signal Strength | Position Size |
|-----------------|---------------|
| Strong (>60%) | 100% of budget allocation |
| Medium (40-60%) | 75% of budget allocation |
| Weak (20-40%) | 50% of budget allocation |
| Very Weak (<20%) | No trade |

### Kelly Criterion Adjustment

Position size is further adjusted using Kelly Criterion result from `calculate_position_size`:

```
Final Position = MIN(signal_based_size, kelly_recommended_size)
```

### Exposure Limits

- **Max exposure per asset**: 33% of budget
- **Max simultaneous positions**: 3
- **Max risk per trade**: 2% of total portfolio

### Profitability Check

Before each trade, verify:

```
// Dynamic fee-based threshold (no hardcoded values)
entry_fee = estimated entry fee
exit_fee = estimated exit fee
min_profit_required = (entry_fee + exit_fee) * 2  // 2x safety margin

expected_profit = target_price - entry_price - entry_fee - exit_fee
IF expected_profit < min_profit_required:
  SKIP trade (not profitable after fees)
```

## Dynamic Stop-Loss / Take-Profit (ADR-007)

### Calculation

```
ATR_PERCENT = ATR(14) / Price * 100

// Dynamic SL
dynamicSL = entryPrice - (ATR * 1.5)
Clamped: min 2.5%, max 10%

// Dynamic TP
dynamicTP = entryPrice + (ATR * 2.5)
```

### Strategy-Specific Parameters

| Strategy | TP Multiplier | SL Multiplier | Min TP | Min SL | Max SL |
|----------|---------------|---------------|--------|--------|--------|
| Aggressive | 2.5x ATR | 1.5x ATR | 2.5% | 2.5% | 10% |
| Conservative | Fixed 3% | Fixed 5% | 3% | 5% | 5% |
| Scalping | Fixed 1.5% | Fixed 2% | 1.5% | 2% | 2% |

### Benefits

1. **Positive R:R**: TP/SL = 2.5/1.5 = 1.67:1
2. **Adapts to volatility**: Wider in volatile markets
3. **Lets winners run**: Higher TP captures moves
4. **Cuts losers early**: Tighter SL limits losses
5. **Capital protection**: MAX_SL caps at 10%

## Trailing Stop Strategy

Trailing stop activates after position becomes profitable, locking in gains.

### Activation Rules

```
IF profit >= 3.0% (activation threshold):
  Activate trailing stop

// ATR-based trail distance (adapts to volatility)
trailDistance = ATR / highestPrice

// Update on each price check:
highestPrice = max(highestPrice, currentPrice)
trailingStopPrice = highestPrice * (1 - trailDistance)
```

### Parameters

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| Activation Threshold | +3% profit | Enough profit to justify trailing |
| Trail Distance | ATR / highestPrice | Adapts to volatility (ATR-based) |
| Min Lock-In | +1% | Ensures fees are covered |

### Exit Priority

| Condition | Priority | Order Type |
|-----------|----------|------------|
| Price <= dynamicSL | 1 (Highest) | Market |
| Price >= dynamicTP | 2 | Limit |
| Trailing triggered | 3 | Market |

## Sentiment Interpretation

| Fear & Greed Index | Interpretation | Modifier |
|--------------------|----------------|----------|
| 0-10 | Extreme Fear | Contrarian BUY (+2) |
| 10-25 | Fear | BUY bias (+1) |
| 25-45 | Slight Fear | Slight BUY (+0.5) |
| 45-55 | Neutral | No modifier (0) |
| 55-75 | Slight Greed | Slight SELL (-0.5) |
| 75-90 | Greed | SELL bias (-1) |
| 90-100 | Extreme Greed | Contrarian SELL (-2) |

### News Sentiment Analysis

| News Type | Sentiment | Modifier |
|-----------|-----------|----------|
| Major adoption, positive regulation | Very Bullish | +2 |
| Positive earnings, partnerships | Bullish | +1 |
| Mixed news, no significant events | Neutral | 0 |
| Negative regulation, concerns | Bearish | -1 |
| Major crisis, severe issues | Very Bearish | -2 |

## Asset-Specific Handling

| Asset Type | Market Hours | Fundamentals | Notes |
|------------|--------------|--------------|-------|
| Stocks | 9:00-17:30 CET | Yes | Earnings, dividends |
| ETFs | 9:00-17:30 CET | Yes | Expense ratio |
| Crypto | 24/7 | No | Higher volatility |
| Derivatives | Varies | No | Expiry, leverage |

## Liquidity Filter

### When to Check

| Scenario | Check Required? |
|----------|----------------|
| Altcoin/small cap entries | Yes |
| Major assets (DAX ETF, BTC, etc.) | No - always liquid |
| Limit orders | No - you control price |
| Exit orders (SL/TP) | No - must exit |

### Spread Thresholds (via get_order_book)

| Spread | Action | Position Size |
|--------|--------|---------------|
| > 0.5% | Skip | 0% |
| 0.2% - 0.5% | Reduce | 50% |
| < 0.2% | Full | 100% |
