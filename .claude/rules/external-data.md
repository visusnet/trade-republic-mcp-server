---
description: Rules for integrating external data sources
globs: ["src/**/NewsService*", "src/**/SentimentService*", "src/**/FundamentalsService*", "src/**/External*"]
---

# External Data Source Rules

## Data sources must be FREE

When integrating external data sources:

- NO API keys required
- NO "free tiers" with rate limits
- NO registration required

## Verification required

Document the free status verification in an ADR before implementation, including:

- License (must be MIT, Apache, or similar)
- Rate limits (document if any exist)
- Known limitations
- Alternatives considered
