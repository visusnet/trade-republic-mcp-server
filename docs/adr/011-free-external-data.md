# ADR-011: External Data Sources Must Be Completely Free

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

The bot needs external data for news, sentiment analysis, and fundamental data to inform trading decisions. Various data providers offer different pricing models.

## Problem

Which external data sources should the bot use?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Finnhub API | Professional data, many endpoints | Requires API key, free tier has limits |
| Alpha Vantage | Wide coverage, financial focus | Requires API key, rate limited |
| yahoo-finance2 npm | Completely free, no API key, MIT license | Unofficial, may change |
| sentiment npm | Local processing, AFINN-165 wordlist, MIT | Generic, not finance-specific |

## Decision

**Use yahoo-finance2 and sentiment npm packages.**

These are completely free:
- No API keys required
- No registration required
- No "free tier" with limits
- Can be used immediately without setup

## Rationale

The explicit requirement was: **"FREE. No 'free tiers'. FREE"**

- API keys create friction and potential security concerns
- Rate limits on free tiers could impact trading decisions at critical moments
- Local sentiment processing is faster and more reliable
- No external service dependencies for core functionality

## Implementation

| Data Type | Source | Package |
|-----------|--------|---------|
| Quotes/Prices | Yahoo Finance | yahoo-finance2 |
| Historical Data | Yahoo Finance | yahoo-finance2 |
| Fundamentals | Yahoo Finance | yahoo-finance2 |
| News Headlines | Yahoo Finance | yahoo-finance2 |
| Sentiment Analysis | Local | sentiment + custom wordlist |

## Consequences

### Positive
- Zero data costs
- No API key management
- No rate limit concerns
- Works offline for sentiment
- Fast local processing

### Negative
- yahoo-finance2 may change without notice (unofficial API)
- Sentiment may be less accurate than paid services
- News coverage may be limited
- No real-time streaming data

## References

- ADR-012: Finance-Specific Sentiment Analysis
- yahoo-finance2 npm package
- sentiment npm package
