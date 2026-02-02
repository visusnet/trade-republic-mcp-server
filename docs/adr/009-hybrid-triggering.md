# ADR-009: Hybrid Triggering Mechanism

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

The trading bot needs a triggering mechanism to determine when Claude analyzes markets and makes decisions.

## Problem

How should the trading bot be triggered?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Continuous loop | Always watching | High API costs, resource intensive |
| Cron/scheduled | Predictable, low cost | May miss fast moves |
| Event-driven | Reactive, efficient | Complex, needs reliable events |
| Hybrid | Best of both | More complex to implement |

## Decision

**Hybrid approach with configurable autonomy.**

- **Scheduled baseline checks**: Regular analysis at configurable intervals (e.g., every 15 minutes, hourly)
- **Event-driven alerts**: React to significant moves, price targets, or signal thresholds
- **Configurable parameters**: User can adjust frequency and autonomy via skill parameters

## Configuration Parameters

```typescript
{
  baseCheckInterval: '5m' | '15m' | '1h' | '4h' | '1d',
  eventTriggers: {
    priceChangeThreshold: 0.05,  // 5% move
    volumeSpike: 2.0,            // 2x average volume
    signalStrength: 0.8          // Technical signal strength
  },
  autonomyLevel: 'full' | 'confirm' | 'notify'
}
```

## Rationale

- Fully autonomous operation with no human safety net required
- Configurable parameters allow adjustment without code changes
- Event-driven for reactive moves, scheduled for systematic analysis
- Balances responsiveness with API cost efficiency

## Consequences

### Positive
- Responsive to significant market moves
- Cost-efficient baseline monitoring
- User can tune behavior without code changes
- Supports both patient and reactive strategies

### Negative
- More complex implementation
- Need reliable event detection
- Configuration complexity for users
- May over-trade if triggers too sensitive

## References

- ADR-005: Claude-Driven Trading Decisions
- Claude Skill implementation (Task 11)
