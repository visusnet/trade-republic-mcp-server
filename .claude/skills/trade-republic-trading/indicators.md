# Technical Indicators - MCP Tool Reference

This document describes how to interpret the outputs from MCP indicator tools.
**Do NOT calculate indicators manually** - use the MCP tools instead.

## get_detailed_analysis Output

The `get_detailed_analysis` tool provides comprehensive technical analysis in a single call:

```json
{
  "summary": {
    "overallSignal": "BUY",
    "confidence": "high",
    "score": 65
  },
  "trend": {
    "direction": "bullish",
    "strength": "strong",
    "sma20": 142.50,
    "sma50": 140.25
  },
  "signals": [
    { "name": "RSI", "signal": "BUY", "value": 28 },
    { "name": "MACD", "signal": "BUY", "value": 0.85 }
  ],
  "indicators": {
    "rsi": { "value": 28, "signal": "BUY" },
    "macd": { "value": 0.85, "signal": "BUY", "histogram": 0.15 },
    "bollingerBands": { "upper": 148.50, "middle": 142.50, "lower": 136.50, "percentB": 0.25 },
    "stochastic": { "k": 22, "d": 25 },
    "adx": { "value": 28 },
    "atr": { "value": 2.85 }
  }
}
```

## Momentum Indicators

### RSI (Relative Strength Index)

**MCP Tool**: `get_indicators` or `get_detailed_analysis`

**Interpretation**:

| RSI Value | Signal | Score |
|-----------|--------|-------|
| < 30 | Oversold - BUY | +2 |
| 30-40 | Slightly oversold | +1 |
| 40-60 | Neutral | 0 |
| 60-70 | Slightly overbought | -1 |
| > 70 | Overbought - SELL | -2 |

### Stochastic Oscillator

**Interpretation**:

| Condition | Signal | Score |
|-----------|--------|-------|
| %K < 20, %K crosses above %D | BUY | +2 |
| %K > 80, %K crosses below %D | SELL | -2 |
| %K < 20 (oversold zone) | Weak BUY | +1 |
| %K > 80 (overbought zone) | Weak SELL | -1 |

## Trend Indicators

### MACD (Moving Average Convergence Divergence)

**Interpretation**:

| Condition | Signal | Score |
|-----------|--------|-------|
| MACD crosses signal from below (Golden Cross) | Strong BUY | +3 |
| MACD > signal + positive histogram | BUY | +2 |
| MACD crosses signal from above (Death Cross) | Strong SELL | -3 |
| MACD < signal + negative histogram | SELL | -2 |
| Histogram increasing | Momentum strengthening | - |
| Histogram decreasing | Momentum weakening | - |

### Moving Averages (SMA/EMA)

**Interpretation**:

| Condition | Signal | Score |
|-----------|--------|-------|
| SMA(20) > SMA(50) > SMA(200) | Strong uptrend | +2 |
| SMA(20) < SMA(50) < SMA(200) | Strong downtrend | -2 |
| Price above SMA(200) | Long-term bullish | +1 |
| Price below SMA(200) | Long-term bearish | -1 |
| SMA(50) crosses above SMA(200) (Golden Cross) | Strong BUY | +3 |
| SMA(50) crosses below SMA(200) (Death Cross) | Strong SELL | -3 |

### ADX (Average Directional Index)

**Interpretation**:

| ADX Value | Trend Strength | Trading Action |
|-----------|----------------|----------------|
| < 20 | Weak/No trend | AVOID trading |
| 20-25 | Cautious | Trade with reduced position |
| 25-50 | Strong trend | Trade with confidence |
| > 50 | Very strong trend | Trade with caution (extreme) |

**Directional Movement**:

| Condition | Signal | Score |
|-----------|--------|-------|
| +DI > -DI with ADX > 25 | BUY | +2 |
| -DI > +DI with ADX > 25 | SELL | -2 |
| +DI crosses above -DI | BUY | +2 |
| -DI crosses above +DI | SELL | -2 |

