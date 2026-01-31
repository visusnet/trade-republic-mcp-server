# Task 04: Trade Republic API Service - Implementation Plan (Agent 2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement TradeRepublicApiService for authentication, ECDSA key management, WebSocket connection, and basic API communication.

**Architecture:** Modular design with separate crypto, websocket, and main service modules. All dependencies injected for testability.

**Tech Stack:** TypeScript, ws (WebSocket), Node.js crypto, Zod

---

## Summary

The `TradeRepublicApiService` needs to implement:
1. **ECDSA Key Management** - Generate/store/load NIST P-256 keys for device pairing
2. **Authentication Flow** - Phone/PIN login, 2FA handling, session tokens
3. **WebSocket Connection** - Connect to `wss://api.traderepublic.com`, handle reconnection
4. **Subscription Model** - Topic-based messaging with request/response handling
5. **Session Token Management** - Token caching, refresh, and expiration

## File Structure

```
src/server/services/
  TradeRepublicApiService.ts          # Main service class
  TradeRepublicApiService.spec.ts     # Tests
  TradeRepublicApiService.request.ts  # Request Zod schemas
  TradeRepublicApiService.response.ts # Response Zod schemas
  TradeRepublicApiService.types.ts    # Internal types and enums
  TradeRepublicApiService.crypto.ts   # ECDSA key management
  TradeRepublicApiService.crypto.spec.ts
  TradeRepublicApiService.websocket.ts # WebSocket wrapper
  TradeRepublicApiService.websocket.spec.ts
  index.ts                            # Factory and exports
```

## Dependencies to Add

- `ws` - WebSocket client library
- `@types/ws` - TypeScript types

---

## Implementation Steps

### Step 1: Install Dependencies
```bash
npm install ws
npm install --save-dev @types/ws
```

### Step 2: Create types.ts
Constants (TR_WS_URL, MESSAGE_CODE), authentication types, WebSocket types, error classes.

### Step 3: Create request.ts
Zod schemas for CredentialsSchema, TwoFactorCodeSchema, SubscribeRequestSchema.

### Step 4: Create response.ts
Zod schemas for LoginResponseSchema, TokenResponseSchema, ErrorResponseSchema.

### Step 5: Create crypto.spec.ts (RED)
Tests for key generation, save/load, signing, payload creation.

### Step 6: Create crypto.ts (GREEN)
CryptoManager class with ECDSA P-256 key management.

### Step 7: Create websocket.spec.ts (RED)
Tests for connect, disconnect, subscribe, message handling.

### Step 8: Create websocket.ts (GREEN)
WebSocketManager class with topic-based subscription model.

### Step 9: Create TradeRepublicApiService.spec.ts (RED)
Tests for initialize, login, verify2FA, refreshSession, subscribe.

### Step 10: Create TradeRepublicApiService.ts (GREEN)
Main service class integrating crypto and websocket managers.

### Step 11: Create index.ts
Factory function createTradeRepublicApiService() with default dependencies.

### Step 12: Run Full Verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Key Technical Details

### WebSocket Protocol
- URL: `wss://api.traderepublic.com`
- Message format: `{subscription_id} {code} {payload}`
- Response codes: A (snapshot), D (delta), C (confirmation), E (error)

### Authentication Flow
1. POST `/api/v1/auth/web/login` with phone/PIN → processId
2. User receives 4-digit 2FA code
3. POST `/api/v1/auth/web/login/{processId}/{code}` with signed public key → tokens
4. Connect WebSocket with session token

### ECDSA Signing
- Curve: NIST P-256 (prime256v1)
- Hash: SHA-512
- Payload format: `{timestamp}.{json_payload}`
- Headers: X-Zeta-Timestamp, X-Zeta-Signature

---

## Files Created

1. `src/server/services/TradeRepublicApiService.types.ts`
2. `src/server/services/TradeRepublicApiService.request.ts`
3. `src/server/services/TradeRepublicApiService.response.ts`
4. `src/server/services/TradeRepublicApiService.crypto.ts`
5. `src/server/services/TradeRepublicApiService.crypto.spec.ts`
6. `src/server/services/TradeRepublicApiService.websocket.ts`
7. `src/server/services/TradeRepublicApiService.websocket.spec.ts`
8. `src/server/services/TradeRepublicApiService.ts`
9. `src/server/services/TradeRepublicApiService.spec.ts`
10. `src/server/services/index.ts`
