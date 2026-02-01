---
description: Trading strategy rules
globs: [".claude/*", "**/*skill*", "**/*trading*"]
---

## Claude is the Decision Engine

- Technical indicators, news, sentiment are **tools**
- Claude makes final trading decisions
- Claude selects strategy based on market conditions

## Position Sizing

Use Kelly Criterion: `K% = W - [(1-W) / R]`
- W = Win probability
- R = Win/Loss ratio

## Order Types

| Situation | Use |
|-----------|-----|
| Urgent | Market order |
| Patient | Limit order |
| Low liquidity | Limit order |
