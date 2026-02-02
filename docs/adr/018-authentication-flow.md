# ADR-018: Lazy Authentication with Two-Factor Code Flow

**Status:** Accepted
**Date:** 2026-02-02
**Decision Makers:** Alexander Rose, Claude

## Context

Trade Republic requires two-factor authentication (2FA) for all API access. The user must:
1. Provide phone number and PIN
2. Receive a 2FA code via SMS
3. Submit the 2FA code to complete authentication

The MCP server needs to handle this flow in a way that allows Claude to interact with the API while the user provides the 2FA code interactively.

## Problem

How should the MCP server handle authentication when:
- Phone number and PIN can be stored in environment variables
- The 2FA code must be provided interactively by the user
- Claude needs to know when authentication is required and how to complete it

## Decision

### 1. Credentials from Environment Variables

Phone number and PIN are loaded from environment variables in `src/index.ts`:

```typescript
import { config } from 'dotenv';
config({ quiet: true });

function main() {
  const phoneNumber = process.env.TR_PHONE_NUMBER;
  const pin = process.env.TR_PIN;

  if (!phoneNumber || !pin) {
    logger.server.error('TR_PHONE_NUMBER and TR_PIN must be set');
    process.exit(1);
  }

  const server = new TradeRepublicMcpServer(phoneNumber, pin);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port);
}

main();
```

### 2. Lazy Authentication

Authentication is triggered lazily when `subscribeAndWait()` is called and the user is not authenticated:

1. Claude calls any MCP tool that requires API access (e.g., `get_portfolio`)
2. The tool calls `subscribeAndWait()` on `TradeRepublicApiService`
3. `subscribeAndWait()` detects the user is not authenticated
4. It calls `initialize()` and `login()` internally
5. It throws `TwoFactorCodeRequiredException` with a message including the masked phone number

### 3. Two-Factor Code Entry via MCP Tool

A new MCP tool `enter_two_factor_code` allows Claude to submit the 2FA code:

```typescript
// Request
{ code: "123456" }

// Response (success)
{ message: "Authentication successful" }

// Response (wrong code)
{ message: "The 2FA code was incorrect. Please ask the user for a new code and try again." }

// Response (expired, new code sent)
{ message: "The 2FA code expired. A new code has been sent. Please ask the user for the new code." }
```

### 4. Exception Message Format

The `TwoFactorCodeRequiredException` message includes a masked phone number:

```
2FA code required. A code has been sent to +49170***67. Call enter_two_factor_code with the code.
```

Phone masking format: country code + first 3 digits + `***` + last 2 digits.

### 5. No Dependency Injection for Internals

`CryptoManager`, `WebSocketManager`, and `fetch` are internal implementation details of `TradeRepublicApiService`. They are not injected via constructor but mocked using `jest.mock` in tests.

### 6. Simplified Public API

```typescript
class TradeRepublicApiService {
  constructor(credentials: TradeRepublicCredentials)
  enterTwoFactorCode(request: EnterTwoFactorCodeRequest): Promise<EnterTwoFactorCodeResponse>
  subscribeAndWait<T>(topic, payload, schema): Promise<T>
}
```

- No `connect()` method (authentication is lazy)
- No `disconnect()` method
- No `getAuthStatus()` method

## Flow Diagram

```
Claude: get_portfolio()
    │
    ▼
subscribeAndWait() → Not authenticated?
    │                       │
    │                       ▼
    │               initialize() + login()
    │                       │
    │                       ▼
    │               throw TwoFactorCodeRequiredException
    │               "2FA code required. A code has been sent to +49170***67..."
    │
    ▼
Claude: enter_two_factor_code({ code: "123456" })
    │
    ▼
Success? ─────────────────────────────────────────┐
    │                                              │
    │ No (wrong code)                              │ Yes
    ▼                                              ▼
{ message: "Code was incorrect..." }     { message: "Authentication successful" }
    │                                              │
    ▼                                              ▼
Claude asks user for new code              Claude: get_portfolio() (retry)
                                                   │
                                                   ▼
                                           { positions: [...] }
```

## Rationale

1. **Lazy authentication** - No need to call a separate login tool; authentication happens automatically when needed
2. **Single exception type** - Only `TwoFactorCodeRequiredException` for all "need 2FA" scenarios; simple for Claude to handle
3. **Message-based responses** - `enterTwoFactorCode()` returns messages rather than throwing exceptions; clearer UX
4. **Auto-retry on expiry** - If the 2FA code expires, the service automatically sends a new code and returns a message
5. **No DI for internals** - Keeps the public API clean; `jest.mock` is sufficient for testing
6. **Environment variables** - Phone and PIN stay on the server; never transmitted via MCP

## Consequences

### Positive

- Simple flow for Claude: call tool → get exception → call `enter_two_factor_code` → retry
- Resilient to session expiry: next API call re-triggers authentication
- Matches coinbase-mcp-server patterns for credentials handling
- Secure: credentials never leave the server

### Negative

- Any authenticated tool can throw `TwoFactorCodeRequiredException`
- Need to handle 2FA flow before any real work can begin
- SMS delivery delays may cause timeouts

## New Components

1. **TradeRepublicCredentials** - Class holding phone number and PIN
2. **TwoFactorCodeRequiredException** - Exception thrown when 2FA is required
3. **AuthToolRegistry** - MCP tool registry for `enter_two_factor_code`
4. **EnterTwoFactorCodeRequest/Response** - Zod schemas for the 2FA tool

## References

- ADR-001: Trade Republic API Integration Approach
- ADR-015: WebSocket-Based API Communication
- coinbase-mcp-server credentials pattern
