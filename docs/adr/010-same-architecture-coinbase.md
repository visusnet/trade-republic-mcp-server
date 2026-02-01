# ADR-010: Same Architecture as Coinbase MCP

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

A reference implementation exists: the coinbase-mcp-server project with its Claude Skill. Should the Trade Republic bot follow the same architecture or explore alternatives?

## Problem

Should the architecture differ from the existing Coinbase MCP server?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Same architecture | Proven, familiar, maintainable | May miss TR-specific optimizations |
| Event-driven core | More reactive | More complex, different mental model |
| Multi-asset orchestration | Specialized sub-strategies | Over-engineering for initial version |
| Separate analysis/execution | Clean separation | Added complexity, latency |

## Decision

**Follow the same proven architecture as coinbase-mcp-server.**

```
Claude Skill = Decision engine + Trading loop
MCP Server   = Data + Execution tools
```

Same separation of concerns:
- MCP Server provides tools for data retrieval and order execution
- Claude Skill contains the trading logic, analysis, and decision loop
- Communication via MCP protocol

## Rationale

- Proven pattern that works in production
- Easier to maintain two projects with similar architecture
- Existing mental model transfers directly
- Real differences are in the API layer and asset types, not architecture
- No need to reinvent what works

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│                Claude Skill                  │
│  ┌─────────────────────────────────────┐    │
│  │  Trading Loop (adaptive polling)     │    │
│  │  - Analyze market conditions         │    │
│  │  - Generate signals                  │    │
│  │  - Risk management                   │    │
│  │  - Execute decisions                 │    │
│  └─────────────────────────────────────┘    │
└─────────────────┬───────────────────────────┘
                  │ MCP Protocol
┌─────────────────▼───────────────────────────┐
│              MCP Server                      │
│  ┌─────────────┐ ┌─────────────────────┐    │
│  │ Market Data │ │ Execution Tools     │    │
│  │ - Portfolio │ │ - place_order       │    │
│  │ - Prices    │ │ - cancel_order      │    │
│  │ - News      │ │ - get_orders        │    │
│  │ - Sentiment │ └─────────────────────┘    │
│  │ - Technicals│                            │
│  └─────────────┘                            │
└─────────────────┬───────────────────────────┘
                  │ WebSocket
┌─────────────────▼───────────────────────────┐
│           Trade Republic API                 │
└─────────────────────────────────────────────┘
```

## Consequences

### Positive
- Consistent architecture across trading bots
- Proven patterns reduce development risk
- Easier knowledge transfer and maintenance
- Can focus engineering effort on TR-specific integration

### Negative
- May not be optimal for TR's specific characteristics
- Locked into MCP protocol constraints
- Monolithic skill may become complex

## References

- coinbase-mcp-server reference project (../coinbase-mcp-server)
- ADR-005: Claude-Driven Trading Decisions
