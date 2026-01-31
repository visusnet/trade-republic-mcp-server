# Task 05: Portfolio Tools - Combined Implementation Plan

## Overview

Implement `get_portfolio` and `get_cash_balance` MCP tools for the Trade Republic trading bot.

## Trade Republic API Topics

Based on pytr and Trade_Republic_Connector research:

| Tool | WebSocket Topic | Description |
|------|-----------------|-------------|
| get_portfolio | `compactPortfolio` | Returns portfolio with positions |
| get_cash_balance | `cash` | Returns available cash balance |

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

**Modified files:**
- `src/server/services/TradeRepublicApiService.ts` - Add offMessage/offError methods
- `src/server/services/TradeRepublicApiService.spec.ts` - Add tests for new methods
- `src/server/services/index.ts` - Export new modules
- `src/server/TradeRepublicMcpServer.ts` - Integrate PortfolioToolRegistry

---

## Implementation Steps

### Step 1: Add offMessage/offError to TradeRepublicApiService

**File:** `src/server/services/TradeRepublicApiService.ts`

Add after the existing `onError` method (around line 340):

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

**Tests to add** in `TradeRepublicApiService.spec.ts`:
- `offMessage` should remove a registered handler
- `offMessage` should do nothing if handler not found
- `offError` should remove a registered handler
- `offError` should do nothing if handler not found

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

```typescript
/**
 * Portfolio Service - Response Schemas
 */

import { z } from 'zod';

/**
 * Portfolio position schema
 */
export const PortfolioPositionSchema = z.object({
  /** ISIN or instrument identifier */
  instrumentId: z.string(),
  /** Number of shares/units held */
  netSize: z.number(),
  /** Current market value of the position */
  netValue: z.number(),
  /** Average cost per unit (unrealised) */
  unrealisedAverageCost: z.number(),
  /** Profit/loss from closed positions */
  realisedProfit: z.number(),
});

export type PortfolioPosition = z.output<typeof PortfolioPositionSchema>;

/**
 * Portfolio response schema
 */
export const GetPortfolioResponseSchema = z.object({
  /** Array of portfolio positions */
  positions: z.array(PortfolioPositionSchema),
  /** Total portfolio value */
  netValue: z.number(),
  /** Reference change profit (absolute) */
  referenceChangeProfit: z.number().optional(),
  /** Reference change profit (percentage) */
  referenceChangeProfitPercent: z.number().optional(),
  /** Unrealised profit (absolute) */
  unrealisedProfit: z.number(),
  /** Unrealised profit (percentage) */
  unrealisedProfitPercent: z.number(),
  /** Total unrealised cost basis */
  unrealisedCost: z.number(),
});

export type GetPortfolioResponse = z.output<typeof GetPortfolioResponseSchema>;

/**
 * Cash balance response schema
 */
export const GetCashBalanceResponseSchema = z.object({
  /** Available cash balance */
  availableCash: z.number(),
  /** Currency code (e.g., "EUR") */
  currency: z.string().default('EUR'),
});

export type GetCashBalanceResponse = z.output<typeof GetCashBalanceResponseSchema>;
```

---

### Step 4: Create PortfolioService.spec.ts (RED Phase)

**File:** `src/server/services/PortfolioService.spec.ts`

**Test cases:**

1. `getPortfolio()`:
   - Should throw error if not authenticated
   - Should subscribe to compactPortfolio topic
   - Should resolve with validated portfolio data on success
   - Should reject on API error response (code 'E')
   - Should reject on timeout
   - Should unsubscribe and remove handlers on success
   - Should unsubscribe and remove handlers on error
   - Should unsubscribe and remove handlers on timeout
   - Should reject on invalid response format (Zod validation failure)

2. `getCashBalance()`:
   - Should throw error if not authenticated
   - Should subscribe to cash topic
   - Should resolve with validated cash data on success
   - Should use default currency EUR when not provided
   - Should reject on API error response
   - Should reject on timeout
   - Should unsubscribe and remove handlers on completion

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

/** Default timeout for WebSocket subscription responses (30 seconds) */
const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;

/**
 * PortfolioService provides methods for retrieving portfolio and cash balance data.
 */
