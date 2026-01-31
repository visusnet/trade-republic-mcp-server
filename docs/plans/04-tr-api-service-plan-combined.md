# Task 04: Trade Republic API Service - Combined Implementation Plan

## Overview

Implement TradeRepublicApiService for authentication (phone/PIN, 2FA), ECDSA key management, WebSocket connection, and session management.

## Architecture

Modular design with separate modules:
- `TradeRepublicApiService.crypto.ts` - ECDSA key management (CryptoManager)
- `TradeRepublicApiService.websocket.ts` - WebSocket connection (WebSocketManager)
- `TradeRepublicApiService.ts` - Main orchestration service

All dependencies injected for testability.

## Tech Stack

TypeScript, ws (WebSocket), Node.js crypto, Zod

## Research Summary

Based on Trade_Republic_Connector and pytr analysis:

### Authentication Flow
1. POST `/api/v1/auth/web/login` with phone/PIN → processId
2. User receives 4-digit 2FA code via app
3. POST `/api/v1/auth/web/login/{processId}/{code}` with ECDSA public key → tokens
4. Connect WebSocket with session token

### ECDSA Configuration
- Curve: NIST P-256 (prime256v1)
- Hash: SHA-512
- Signature format: ieee-p1363 (fixed-length)
- Payload: `{timestamp}.{body}` signed

### WebSocket Protocol
- URL: `wss://api.traderepublic.com`
- Connect message: `connect 31 {}` (web mode)
- Subscribe: `sub {id} {json_payload}`
- Unsubscribe: `unsub {id}`
- Response codes: A (answer), D (delta), C (complete), E (error)

## File Structure

```
src/server/services/
  TradeRepublicApiService.ts          # Main service class
  TradeRepublicApiService.spec.ts     # Tests
  TradeRepublicApiService.request.ts  # Request Zod schemas
  TradeRepublicApiService.response.ts # Response Zod schemas
  TradeRepublicApiService.types.ts    # Types, enums, constants
  TradeRepublicApiService.crypto.ts   # CryptoManager class
  TradeRepublicApiService.crypto.spec.ts
  TradeRepublicApiService.websocket.ts # WebSocketManager class
  TradeRepublicApiService.websocket.spec.ts
  index.ts                            # Factory and exports
```

## Implementation Steps

### Step 1: Install Dependencies
```bash
npm install ws
npm install --save-dev @types/ws
```

### Step 2: Create types.ts
- TR_API_URL, TR_WS_URL constants
- AuthStatus enum (Unauthenticated, Awaiting2FA, Authenticated)
- MESSAGE_CODE constants (A, D, C, E)
- Error classes (TradeRepublicError, AuthenticationError)
- TypeScript interfaces (SessionTokens, KeyPair, etc.)

### Step 3: Create request.ts
- CredentialsSchema (phoneNumber, pin)
- TwoFactorCodeSchema (4 digits)
- SubscribeRequestSchema (topic, payload)

### Step 4: Create response.ts
- LoginResponseSchema (processId)
- TokenResponseSchema (refreshToken, sessionToken)
- RefreshTokenResponseSchema
- ErrorResponseSchema

### Step 5: Create crypto.spec.ts (RED)
Tests for key generation, save/load, signing, getPublicKeyBase64.

### Step 6: Create crypto.ts (GREEN)
CryptoManager class with ECDSA P-256 operations.

### Step 7: Create websocket.spec.ts (RED)
Tests for connect, disconnect, subscribe, unsubscribe, message handling.

### Step 8: Create websocket.ts (GREEN)
WebSocketManager class with topic-based subscription model.

### Step 9: Create TradeRepublicApiService.spec.ts (RED)
Tests for initialize, login, verify2FA, refreshSession, ensureValidSession, subscribe, disconnect.

### Step 10: Create TradeRepublicApiService.ts (GREEN)
Main service class integrating CryptoManager and WebSocketManager.

### Step 11: Create index.ts
Factory function createTradeRepublicApiService() with default dependencies. Export all public types and classes.

### Step 12: Run Full Verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

## Key Technical Details

### Session Token Management
- Session expires after ~55 minutes
- Refresh 5 minutes before expiration
- Use refreshToken to get new sessionToken

### WebSocket Message Format
- Subscribe: `sub {id} {"type":"{topic}",...payload}`
- Response: `{id} {code} {json_payload}`
- Codes: A=answer, D=delta, C=complete, E=error

### Error Handling
- AuthenticationError for auth failures
- TradeRepublicError for API errors
- Proper cleanup on disconnect
