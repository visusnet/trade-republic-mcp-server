# Task 05: Portfolio Tools - Final Implementation Plan

## Overview

Implement `get_portfolio` and `get_cash_balance` MCP tools for the Trade Republic trading bot.

## Verification Notes

Both verification agents confirmed:
- **MESSAGE_CODE.A and MESSAGE_CODE.E exist** in TradeRepublicApiService.types.ts
- **Topic names verified**: `compactPortfolio` and `cash` are correct per pytr source
- **Response field names may vary** - using `.passthrough()` and accepting both possible names

### Field Name Discrepancies Found

| Plan Field | pytr Field | Resolution |
|------------|------------|------------|
| `availableCash` | `amount` | Accept both with transform |
| `currency` | `currencyId` | Accept both with transform |
| `unrealisedAverageCost` | `averageBuyIn` | Accept both with transform |

---

## Architecture

```
TradeRepublicMcpServer
    └── PortfolioToolRegistry (new)
            └── PortfolioService (new)
                    └── TradeRepublicApiService (existing)
```

## File Structure

**New files:**
- `src/server/services/PortfolioService.ts`
- `src/server/services/PortfolioService.spec.ts`
- `src/server/services/PortfolioService.request.ts`
- `src/server/services/PortfolioService.response.ts`
- `src/server/tools/PortfolioToolRegistry.ts`
- `src/server/tools/PortfolioToolRegistry.spec.ts`
- `src/server/tools/index.ts`

**Modified files:**
- `src/server/services/TradeRepublicApiService.ts` - Add offMessage/offError methods
- `src/server/services/TradeRepublicApiService.spec.ts` - Add tests for new methods
- `src/server/services/index.ts` - Export new modules
- `src/server/TradeRepublicMcpServer.ts` - Integrate services and tools

---

## Implementation Steps

### Step 1: Add offMessage/offError to TradeRepublicApiService

**File:** `src/server/services/TradeRepublicApiService.ts`

**Tests first (RED phase)** - Add to `TradeRepublicApiService.spec.ts`:

```typescript
describe('offMessage', () => {
  it('should remove a registered message handler', async () => {
    await service.initialize();
    const handler = jest.fn();
    service.onMessage(handler);
    service.offMessage(handler);

    const message = { id: 1, code: 'A', payload: { test: true } };
    mockWs.emit('message', message);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should do nothing if handler not found', async () => {
    await service.initialize();
    const handler = jest.fn();
    expect(() => service.offMessage(handler)).not.toThrow();
  });
});

describe('offError', () => {
  it('should remove a registered error handler', async () => {
    await service.initialize();
    const handler = jest.fn();
    service.onError(handler);
    service.offError(handler);

    const error = new Error('Test error');
    mockWs.emit('error', error);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should do nothing if handler not found', async () => {
    await service.initialize();
    const handler = jest.fn();
    expect(() => service.offError(handler)).not.toThrow();
  });
});
```

**Implementation (GREEN phase)** - Add after `onError` method (around line 340):

```typescript
/**
 * Removes a message handler.
 */
offMessage(handler: (message: WebSocketMessage) => void): void {
  const index = this.messageHandlers.indexOf(handler);
  if (index !== -1) {
    this.messageHandlers.splice(index, 1);
  }
}

/**
 * Removes an error handler.
 */
offError(handler: (error: Error | WebSocketMessage) => void): void {
  const index = this.errorHandlers.indexOf(handler);
  if (index !== -1) {
    this.errorHandlers.splice(index, 1);
  }
}
```

---

### Step 2: Create PortfolioService.request.ts

**File:** `src/server/services/PortfolioService.request.ts`

```typescript
/**
 * Portfolio Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Request schema for get_portfolio tool.
 * No parameters required - retrieves current portfolio.
 */
export const GetPortfolioRequestSchema = z
  .object({})
  .describe('Request parameters for getting portfolio');

export type GetPortfolioRequest = z.output<typeof GetPortfolioRequestSchema>;

/**
 * Request schema for get_cash_balance tool.
 * No parameters required - retrieves current cash balance.
 */
export const GetCashBalanceRequestSchema = z
  .object({})
  .describe('Request parameters for getting cash balance');

export type GetCashBalanceRequest = z.output<typeof GetCashBalanceRequestSchema>;
```

---

### Step 3: Create PortfolioService.response.ts

**File:** `src/server/services/PortfolioService.response.ts`

Note: Using `.passthrough()` and transforms to handle field name variations.