export class PortfolioService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  /**
   * Retrieves the current portfolio with all positions.
   */
  async getPortfolio(_request?: GetPortfolioRequest): Promise<GetPortfolioResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting portfolio data');
    return this.subscribeAndWait<GetPortfolioResponse>(
      'compactPortfolio',
      GetPortfolioResponseSchema,
    );
  }

  /**
   * Retrieves the current cash balance.
   */
  async getCashBalance(_request?: GetCashBalanceRequest): Promise<GetCashBalanceResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting cash balance data');
    return this.subscribeAndWait<GetCashBalanceResponse>(
      'cash',
      GetCashBalanceResponseSchema,
    );
  }

  /**
   * Subscribes to a topic and waits for the first response.
   * Handles timeout and cleanup.
   */
  private subscribeAndWait<T>(
    topic: string,
    schema: { parse: (data: unknown) => T },
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
          const errorPayload = message.payload as { message?: string };
          const errorMessage = errorPayload?.message || 'API error';
          logger.api.error({ payload: message.payload }, `${topic} subscription error`);
          reject(new TradeRepublicError(errorMessage));
          return;
        }

        if (message.code === MESSAGE_CODE.A) {
          resolved = true;
          cleanup();
          try {
            const parsed = schema.parse(message.payload);
            logger.api.debug({ topic }, 'Received subscription data');
            resolve(parsed);
          } catch (error) {
            logger.api.error({ err: error }, `Failed to parse ${topic} response`);
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
        } else if ('id' in error && error.id === subscriptionId) {
          resolved = true;
          cleanup();
          reject(new TradeRepublicError(String(error.payload)));
        }
      };

      // Set up handlers
      this.api.onMessage(messageHandler);
      this.api.onError(errorHandler);

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          logger.api.error(`${topic} subscription timed out after ${this.timeoutMs}ms`);
          reject(new TradeRepublicError(`${topic} request timed out`));
        }
      }, this.timeoutMs);

      // Subscribe to the topic
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

  /**
   * Ensures the API service is authenticated.
   */
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

**Test cases:**

1. `register()`:
   - Should register get_portfolio tool with correct metadata
   - Should register get_cash_balance tool with correct metadata

2. `get_portfolio handler`:
   - Should call portfolioService.getPortfolio
   - Should return formatted success result
   - Should return error result on service failure

3. `get_cash_balance handler`:
   - Should call portfolioService.getCashBalance
   - Should return formatted success result
   - Should return error result on service failure

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

/**
 * Registry for portfolio-related MCP tools.
 */
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
          'Get current portfolio with all positions including instrument IDs, quantities, values, and unrealized profit/loss. Requires authentication.',
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

### Step 8: Update services/index.ts

**File:** `src/server/services/index.ts`

Add exports:

```typescript
export * from './PortfolioService.request';
export * from './PortfolioService.response';
export { PortfolioService } from './PortfolioService';
```

---

### Step 9: Update TradeRepublicMcpServer.ts

Add imports and integrate PortfolioService/PortfolioToolRegistry.

**Key changes:**
1. Import PortfolioService and PortfolioToolRegistry
2. Add portfolioService property
3. Initialize in constructor or after authentication
4. Register tools in registerToolsForServer method

---

### Step 10: Verification

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Summary Table

| Step | File | Purpose |
|------|------|---------|
| 1 | TradeRepublicApiService.ts | Add offMessage/offError methods |
| 2 | PortfolioService.request.ts | Zod request schemas |
| 3 | PortfolioService.response.ts | Zod response schemas |
| 4 | PortfolioService.spec.ts | Service tests (RED) |
| 5 | PortfolioService.ts | Service implementation (GREEN) |
| 6 | PortfolioToolRegistry.spec.ts | Tool registry tests (RED) |
| 7 | PortfolioToolRegistry.ts | Tool registry (GREEN) |
| 8 | services/index.ts | Export new modules |
| 9 | TradeRepublicMcpServer.ts | Integrate services and tools |
| 10 | Verification | Full validation |

---

## Key Technical Details

### WebSocket Message Codes (from TradeRepublicApiService.types.ts)
- `A` = Success response
- `E` = Error response

### Error Handling
1. Authentication check before each request
2. Timeout handling (30 second default)
3. API error responses (code 'E')
4. Zod validation errors for malformed responses
5. Automatic cleanup (unsubscribe + remove handlers) on completion
