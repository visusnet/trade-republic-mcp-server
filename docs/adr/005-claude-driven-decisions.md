# ADR-005: Claude-Driven Trading Decisions

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

The bot needs a trading strategy approach. Traditional bots use hardcoded rules or configurable parameters.

## Problem

What trading strategy approach should the bot use?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Single hardcoded strategy | Simple, predictable | Can't adapt, single point of failure |
| Configurable strategies | Flexible parameters | Still rule-based, limited adaptation |
| Claude-driven decisions | Reasoning, adaptation, multi-factor | API costs, depends on Claude quality |
| Hybrid (indicators + Claude) | Best of both | More complex |

## Decision

**Claude-driven decisions with technical indicators as tools.**

Claude is the decision engine. Technical indicators, news, sentiment, and fundamentals are tools that Claude uses to make informed trading decisions. This is consistent with the Coinbase MCP server architecture.

## Rationale

- Claude can assess market regime (trending, ranging, volatile, calm)
- Claude can select appropriate strategy for current conditions
- Claude can combine signals across multiple approaches
- Claude can reason about situations that don't fit neat categories
- Rule-based systems fail when market regime changes

## Consequences

### Positive
- Adaptive to changing market conditions
- Can combine multiple data sources intelligently
- Can reason about complex or unusual situations
- Aligns with proven Coinbase MCP architecture

### Negative
- API costs impact profitability
- Quality depends on Claude's reasoning ability
- Less predictable than rule-based systems
- Requires good prompting in the Claude Skill

## References

- ADR-006: Multi-Factor Adaptive Edge
- ADR-010: Same Architecture as Coinbase MCP
- coinbase-mcp-server reference project
