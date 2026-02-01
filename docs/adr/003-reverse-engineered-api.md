# ADR-003: Reverse-Engineered API Integration

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Trade Republic does not provide a public API. The bot needs to interface with Trade Republic to execute trades and retrieve market data.

## Problem

How should the bot interface with Trade Republic given the lack of official API?

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Reverse-engineered API (pytr-style) | Most practical, well-documented by community | May break with app updates, ToS risk |
| Browser automation (Playwright) | Works with any web interface | Slow, brittle, complex to maintain |
| Mobile app automation (ADB) | Direct app control | Very complex, device-dependent |
| Official API access | Stable, supported | Does not exist publicly |

## Decision

**Use the reverse-engineered API approach (like pytr).**

The Trade Republic API has been reverse-engineered by several community projects (pytr, Trade_Republic_Connector) and uses WebSocket for communication with topic-based subscriptions.

## Rationale

- Most practical path since Trade Republic doesn't offer a public API
- pytr and Trade_Republic_Connector projects have already reverse-engineered the protocol
- WebSocket-based communication is well understood and documented
- ECDSA authentication pattern is proven to work

## Consequences

### Positive
- Can leverage existing community knowledge and patterns
- WebSocket enables real-time data when needed
- Works with all TR features (stocks, ETFs, crypto, derivatives)

### Negative
- API may change without notice when TR updates their app
- Potential Terms of Service violation risk
- Only one device can be logged in at a time
- Need to handle 2FA manually for each session

## References

- pytr GitHub: https://github.com/pytr-org/pytr
- Trade_Republic_Connector: https://github.com/cdamken/Trade_Republic_Connector
- ADR-001: Trade Republic API Integration Approach
