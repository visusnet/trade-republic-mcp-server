# Task 04: Trade Republic API Service - Implementation Plan (Agent 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement TradeRepublicApiService for authentication, ECDSA key management, WebSocket connection, and basic API communication.

**Architecture:** Three-class design: TradeRepublicCredentials (crypto), TradeRepublicWebSocket (connection), TradeRepublicApiService (orchestration).

**Tech Stack:** TypeScript, ws (WebSocket), Node.js crypto, Zod

---

## Research Summary

Based on Trade_Republic_Connector and pytr analysis:

### Authentication Flow
1. Device reset: POST phone number → receive processId
2. 2FA: User receives 4-digit code via app
3. Register device key: POST processId + code + ECDSA public key → tokens
4. Login: POST phone + PIN with signed request → processId
5. 2FA verification: Complete with code → session token

### ECDSA Configuration
- Curve: NIST P-256 (prime256v1)
- Hash: SHA-512
- Signature format: ieee-p1363 (fixed-length)
- Payload: `{timestamp}{body}` signed

### WebSocket Protocol
- URL: `wss://api.traderepublic.com`
- Connect message: `connect 21 {}` (mobile) or `connect 31 {}` (web)
- Subscribe: `sub {id} {json_payload}`
- Unsubscribe: `unsub {id}`
- Response format: `{id} {status} {json_payload}`

---

## File Structure

```
src/server/services/
  TradeRepublicApiService.ts
  TradeRepublicApiService.spec.ts
  TradeRepublicApiService.types.ts
  TradeRepublicApiService.request.ts
  TradeRepublicApiService.response.ts
  TradeRepublicCredentials.ts
  TradeRepublicCredentials.spec.ts
  TradeRepublicWebSocket.ts
  TradeRepublicWebSocket.spec.ts
  index.ts
src/test/
  wsMock.ts
```

---

## Implementation Steps

### Step 1: Install ws dependency
```bash
npm install ws
npm install --save-dev @types/ws
```

### Step 2: Create types.ts
- AuthState enum (Disconnected, Connecting, Awaiting2FA, Authenticated)
- ConnectionState enum
- TR_API_ENDPOINTS constants
- WS_MESSAGE_TYPES constants
- TradeRepublicConfig interface

### Step 3: Create request.ts
- DeviceResetRequestSchema (phoneNumber)
- DeviceKeyRequestSchema (processId, code, publicKey)
- LoginRequestSchema (phoneNumber, pin)
- TwoFactorCodeSchema (4 digits)

### Step 4: Create response.ts
- DeviceResetResponseSchema
- DeviceKeyResponseSchema
- LoginResponseSchema
- CashResponseSchema
- PortfolioResponseSchema

### Step 5: Create TradeRepublicCredentials (TDD)
- generateKeyPair() - ECDSA P-256
- getPublicKeyBase64() - Export public key
- sign(timestamp, body) - Sign with SHA-512
- loadFromFile() / saveToFile() - Persist keys

### Step 6: Create TradeRepublicWebSocket (TDD)
- connect() - Establish connection
- disconnect() - Clean close
- subscribe(topic, params, callback) - Topic subscription
- unsubscribe(id) - Remove subscription
- handleMessage() - Route responses
- Reconnection with exponential backoff

### Step 7: Create TradeRepublicApiService (TDD)
- initiateDeviceReset() - Start device registration
- completeDeviceReset(code) - Complete with 2FA
- login() - Authenticate with PIN
- verify2FA(code) - Complete authentication
- connect() - Establish WebSocket
- getCash() - Get cash balance
- getPortfolio() - Get positions

### Step 8: Create wsMock.ts test helper

### Step 9: Create index.ts exports

### Step 10: Run full verification
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Files Created

1. `src/server/services/TradeRepublicApiService.types.ts`
2. `src/server/services/TradeRepublicApiService.request.ts`
3. `src/server/services/TradeRepublicApiService.response.ts`
4. `src/server/services/TradeRepublicCredentials.ts`
5. `src/server/services/TradeRepublicCredentials.spec.ts`
6. `src/server/services/TradeRepublicWebSocket.ts`
7. `src/server/services/TradeRepublicWebSocket.spec.ts`
8. `src/server/services/TradeRepublicApiService.ts`
9. `src/server/services/TradeRepublicApiService.spec.ts`
10. `src/server/services/index.ts`
11. `src/test/wsMock.ts`
