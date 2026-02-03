# Authentication Flow Implementation Plan

## Overview

Implement lazy authentication with 2FA flow per ADR-018.

## Prerequisites

- Read design: `docs/adr/018-authentication-flow.md`
- Read rules: `.claude/rules/testing.md`, `.claude/rules/workflow.md`, `.claude/rules/zod.md`
- Reference: `../coinbase-mcp-server/src/index.ts`, `../coinbase-mcp-server/src/server/CoinbaseMcpServer.ts`

## Phase 1: TradeRepublicCredentials Class

### Step 1.1: Create TradeRepublicCredentials.spec.ts (RED)

Location: `src/server/services/TradeRepublicCredentials.spec.ts`

Write failing tests for:
1. `should store phone number and pin`
2. `should throw on empty phone number`
3. `should throw on empty pin`
4. `should mask phone number correctly` (e.g., `+491701234567` → `+49170***67`)

### Step 1.2: Create TradeRepublicCredentials.ts (GREEN)

Location: `src/server/services/TradeRepublicCredentials.ts`

```typescript
export class TradeRepublicCredentials {
  constructor(
    public readonly phoneNumber: string,
    public readonly pin: string,
  ) {
    // Validation
  }

  public getMaskedPhoneNumber(): string {
    // country code + first 3 digits + *** + last 2 digits
  }
}
```

### Step 1.3: Refactor

- Add JSDoc comments
- Verify 100% coverage

## Phase 2: TwoFactorCodeRequiredException

### Step 2.1: Add to TradeRepublicApiService.types.ts

Add new exception class:

```typescript
export class TwoFactorCodeRequiredException extends TradeRepublicError {
  constructor(maskedPhoneNumber: string) {
    super(
      `2FA code required. A code has been sent to ${maskedPhoneNumber}. Call enter_two_factor_code with the code.`,
      'TWO_FACTOR_REQUIRED',
    );
    this.name = 'TwoFactorCodeRequiredException';
  }
}
```

No separate tests needed - tested via service tests.

## Phase 3: Request/Response Schemas

### Step 3.1: Create TradeRepublicApiService.request.ts updates

Add schema for `enterTwoFactorCode`:

```typescript
export const EnterTwoFactorCodeRequestSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .describe('The 2FA code received via SMS'),
  })
  .describe('Request to enter the two-factor authentication code');

export type EnterTwoFactorCodeRequest = z.output<typeof EnterTwoFactorCodeRequestSchema>;
```

### Step 3.2: Create TradeRepublicApiService.response.ts updates

Add schema for `enterTwoFactorCode` response:

```typescript
export const EnterTwoFactorCodeResponseSchema = z
  .object({
    message: z.string().describe('Result message'),
  })
  .describe('Response from entering the two-factor authentication code');

export type EnterTwoFactorCodeResponse = z.output<typeof EnterTwoFactorCodeResponseSchema>;
```

## Phase 4: TradeRepublicApiService Refactoring

### Step 4.1: Update constructor signature

Change from:
```typescript
constructor(
  credentials: CredentialsInput,
  private readonly crypto: CryptoManager,
  private readonly ws: WebSocketManager,
  private readonly fetchFn: FetchFunction,
)
```

To:
```typescript
constructor(credentials: TradeRepublicCredentials)
```

Internal dependencies (`CryptoManager`, `WebSocketManager`, `fetch`) become private properties instantiated internally.

### Step 4.2: Update tests to use jest.mock

Replace constructor injection with `jest.mock`:

```typescript
jest.mock('./TradeRepublicApiService.crypto');
jest.mock('./TradeRepublicApiService.websocket');

// In tests:
const mockCryptoManager = jest.mocked(CryptoManager);
const mockWebSocketManager = jest.mocked(WebSocketManager);
```

### Step 4.3: Add lazy auth to subscribeAndWait (RED)

Write failing tests:
1. `should throw TwoFactorCodeRequiredException when not authenticated`
2. `should trigger login flow when subscribeAndWait called without auth`
3. `should work normally after authentication`

### Step 4.4: Implement lazy auth in subscribeAndWait (GREEN)

Add authentication check at start of `subscribeAndWait()`:

```typescript
public async subscribeAndWait<T>(...): Promise<T> {
  await this.ensureAuthenticatedOrThrow();
  // ... existing implementation
}

private async ensureAuthenticatedOrThrow(): Promise<void> {
  if (this.authStatus === AuthStatus.AUTHENTICATED) {
    await this.ensureValidSession();
    return;
  }

  // Not authenticated - trigger login flow
  await this.initialize();
  await this.login();
  // Now in AWAITING_2FA state
  throw new TwoFactorCodeRequiredException(this.credentials.getMaskedPhoneNumber());
}
```

