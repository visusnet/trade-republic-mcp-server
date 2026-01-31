# Task 04: Trade Republic API Service - Final Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement TradeRepublicApiService for authentication, ECDSA key management, WebSocket connection, and basic API communication.

**Architecture:** Modular design with CryptoManager, WebSocketManager, and TradeRepublicApiService. All dependencies injected for testability.

**Tech Stack:** TypeScript, ws (WebSocket), Node.js crypto, Zod

---

## Merge Notes

Both Agent 1 and Agent 2 produced consistent plans. This final plan combines their approaches with:
- Agent 2's modular naming (CryptoManager, WebSocketManager)
- Agent 1's detailed authentication flow documentation
- Both agents' TDD approach with comprehensive test coverage

---

## Step 1: Install Dependencies

**Commands:**
```bash
npm install ws
npm install --save-dev @types/ws
```

**Verification:**
```bash
npm ls ws
```

---

## Step 2: Create TradeRepublicApiService.types.ts

**File:** `src/server/services/TradeRepublicApiService.types.ts`

Constants, enums, and types for:
- TR_WS_URL, TR_API_URL endpoints
- MESSAGE_CODE (A/D/C/E)
- AuthStatus enum
- ConnectionStatus enum
- Error classes (TradeRepublicError, AuthenticationError, WebSocketError)
- Credentials, SessionTokens, WebSocketMessage interfaces

---

## Step 3: Create TradeRepublicApiService.request.ts

**File:** `src/server/services/TradeRepublicApiService.request.ts`

Zod schemas:
- CredentialsSchema (phoneNumber E.164, pin 4 digits)
- TwoFactorCodeSchema (4 digit code)
- SubscribeRequestSchema

---

## Step 4: Create TradeRepublicApiService.response.ts

**File:** `src/server/services/TradeRepublicApiService.response.ts`

Zod schemas:
- LoginResponseSchema (processId)
- TokenResponseSchema (refreshToken, sessionToken)
- ErrorResponseSchema

---

## Step 5: Create CryptoManager Tests (RED)

**File:** `src/server/services/TradeRepublicApiService.crypto.spec.ts`

Tests:
- generateKeyPair() - Creates valid ECDSA P-256 key pair
- saveKeyPair() / loadKeyPair() - Persists to file system
- hasStoredKeyPair() - Checks for existing keys
- sign() - Signs message with SHA-512
- createSignedPayload() - Creates timestamp + signature
- getPublicKeyBase64() - Exports raw public key

---

## Step 6: Create CryptoManager (GREEN)

**File:** `src/server/services/TradeRepublicApiService.crypto.ts`

```typescript
export class CryptoManager {
  constructor(baseDir: string) {}
  generateKeyPair(): Promise<KeyPair>
  saveKeyPair(keyPair: KeyPair): Promise<void>
  loadKeyPair(): Promise<KeyPair | null>
  hasStoredKeyPair(): Promise<boolean>
  sign(message: string, privateKeyPem: string): Promise<string>
  createSignedPayload(data: object, privateKeyPem: string): Promise<SignedPayload>
  getPublicKeyBase64(publicKeyPem: string): string
}
```

---

## Step 7: Create WebSocketManager Tests (RED)

**File:** `src/server/services/TradeRepublicApiService.websocket.spec.ts`

Tests:
- connect() - Establishes connection
- connect() - Sends connection message
- disconnect() - Closes connection
- subscribe() - Sends subscription, returns ID
- unsubscribe() - Sends unsubscribe message
- Message handling - Parses and emits messages
- Error handling - Emits errors for code E

---

## Step 8: Create WebSocketManager (GREEN)

**File:** `src/server/services/TradeRepublicApiService.websocket.ts`

```typescript
export class WebSocketManager extends EventEmitter {
  constructor(wsFactory: WebSocketFactory) {}
  connect(sessionToken: string): Promise<void>
  disconnect(): void
  getStatus(): ConnectionStatus
  subscribe(topic: string, payload?: object): number
  unsubscribe(subscriptionId: number): void
}
```

---

## Step 9: Create TradeRepublicApiService Tests (RED)

**File:** `src/server/services/TradeRepublicApiService.spec.ts`

Tests:
- initialize() - Loads or generates key pair
- login() - Initiates login, returns processId
- verify2FA() - Completes 2FA, receives tokens
- refreshSession() - Refreshes session token
- subscribe() - Subscribes to topic
- disconnect() - Disconnects and cleans up
- Error states - Proper error handling

---

## Step 10: Create TradeRepublicApiService (GREEN)

**File:** `src/server/services/TradeRepublicApiService.ts`

```typescript
export class TradeRepublicApiService {
  constructor(crypto: CryptoManager, ws: WebSocketManager) {}
  initialize(): Promise<void>
  login(credentials: CredentialsInput): Promise<{ processId: string }>
  verify2FA(input: TwoFactorCodeInput): Promise<void>
  refreshSession(): Promise<void>
  ensureValidSession(): Promise<void>
  subscribe(topic: string, payload?: object): number
  unsubscribe(subscriptionId: number): void
  getAuthStatus(): AuthStatus
  disconnect(): void
  onMessage(handler: Function): void
  onError(handler: Function): void
}
```

---

## Step 11: Create Service Factory

**File:** `src/server/services/index.ts`

```typescript
export function createTradeRepublicApiService(): TradeRepublicApiService
```

Factory creates service with default dependencies:
- CryptoManager with ~/.trade-republic-mcp/ config dir
- WebSocketManager with ws library

---

## Step 12: Run Full Verification

**Commands:**
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

**Verification:**
- TypeScript compiles
- ESLint passes
- Prettier formats
- 100% test coverage
- Build succeeds

---

## Summary

| Step | File | Purpose |
|------|------|---------|
| 1 | npm install | Add ws dependency |
| 2 | types.ts | Constants, enums, interfaces, error classes |
| 3 | request.ts | Zod input schemas |
| 4 | response.ts | Zod output schemas |
| 5 | crypto.spec.ts | CryptoManager tests (RED) |
| 6 | crypto.ts | ECDSA key management (GREEN) |
| 7 | websocket.spec.ts | WebSocketManager tests (RED) |
| 8 | websocket.ts | WebSocket connection (GREEN) |
| 9 | TradeRepublicApiService.spec.ts | Main service tests (RED) |
| 10 | TradeRepublicApiService.ts | Main service (GREEN) |
| 11 | index.ts | Factory and exports |
| 12 | Verification | Full validation |

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

---

## Key Technical Details

### ECDSA Configuration
- Curve: NIST P-256 (prime256v1)
- Hash: SHA-512
- Key storage: JSON file with PEM-encoded keys
- Signature format: Base64-encoded DER

### WebSocket Protocol
- URL: `wss://api.traderepublic.com`
- Connect: `connect 31 {locale, platformId, ...}`
- Subscribe: `sub {id} {type: topic, ...}`
- Response: `{id} {A|D|C|E} {json}`

### Authentication Flow
1. Login: POST phone/PIN → processId
2. 2FA: User receives 4-digit code
3. Verify: POST processId/code + signed public key → tokens
4. Connect: WebSocket with session token
5. Refresh: Use refresh token before session expires
