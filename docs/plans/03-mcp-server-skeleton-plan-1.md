# Task 03: MCP Server Skeleton - Implementation Plan 1

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the TradeRepublicMcpServer class with MCP server instance, tool registry pattern, and assist prompt (no actual tools yet).

**Architecture:** Follows coinbase-mcp-server patterns - Express HTTP server with MCP SDK integration, abstract ToolRegistry base class, and assist prompt resource.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Express, Zod

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/server/TradeRepublicMcpServer.ts` | Main server class |
| `src/server/TradeRepublicMcpServer.spec.ts` | Server tests |
| `src/server/tools/ToolRegistry.ts` | Abstract base for tool registries |
| `src/server/tools/ToolRegistry.spec.ts` | ToolRegistry tests |
| `src/test/loggerMock.ts` | Logger mock helper for tests |

---

## Step 1: Create Logger Mock Helper

**File:** `src/test/loggerMock.ts`

```typescript
import { jest, beforeEach } from '@jest/globals';

export interface LoggerScope {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
}

export interface MockedLogger {
  server: LoggerScope;
  tools: LoggerScope;
  api: LoggerScope;
}

function createLoggerScope(): LoggerScope {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

export function mockLogger(): MockedLogger {
  const logger: MockedLogger = {
    server: createLoggerScope(),
    tools: createLoggerScope(),
    api: createLoggerScope(),
  };

  beforeEach(() => {
    Object.values(logger).forEach((scope) => {
      Object.values(scope).forEach((fn) => fn.mockClear());
    });
  });

  return logger;
}
```

---

## Step 2: Create ToolRegistry Tests (RED)

**File:** `src/server/tools/ToolRegistry.spec.ts`

Tests for:
- Registering tools with MCP server
- Wrapping handlers with logging on success
- Error handling for Error objects
- Error handling for non-Error throws
- Handling synchronous service methods

---

## Step 3: Implement ToolRegistry (GREEN)

**File:** `src/server/tools/ToolRegistry.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import { logger } from '../../logger';

export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError: boolean;
}

export abstract class ToolRegistry {
  constructor(private readonly server: McpServer) {}

  protected registerTool<S extends ZodRawShape>(
    name: string,
    options: {
      title: string;
      description: string;
      inputSchema: S;
    },
    fn: (input: z.output<z.ZodObject<S>>) => unknown,
  ): void {
    this.server.registerTool(
      name,
      options,
      this.call(name, fn) as Parameters<typeof this.server.registerTool>[2],
    );
  }

  private call<I>(toolName: string, fn: (input: I) => unknown) {
    return async (input: I): Promise<ToolResult> => {
      logger.tools.info(`${toolName} called`);
      logger.tools.debug(input as object, `${toolName} parameters`);
      try {
        const response = await Promise.resolve(fn(input));
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(response, null, 2) },
          ],
          isError: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.tools.error({ err: error }, `${toolName} failed`);
        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    };
  }

  public abstract register(): void;
}
```

---

## Step 4: Create TradeRepublicMcpServer Tests (RED)

Tests for:
- Server initialization
- Prompts registration (assist prompt)
- Empty tools list (skeleton)
- HTTP routes (GET 405, POST works, error handling)
- Server lifecycle (listen, shutdown, signal handlers)

---

## Step 5: Implement TradeRepublicMcpServer (GREEN)

Key features:
- Express app with `/mcp` routes
- Stateless MCP server instances per request
- Assist prompt with Trade Republic context
- Graceful shutdown with timeout

---

## Step 6: Update index.ts

Update entry point to use TradeRepublicMcpServer.

---

## Step 7: Run Tests and Verify Coverage

```bash
npm run test:coverage
```

Expected: 100% coverage, all tests passing.
