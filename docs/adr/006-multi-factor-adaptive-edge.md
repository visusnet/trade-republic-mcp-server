# ADR-006: Multi-Factor Adaptive Edge

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

A profitable trading bot needs an "edge" - some advantage over the market. The strategy determines what edge the bot captures.

## Problem

What edge/alpha should the bot attempt to capture?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Technical momentum | Clear signals, backtestable | Crowded strategy, works only in trends |
| Mean reversion | High win rate | Small wins, large losses possible |
| Event-driven | Claude's strength (reasoning) | Timing-dependent, news may be priced in |
| Multi-factor adaptive | Robust across conditions | More complex, harder to optimize |
| Arbitrage | Risk-free profit | Rare opportunities, needs speed |

## Decision

**Multi-factor adaptive approach.**

Different market conditions favor different strategies. The bot should adapt its approach based on current conditions, combining technicals, fundamentals, sentiment, and market context.

## Rationale

- Single strategies work in some conditions but fail in others
- Momentum fails in ranging markets; mean reversion fails in trends
- Claude's reasoning ability can assess which approach fits current conditions
- Combining multiple signal types produces more robust decisions
- This leverages Claude's unique strength: synthesis of complex information

## Consequences

### Positive
- Robust across different market regimes
- Leverages Claude's multi-factor reasoning
- Not dependent on single strategy continuing to work
- Can identify regime changes and adapt

### Negative
- More complex to implement and test
- Harder to attribute performance to specific factors
- May underperform specialized strategies in their optimal conditions
- Requires rich data across multiple dimensions

## References

- ADR-005: Claude-Driven Trading Decisions
- ADR-011: External Data Sources Must Be Completely Free
