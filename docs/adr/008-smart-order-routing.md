# ADR-008: Smart Order Routing

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

The bot needs to execute trades efficiently. Different order types have different trade-offs.

## Problem

What order execution approach should the bot use?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Market orders only | Simple, guaranteed fill | Potential slippage, worse prices |
| Limit orders only | Better prices | May not fill, misses opportunities |
| Smart order routing | Best of both | More complex logic |
| Staged execution | Reduces market impact | Slower, more complex |

## Decision

**Smart order routing - Claude decides order type based on urgency, liquidity, and market conditions.**

## Order Type Selection Criteria

| Situation | Order Type | Rationale |
|-----------|------------|-----------|
| Urgent entry (momentum) | Market | Guaranteed fill, time-sensitive |
| Patient entry (value) | Limit | Better price, willing to wait |
| Low liquidity | Limit | Avoid slippage |
| High volatility | Limit with buffer | Capture favorable moves |
| Large position | Staged/TWAP | Reduce market impact |

## Rationale

- Different situations call for different order types
- Urgent entries (catching momentum) need market orders
- Patient entries (value setups) benefit from limit orders
- Claude can assess the appropriate approach based on context
- Execution quality is one of the four pillars of bot profitability

## Consequences

### Positive
- Optimal order type for each situation
- Reduces slippage in patient entries
- Ensures fills when timing matters
- Adapts to liquidity conditions

### Negative
- More complex execution logic
- Limit orders may not fill, requiring re-evaluation
- Requires understanding of market microstructure
- Need to handle partial fills

## References

- ADR-005: Claude-Driven Trading Decisions
- OrderService implementation
