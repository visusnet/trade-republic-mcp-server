# ADR-004: Support All Asset Types

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Trade Republic offers multiple asset types for trading. The bot needs to decide which assets to support.

## Problem

Which asset types should the bot support trading?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Stocks only | Simplest, most data available | Limited opportunities |
| ETFs only | Good for diversified strategies | Limited opportunities |
| Stocks and ETFs | Both equity types | Misses crypto, derivatives |
| Crypto only | 24/7 markets, high volatility | Separate from traditional assets |
| Everything | Maximum opportunities | Complex, requires flexible architecture |

## Decision

**Support all asset types available on Trade Republic: stocks, ETFs, crypto, and derivatives.**

## Rationale

- Maximizes trading opportunities across different market conditions
- Different assets perform better in different regimes (crypto in risk-on, bonds in risk-off)
- Aligns with the adaptive strategy approach where Claude chooses what to trade
- Trade Republic's unified platform makes this practical

## Consequences

### Positive
- Can trade whatever Claude determines is most opportune
- Diversification across asset classes
- Flexibility to focus on high-opportunity areas

### Negative
- Each asset type has unique characteristics to handle
- More complex architecture required
- Need to understand each asset's trading nuances

## References

- ADR-005: Claude-Driven Trading Decisions
- ADR-006: Multi-Factor Adaptive Edge