```typescript
/**
 * Portfolio Service - Response Schemas
 *
 * Field names based on Trade Republic API research (pytr).
 * Schemas use passthrough() to allow additional fields from API.
 */

import { z } from 'zod';

/**
 * Portfolio position schema
 * Handles field name variations between different API versions
 */
export const PortfolioPositionSchema = z
  .object({
    instrumentId: z.string(),
    netSize: z.union([z.number(), z.string()]).transform((v) => Number(v)),
    netValue: z.number(),
    // Accept both field name variations
    averageBuyIn: z.number().optional(),
    unrealisedAverageCost: z.number().optional(),
    realisedProfit: z.number().optional(),
  })
  .passthrough()
  .transform((data) => ({
    instrumentId: data.instrumentId,
    netSize: data.netSize,
    netValue: data.netValue,
    averageCost: data.averageBuyIn ?? data.unrealisedAverageCost ?? 0,
    realisedProfit: data.realisedProfit ?? 0,
  }));

export type PortfolioPosition = z.output<typeof PortfolioPositionSchema>;

/**
 * Portfolio response schema
 */
export const GetPortfolioResponseSchema = z
  .object({
    positions: z.array(PortfolioPositionSchema),
    netValue: z.number(),
    referenceChangeProfit: z.number().optional(),
    referenceChangeProfitPercent: z.number().optional(),
    unrealisedProfit: z.number().optional(),
    unrealisedProfitPercent: z.number().optional(),
    unrealisedCost: z.number().optional(),
  })
  .passthrough();

export type GetPortfolioResponse = z.output<typeof GetPortfolioResponseSchema>;

/**
 * Cash balance response schema
 * Handles field name variations (amount/availableCash, currencyId/currency)
 */
export const GetCashBalanceResponseSchema = z
  .object({
    // Accept both field name variations
    amount: z.number().optional(),
    availableCash: z.number().optional(),
    currencyId: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough()
  .transform((data) => ({
    availableCash: data.amount ?? data.availableCash ?? 0,
    currency: data.currencyId ?? data.currency ?? 'EUR',
  }));

export type GetCashBalanceResponse = z.output<typeof GetCashBalanceResponseSchema>;
```

---

### Step 4: Create PortfolioService.spec.ts (RED Phase)

**File:** `src/server/services/PortfolioService.spec.ts`

Key test cases:
1. `getPortfolio()` - throws if not authenticated
2. `getPortfolio()` - subscribes to compactPortfolio topic
3. `getPortfolio()` - resolves with validated data on success
4. `getPortfolio()` - rejects on API error (code E)
5. `getPortfolio()` - rejects on timeout
6. `getPortfolio()` - cleans up (unsubscribe + remove handlers) on success
7. `getPortfolio()` - cleans up on error
8. `getPortfolio()` - cleans up on timeout
9. `getPortfolio()` - ignores messages for other subscription IDs
10. `getPortfolio()` - handles WebSocket errors
11. `getCashBalance()` - same pattern as above for cash topic

---

### Step 5: Create PortfolioService.ts (GREEN Phase)

**File:** `src/server/services/PortfolioService.ts`

```typescript
/**
 * Portfolio Service
 *
 * Provides methods for retrieving portfolio and cash balance data
 * from the Trade Republic API via WebSocket subscriptions.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type { GetPortfolioRequest, GetCashBalanceRequest } from './PortfolioService.request';
import {
  GetPortfolioResponseSchema,
  GetCashBalanceResponseSchema,
  type GetPortfolioResponse,
  type GetCashBalanceResponse,
} from './PortfolioService.response';

const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;

export class PortfolioService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  async getPortfolio(_request?: GetPortfolioRequest): Promise<GetPortfolioResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting portfolio data');
    return this.subscribeAndWait<GetPortfolioResponse>(
      'compactPortfolio',
      GetPortfolioResponseSchema,
    );
  }

  async getCashBalance(_request?: GetCashBalanceRequest): Promise<GetCashBalanceResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting cash balance data');
    return this.subscribeAndWait<GetCashBalanceResponse>('cash', GetCashBalanceResponseSchema);
  }

  private subscribeAndWait<T>(
    topic: string,
    schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } },
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let subscriptionId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.api.offMessage(messageHandler);
        this.api.offError(errorHandler);
        if (subscriptionId !== null) {
          try {
            this.api.unsubscribe(subscriptionId);
          } catch {
            // Ignore unsubscribe errors during cleanup
          }
        }
      };

      const messageHandler = (message: WebSocketMessage): void => {
        if (resolved || message.id !== subscriptionId) {
          return;
        }

        if (message.code === MESSAGE_CODE.E) {
          resolved = true;
          cleanup();
          const errorPayload = message.payload as { message?: string } | undefined;
          const errorMessage = errorPayload?.message || 'API error';
          logger.api.error({ payload: message.payload }, `${topic} subscription error`);
          reject(new TradeRepublicError(errorMessage));
          return;
        }

        if (message.code === MESSAGE_CODE.A) {
          resolved = true;
          cleanup();
          const parseResult = schema.safeParse(message.payload);
          if (parseResult.success) {
            logger.api.debug({ topic }, 'Received subscription data');
            resolve(parseResult.data);
          } else {
            logger.api.error({ err: parseResult.error }, `Failed to parse ${topic} response`);
            reject(new TradeRepublicError(`Invalid ${topic} response format`));
          }
        }
      };

      const errorHandler = (error: Error | WebSocketMessage): void => {
        if (resolved) {
          return;
        }
        if (error instanceof Error) {
          resolved = true;
          cleanup();
          reject(error);
        } else if (error.id === subscriptionId) {
          resolved = true;
          cleanup();
          const payload = error.payload as { message?: string } | undefined;
          reject(new TradeRepublicError(payload?.message || String(error.payload)));
        }
      };

      this.api.onMessage(messageHandler);
      this.api.onError(errorHandler);

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          logger.api.error(`${topic} subscription timed out after ${this.timeoutMs}ms`);
          reject(new TradeRepublicError(`${topic} request timed out`));
        }
      }, this.timeoutMs);

      try {
        subscriptionId = this.api.subscribe({ topic });
        logger.api.debug({ topic, subscriptionId }, 'Subscribed to topic');
      } catch (error) {
        resolved = true;
        cleanup();
        reject(error);
      }
    });
  }

  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }
}
```