### Step 4.5: Add enterTwoFactorCode method (RED)

Write failing tests:
1. `should complete authentication with valid code`
2. `should return error message with invalid code`
3. `should return error message and send new code when expired`
4. `should throw if not in AWAITING_2FA state`

### Step 4.6: Implement enterTwoFactorCode (GREEN)

```typescript
public async enterTwoFactorCode(
  request: EnterTwoFactorCodeRequest,
): Promise<EnterTwoFactorCodeResponse> {
  // Validate state
  // Call verify2FA
  // Handle success/failure
  // Return appropriate message
}
```

### Step 4.7: Remove public connect() method

- Make `connect()` private or remove entirely
- Update any existing tests that use `connect()`

### Step 4.8: Remove disconnect() and getAuthStatus()

- Remove these public methods
- Update any dependent code

### Step 4.9: Refactor

- Clean up code
- Ensure 100% coverage
- Add JSDoc comments

## Phase 5: AuthToolRegistry

### Step 5.1: Create AuthToolRegistry.spec.ts (RED)

Location: `src/server/tools/AuthToolRegistry.spec.ts`

Write failing tests:
1. `should register enter_two_factor_code tool`
2. `should call apiService.enterTwoFactorCode with parsed request`
3. `should return success message on successful auth`
4. `should return error message on invalid code`

### Step 5.2: Create AuthToolRegistry.ts (GREEN)

Location: `src/server/tools/AuthToolRegistry.ts`

```typescript
export class AuthToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly apiService: TradeRepublicApiService,
  ) {
    super(server);
  }

  public register(): void {
    this.server.registerTool(
      'enter_two_factor_code',
      {
        description: 'Enter the 2FA code to complete authentication',
        inputSchema: EnterTwoFactorCodeRequestSchema,
      },
      async (request) => {
        const response = await this.apiService.enterTwoFactorCode(request);
        return { content: [{ type: 'text', text: JSON.stringify(response) }] };
      },
    );
  }
}
```

### Step 5.3: Refactor

- Ensure consistent with other tool registries
- Add tool description

## Phase 6: Update Entry Point

### Step 6.1: Update src/index.ts

```typescript
#!/usr/bin/env node
import { config } from 'dotenv';
import { TradeRepublicMcpServer } from './server/TradeRepublicMcpServer.js';
import { logger } from './logger';

config({ quiet: true });

function main() {
  const phoneNumber = process.env.TR_PHONE_NUMBER;
  const pin = process.env.TR_PIN;

  if (!phoneNumber || !pin) {
    logger.server.error(
      'TR_PHONE_NUMBER and TR_PIN environment variables must be set',
    );
    process.exit(1);
  }

  const server = new TradeRepublicMcpServer(phoneNumber, pin);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port);
}

main();
```

### Step 6.2: Update src/index.spec.ts

Write tests for:
1. `should exit with error if TR_PHONE_NUMBER not set`
2. `should exit with error if TR_PIN not set`
3. `should create server with credentials when env vars set`

## Phase 7: Update TradeRepublicMcpServer

### Step 7.1: Update constructor

Change from:
```typescript
constructor(apiService?: TradeRepublicApiService)
```

To:
```typescript
constructor(phoneNumber: string, pin: string)
```

Create credentials and apiService internally.

### Step 7.2: Register AuthToolRegistry

```typescript
private registerToolsForServer(server: McpServer): void {
  // Auth tools (always available)
  const authToolRegistry = new AuthToolRegistry(server, this.apiService);
  authToolRegistry.register();

  // Other tools...
}
```

### Step 7.3: Update TradeRepublicMcpServer.spec.ts

- Update tests for new constructor signature
- Add tests for auth tool registration

## Phase 8: Update Exports

### Step 8.1: Update src/server/services/index.ts

Export:
- `TradeRepublicCredentials`
- `EnterTwoFactorCodeRequest`, `EnterTwoFactorCodeResponse`
- `TwoFactorCodeRequiredException`

### Step 8.2: Update src/server/tools/index.ts

Export:
- `AuthToolRegistry`

## Phase 9: Create .env.example

Create `/.env.example`:

```
# Trade Republic Credentials
TR_PHONE_NUMBER=+491701234567
TR_PIN=1234

# Server Configuration
PORT=3000
```

## Phase 10: Verification

Run full verification pipeline:

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

All checks must pass with 100% coverage.

## Notes

- Use `jest.mock` for CryptoManager and WebSocketManager in all TradeRepublicApiService tests
- 2FA code length is not assumed - only validated as non-empty string
- Session refresh logic remains unchanged
- Existing services (PortfolioService, MarketDataService, etc.) remain unchanged - they already use subscribeAndWait()