## Volatility Indicators

### Bollinger Bands

**Interpretation** (using %B - percent B):

| %B Value | Position | Signal | Score |
|----------|----------|--------|-------|
| < 0 | Below lower band | Oversold - BUY | +2 |
| 0-0.2 | Near lower band | Slightly oversold | +1 |
| 0.2-0.8 | Inside bands | Neutral | 0 |
| 0.8-1.0 | Near upper band | Slightly overbought | -1 |
| > 1 | Above upper band | Overbought - SELL | -2 |

**Bandwidth**:
- Low bandwidth (squeeze) = Breakout imminent, prepare
- Expanding bandwidth = Trend continuation

### ATR (Average True Range)

**Use for**:
- Stop-loss placement: Entry - (ATR * 1.5)
- Take-profit placement: Entry + (ATR * 2.5)
- Position sizing: Higher ATR = smaller position
- Volatility filter: ATR > 3x average = avoid trading

## Volume Indicators

### OBV (On-Balance Volume)

**Interpretation** (compare OBV trend to price trend):

| OBV Trend | Price Trend | Signal | Score |
|-----------|-------------|--------|-------|
| Rising | Rising | Trend confirmed | +1 |
| Falling | Rising | Bearish divergence | -2 |
| Rising | Falling | Bullish divergence | +2 |
| Falling | Falling | Trend confirmed | -1 |

## Null Safety

All indicators may return null when insufficient data is available. Always check before using:

```
IF indicator.value IS NULL THEN skip in scoring
```

**Examples of null handling**:
```
// WRONG - can cause errors:
if (rsi.value < 30) { ... }

// CORRECT - null check first:
if (rsi.value !== null && rsi.value < 30) { ... }
```

## Signal Aggregation

### Weighted Signal Score

| Category | Weight | Indicators |
|----------|--------|------------|
| Momentum | 25% | RSI, Stochastic |
| Trend | 30% | MACD, SMA, EMA, ADX |
| Volatility | 15% | Bollinger Bands, ATR |
| Volume | 15% | OBV, VWAP |
| Sentiment | 10% | News, overall sentiment |
| Fundamentals | 5% | P/E, analyst ratings |

### Final Score Calculation

```
// Step 1: Normalize each category score (0-100) to weighted contribution
momentum_weighted = (momentum_score / 100) * 25
trend_weighted = (trend_score / 100) * 30
volatility_weighted = (volatility_score / 100) * 15
volume_weighted = (volume_score / 100) * 15
sentiment_weighted = (sentiment_score / 100) * 10
fundamentals_weighted = (fundamentals_score / 100) * 5

// Step 2: Sum all weighted contributions (result: 0-100 range)
Final_Score = momentum_weighted + trend_weighted + volatility_weighted
            + volume_weighted + sentiment_weighted + fundamentals_weighted
```

### Decision Thresholds

| Score Range | Signal | Confidence |
|-------------|--------|------------|
| +60 to +100 | STRONG_BUY | High |
| +40 to +59 | BUY | Medium |
| -39 to +39 | HOLD | - |
| -59 to -40 | SELL | Medium |
| -100 to -60 | STRONG_SELL | High |

### Confirmation Rules

1. **Never trade on a single indicator**
2. **Require at least 3 confirming categories**:
   - A category confirms if its weighted score > 0
   - Categories: Momentum, Trend, Volatility, Volume, Sentiment, Fundamentals
   - Count categories with score > 0; require 3+ to proceed
   - Example: If Momentum (+15), Trend (+22), Volatility (-5), Volume (+8), Sentiment (0), Fundamentals (+3) => 4 categories confirm (Momentum, Trend, Volume, Fundamentals)
3. **ADX > 20 required for trend trades**
4. **Volume confirmation required for breakouts**
5. **Avoid trading during low volatility (ATR squeeze)**