---

### Step 6: Create PortfolioToolRegistry.spec.ts (RED Phase)

**File:** `src/server/tools/PortfolioToolRegistry.spec.ts`

Test cases:
1. `register()` - registers get_portfolio tool with correct metadata
2. `register()` - registers get_cash_balance tool with correct metadata
3. `get_portfolio handler` - calls portfolioService.getPortfolio
4. `get_portfolio handler` - returns formatted success result
5. `get_portfolio handler` - returns error result on failure
6. `get_cash_balance handler` - same pattern

---

### Step 7: Create PortfolioToolRegistry.ts (GREEN Phase)

**File:** `src/server/tools/PortfolioToolRegistry.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { PortfolioService } from '../services/PortfolioService';
import {
  GetPortfolioRequestSchema,
  GetCashBalanceRequestSchema,
} from '../services/PortfolioService.request';
import { ToolRegistry } from './ToolRegistry';

export class PortfolioToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly portfolioService: PortfolioService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_portfolio',
      {
        title: 'Get Portfolio',
        description:
          'Get current portfolio with all positions including instrument IDs, quantities, values, and profit/loss. Requires authentication.',
        inputSchema: GetPortfolioRequestSchema.shape,
      },
      this.portfolioService.getPortfolio.bind(this.portfolioService),
    );

    this.registerTool(
      'get_cash_balance',
      {
        title: 'Get Cash Balance',
        description:
          'Get current available cash balance in the account. Returns amount and currency. Requires authentication.',
        inputSchema: GetCashBalanceRequestSchema.shape,
      },
      this.portfolioService.getCashBalance.bind(this.portfolioService),
    );
  }
}
```

---

### Step 8: Create tools/index.ts

**File:** `src/server/tools/index.ts`

```typescript
export { ToolRegistry, type ToolResult } from './ToolRegistry';
export { PortfolioToolRegistry } from './PortfolioToolRegistry';
```

---

### Step 9: Update services/index.ts

Add exports for new modules.

---

### Step 10: Update TradeRepublicMcpServer.ts

Make constructor accept optional `TradeRepublicApiService` and create `PortfolioService` when provided. Register `PortfolioToolRegistry` in `registerToolsForServer`.

---

### Step 11: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Summary Table

| Step | File | Purpose |
|------|------|---------|
| 1 | TradeRepublicApiService.ts/.spec.ts | Add offMessage/offError |
| 2 | PortfolioService.request.ts | Zod request schemas |
| 3 | PortfolioService.response.ts | Zod response schemas with transforms |
| 4 | PortfolioService.spec.ts | Service tests (RED) |
| 5 | PortfolioService.ts | Service implementation (GREEN) |
| 6 | PortfolioToolRegistry.spec.ts | Registry tests (RED) |
| 7 | PortfolioToolRegistry.ts | Registry implementation (GREEN) |
| 8 | tools/index.ts | Export new registry |
| 9 | services/index.ts | Export new modules |
| 10 | TradeRepublicMcpServer.ts | Integrate services |
| 11 | Verification | Full validation |

---

## Key Technical Details

### WebSocket Message Codes
- `A` = Answer (success)
- `E` = Error

### Field Name Handling
Response schemas use `.transform()` to normalize field names:
- `amount` / `availableCash` → `availableCash`
- `currencyId` / `currency` → `currency`
- `averageBuyIn` / `unrealisedAverageCost` → `averageCost`

### Error Handling
1. Authentication check
2. Timeout (30s default)
3. API errors (code E)
4. Zod validation
5. Automatic cleanup
