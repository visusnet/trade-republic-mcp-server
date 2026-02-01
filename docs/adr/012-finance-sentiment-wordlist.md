# ADR-012: Finance-Specific Sentiment Analysis

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

The generic `sentiment` npm library uses AFINN-165 wordlist which lacks finance-specific vocabulary. Words like "bullish", "downgrade", "short" have specific meanings in trading that differ from general usage.

## Problem

How should sentiment analysis be enhanced for financial context?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Use generic sentiment as-is | Simple, no maintenance | Misses financial context |
| Create custom wordlist | Finance-specific scoring | Requires research, maintenance |
| Use paid finance sentiment API | Professional accuracy | Violates "free" requirement |

## Decision

**Create a finance-specific wordlist (`SentimentService.wordlist.ts`) with ~100 terms.**

The sentiment library supports custom words via the `extras` option, which adds to or overrides the default AFINN-165 scores.

## Word Categories and Scores

### Strong Positive (+3 to +5)
- bullish, outperform, upgrade, breakout, rally, surge, soar

### Moderate Positive (+1 to +2)
- buy, growth, profit, gain, beat, exceed, strong

### Neutral with Financial Context (0)
- hold, maintain, reiterate

### Moderate Negative (-1 to -2)
- sell, decline, miss, weak, underperform, downgrade

### Strong Negative (-3 to -5)
- bearish, crash, bankruptcy, fraud, scandal, collapse, plunge

### Trading-Specific Terms
- short: -1 (bearish action)
- put: -1 (bearish option)
- call: +1 (bullish option)
- hedge: 0 (neutral risk management)

## Implementation

```typescript
// SentimentService.wordlist.ts
export const FINANCE_SENTIMENT_WORDS: Record<string, number> = {
  bullish: 3,
  bearish: -3,
  upgrade: 3,
  downgrade: -3,
  // ... ~100 terms
};

// SentimentService.ts
const result = sentimentLib.analyze(text, {
  extras: FINANCE_SENTIMENT_WORDS
});
```

## Rationale

- The sentiment library's `extras` option allows seamless integration
- Finance vocabulary has established positive/negative connotations
- Custom scoring improves signal accuracy for trading decisions
- Local processing maintains the "free" requirement
- Wordlist can be updated as new terms emerge

## Consequences

### Positive
- More accurate sentiment for financial text
- Captures nuances like "short" (bearish) vs generic meaning
- Zero additional cost
- Fast local processing

### Negative
- Wordlist requires occasional updates
- May not capture all financial jargon
- Context-dependent words may be misscored

## References

- ADR-011: External Data Sources Must Be Completely Free
- SentimentService.wordlist.ts implementation
- sentiment npm package AFINN-165 documentation
