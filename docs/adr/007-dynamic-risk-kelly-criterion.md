# ADR-007: Dynamic Risk Management with Kelly Criterion

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Risk management often matters more than entry signals for long-term profitability. The bot needs a position sizing approach.

## Problem

How should the bot manage risk and size positions?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Conservative (1-2% per trade) | Safe, survives drawdowns | May miss opportunities |
| Moderate (3-5% per trade) | Balanced risk/reward | Fixed approach |
| Aggressive (10%+ per trade) | High returns possible | High risk of ruin |
| Dynamic (Claude adjusts) | Adapts to conditions | Requires good judgment |
| Kelly Criterion | Mathematically optimal | Assumes known edge |

## Decision

**Dynamic risk management with Kelly Criterion as mathematically grounded fallback.**

Claude adjusts risk parameters based on:
- Market conditions (volatility, regime)
- Confidence in the trade setup
- Current portfolio exposure
- Recent performance

When confidence is low or uncertain, Kelly Criterion provides objective position sizing based on estimated edge and win rate.

## Kelly Criterion Formula

```
K% = W - [(1-W) / R]
```

Where:
- K% = Percentage of capital to allocate
- W = Win probability (0 to 1)
- R = Win/Loss ratio (average win / average loss)

## Rationale

- Risk management often matters more than entry signals
- Dynamic adjustment allows for aggressive positions in high-confidence setups
- Kelly Criterion prevents emotional over-sizing by providing mathematical grounding
- Combines Claude's judgment with mathematical rigor

## Consequences

### Positive
- Adapts position sizing to confidence level
- Prevents catastrophic losses from over-sizing
- Mathematically grounded fallback prevents emotional decisions
- Can be aggressive when conditions warrant

### Negative
- Kelly Criterion requires accurate edge/win-rate estimates
- Dynamic adjustment depends on Claude's calibration
- May undersize positions if confidence is consistently low
- Full Kelly can be volatile; may need fractional Kelly

## References

- RiskService implementation
- ADR-005: Claude-Driven Trading Decisions
