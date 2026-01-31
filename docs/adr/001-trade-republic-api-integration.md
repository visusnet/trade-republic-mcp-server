# ADR-001: Trade Republic API Integration Approach

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

Trade Republic does not provide an official, publicly-documented API. All available integrations are reverse-engineered from the mobile app and web interface. This ADR documents our research findings and decision on how to integrate with Trade Republic.

## Research Findings

### Official API Status

Trade Republic explicitly:
- Does NOT provide API access
- Does NOT support automated trading
- Enforces single-device login (only one device can be logged in at a time)

Using unofficial APIs may violate their Terms of Service.

### Available Implementations

| Project | Language | Status | Key Features |
|---------|----------|--------|--------------|
| Trade_Republic_Connector | TypeScript | Active | ECDSA auth, WebSocket, device pairing, trading |
| pytr | Python | Active | CLI tool, document download, data export |
| trade-republic-api (npm) | TypeScript | Low maintenance | Basic API wrapper |
| TradeRepublicApi | Python | Experimental | Algorithmic trading experiments |

### API Architecture

- **Protocol**: WebSocket (not REST)
- **Communication**: Topic-based subscription model
- **Authentication**: Phone + PIN + 2FA (device-based or SMS)
- **Cryptography**: ECDSA for device pairing and signatures

### Authentication Flow

1. Register device with phone number
2. Enter PIN
3. Complete 2FA (4-digit code to registered device or SMS)
4. Receive session token
5. Maintain WebSocket connection

**Critical Limitation**: Only ONE device can be logged in at a time. Using the API logs out the mobile app.

### Security Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| ToS violation | High | User acknowledgment, documentation |
| API changes without notice | High | Robust error handling, version tracking |
| Account lockout | Medium | Rate limiting, conservative request patterns |
| Session management | Medium | Token caching, graceful re-auth |
| 2FA requirement | Medium | Interactive approval for new sessions |

## Decision

We will implement our own Trade Republic API client in TypeScript, using **Trade_Republic_Connector** as the primary reference for:
- ECDSA authentication implementation
- WebSocket message format and topics
- Device pairing flow
- Trading operations

### Rationale

1. **TypeScript native**: Trade_Republic_Connector is TypeScript, matching our project
2. **Production-ready**: Has working authentication and trading operations
3. **Active maintenance**: Recently updated with real user base
4. **Complete features**: Supports all required operations (auth, portfolio, trading)

### What We Will NOT Do

- Use the `trade-republic-api` npm package (poorly maintained)
- Copy code directly (will implement our own following patterns)
- Assume API stability (will build robust error handling)

## Implementation Guidelines

### Authentication
- Implement ECDSA key generation and storage
- Support both device-based and SMS 2FA
- Cache session tokens with secure storage
- Handle graceful re-authentication on expiry

### WebSocket Communication
- Implement topic subscription model
- Handle connection drops with exponential backoff
- Parse binary/JSON message formats
- Maintain heartbeat for connection health

### Rate Limiting
- Conservative default: max 1 request/second
- Exponential backoff on errors
- Circuit breaker for repeated failures

### Error Handling
- Expect and handle breaking changes
- Log all API interactions for debugging
- Graceful degradation when endpoints change

## Consequences

### Positive
- Full control over implementation
- TypeScript-native with proper types
- Can optimize for MCP server use case
- Reference implementation available

### Negative
- No official support or documentation
- API may break without notice
- Potential ToS concerns
- Single-device limitation affects architecture

### Risks Accepted
- User must acknowledge unofficial API usage
- Must maintain compatibility with changing API
- May need periodic updates when TR changes endpoints

## References

- [Trade_Republic_Connector](https://github.com/cdamken/Trade_Republic_Connector) - Primary TypeScript reference
- [pytr](https://github.com/pytr-org/pytr) - Python reference for architecture patterns
- [pytr PyPI](https://pypi.org/project/pytr/) - Python package documentation
- [Trade Republic Community](https://www.traderepublic.community/) - Community discussions

## Open Questions

1. **Long-lived sessions**: Can we maintain sessions without repeated 2FA?
2. **Rate limits**: What are the actual rate limits (undocumented)?
3. **WebSocket reconnection**: How to handle connection drops gracefully?
4. **Data freshness**: What's the latency for real-time price updates?

These will be answered during Task 04 (API Service Implementation).
