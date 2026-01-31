# Task 03: MCP Server Skeleton - Final Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the TradeRepublicMcpServer class with MCP server instance, tool registry pattern, and assist prompt (no actual tools yet).

**Architecture:** Follows coinbase-mcp-server patterns - Express HTTP server with MCP SDK integration, abstract ToolRegistry base class, and assist prompt resource.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Express, Zod, supertest

---

## Merge Notes

Both Plan 1 and Plan 2 are consistent. This final plan combines their detailed implementations.

---

## Step 1: Install supertest

**Commands:**
```bash
npm install --save-dev supertest @types/supertest
```

**Verification:**
```bash
npm ls supertest
```

---

## Step 2: Create src/test/loggerMock.ts

**Files:**
- Create: `src/test/loggerMock.ts`

**Content:**
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

## Step 3: Create src/server/tools/ToolRegistry.spec.ts (RED)

**Files:**
- Create: `src/server/tools/ToolRegistry.spec.ts`

**Content:**
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { ToolRegistry, type ToolResult } from './ToolRegistry';

class TestToolRegistry extends ToolRegistry {
  public register(): void {}

  public exposeRegisterTool<S extends z.ZodRawShape>(
    name: string,
    options: {
      title: string;
      description: string;
      inputSchema: S;
    },
    fn: (input: z.output<z.ZodObject<S>>) => unknown,
  ): void {
    this.registerTool(name, options, fn);
  }
}

describe('ToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let registry: TestToolRegistry;

  beforeEach(() => {
    mockServer = { registerTool: jest.fn() };
    registry = new TestToolRegistry(mockServer as unknown as McpServer);
  });

  describe('registerTool', () => {
    it('should register a tool with the MCP server', () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockReturnValue({ success: true });

      registry.exposeRegisterTool(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        handler,
      );

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        expect.any(Function),
      );
    });

    it('should wrap handler with logging and return success result', async () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockReturnValue({ data: 'test' });

      registry.exposeRegisterTool(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '123' });

      expect(logger.tools.info).toHaveBeenCalledWith('test_tool called');
      expect(logger.tools.debug).toHaveBeenCalledWith(
        { id: '123' },
        'test_tool parameters',
      );
      expect(handler).toHaveBeenCalledWith({ id: '123' });
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ data: 'test' }, null, 2) }],
        isError: false,
      });
    });

    it('should handle async handlers', async () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockResolvedValue({ async: true });

      registry.exposeRegisterTool(
        'async_tool',
        { title: 'Async Tool', description: 'An async tool', inputSchema: schema },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '456' });

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ async: true }, null, 2) }],
        isError: false,
      });
    });

    it('should handle Error objects and return error result', async () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockRejectedValue(new Error('Test error'));

      registry.exposeRegisterTool(
        'error_tool',
        { title: 'Error Tool', description: 'A tool that errors', inputSchema: schema },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '789' });

      expect(logger.tools.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'error_tool failed',
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Test error' }],
        isError: true,
      });
    });

    it('should handle non-Error objects and return error result', async () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockRejectedValue('String error');

      registry.exposeRegisterTool(
        'string_error_tool',
        { title: 'String Error Tool', description: 'Throws string', inputSchema: schema },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '000' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
        isError: true,
      });
    });
  });
});
```

**Run test (RED):**
```bash
npm test -- --testPathPattern=ToolRegistry.spec.ts
```

---

## Step 4: Create src/server/tools/ToolRegistry.ts (GREEN)

**Files:**
- Create: `src/server/tools/ToolRegistry.ts`

**Content:**
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

**Run test (GREEN):**
```bash
npm test -- --testPathPattern=ToolRegistry.spec.ts
```

---

## Step 5: Create src/server/TradeRepublicMcpServer.spec.ts (RED)

**Files:**
- Create: `src/server/TradeRepublicMcpServer.spec.ts`

**Content:**
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import request from 'supertest';
import * as StreamableHttpModule from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../logger', () => ({ logger }));

import { TradeRepublicMcpServer } from './TradeRepublicMcpServer';

describe('TradeRepublicMcpServer', () => {
  let server: TradeRepublicMcpServer;
  let client: Client;

  beforeEach(async () => {
    jest.clearAllMocks();
    server = new TradeRepublicMcpServer();
    const mcpServer = server.getMcpServer();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
  });

  describe('Prompts', () => {
    it('should register assist prompt', async () => {
      const prompts = await client.listPrompts({});
      expect(prompts.prompts).toHaveLength(1);
      expect(prompts.prompts[0].name).toBe('assist');
    });

    it('should return trading assistant prompt content', async () => {
      const result = await client.getPrompt({ name: 'assist', arguments: {} });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const contentStr = JSON.stringify(result.messages[0].content);
      expect(contentStr).toContain('Trade Republic');
      expect(contentStr).toContain('TOOL CATEGORIES');
    });
  });

  describe('Tools', () => {
    it('should have no tools registered in skeleton', async () => {
      const tools = await client.listTools({});
      expect(tools.tools).toHaveLength(0);
    });
  });

  describe('HTTP Routes', () => {
    it('should respond with 405 for GET /mcp', async () => {
      const response = await request(server.getExpressApp()).get('/mcp');
      expect(response.status).toBe(405);
      expect(response.body.error.message).toContain('Method not allowed');
    });

    it('should accept POST /mcp requests', async () => {
      const response = await request(server.getExpressApp())
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 })
        .set('Content-Type', 'application/json');
      expect(response.status).not.toBe(404);
    });

    it('should handle errors in POST /mcp with 500', async () => {
      const spy = jest.spyOn(StreamableHttpModule, 'StreamableHTTPServerTransport')
        .mockImplementationOnce(() => { throw new Error('Transport failed'); });
      const testServer = new TradeRepublicMcpServer();
      const response = await request(testServer.getExpressApp())
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} })
        .set('Content-Type', 'application/json');
      expect(response.status).toBe(500);
      expect(logger.server.error).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Server Lifecycle', () => {
    it('should start listening on specified port', () => {
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn((_port: number, cb: () => void) => { cb(); return mockServer; });
      Object.defineProperty(server.getExpressApp(), 'listen', { value: mockListen, writable: true });
      server.listen(3000);
      expect(mockListen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(logger.server.info).toHaveBeenCalledWith('Trade Republic MCP Server listening on port 3000');
    });

    it('should handle EADDRINUSE error', () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn(() => mockServer);
      Object.defineProperty(server.getExpressApp(), 'listen', { value: mockListen, writable: true });
      server.listen(3000);
      const errorHandler = mockServer.on.mock.calls.find((c) => c[0] === 'error')?.[1] as (e: NodeJS.ErrnoException) => void;
      const error: NodeJS.ErrnoException = new Error('in use'); error.code = 'EADDRINUSE';
      errorHandler(error);
      expect(logger.server.error).toHaveBeenCalledWith('Port 3000 is already in use');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should register shutdown handlers', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn((_p: number, cb: () => void) => { cb(); return mockServer; });
      Object.defineProperty(server.getExpressApp(), 'listen', { value: mockListen, writable: true });
      server.listen(3000);
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      processOnSpy.mockRestore();
    });

    it('should close server on SIGTERM', () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn((cb: () => void) => { cb(); });
      const mockServer = { on: jest.fn(), close: mockServerClose };
      const mockListen = jest.fn((_p: number, cb: () => void) => { cb(); return mockServer; });
      Object.defineProperty(server.getExpressApp(), 'listen', { value: mockListen, writable: true });
      server.listen(3000);
      const handler = processOnSpy.mock.calls.find((c) => c[0] === 'SIGTERM')?.[1] as () => void;
      handler?.();
      expect(logger.server.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockServerClose).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should force exit on shutdown timeout', () => {
      jest.useFakeTimers();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn();
      const mockServer = { on: jest.fn(), close: mockServerClose };
      const mockListen = jest.fn((_p: number, cb: () => void) => { cb(); return mockServer; });
      Object.defineProperty(server.getExpressApp(), 'listen', { value: mockListen, writable: true });
      server.listen(3000);
      const handler = processOnSpy.mock.calls.find((c) => c[0] === 'SIGTERM')?.[1] as () => void;
      handler?.();
      jest.advanceTimersByTime(10_000);
      expect(logger.server.error).toHaveBeenCalledWith('Graceful shutdown timed out, forcing exit');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
```

**Run test (RED):**
```bash
npm test -- --testPathPattern=TradeRepublicMcpServer.spec.ts
```

---

## Step 6: Create src/server/TradeRepublicMcpServer.ts (GREEN)

**Files:**
- Create: `src/server/TradeRepublicMcpServer.ts`

**Content:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';
import { logger } from '../logger';

export class TradeRepublicMcpServer {
  private readonly app: Express;

  constructor() {
    this.app = createMcpExpressApp();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/mcp', async (req: Request, res: Response) => {
      const server = this.createMcpServerInstance();
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
      } catch (error) {
        logger.server.error({ err: error }, 'Error handling MCP request');
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    this.app.get('/mcp', (_req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not allowed. Use POST for MCP requests.' },
        id: null,
      });
    });
  }

  private registerPromptsForServer(server: McpServer): void {
    server.registerPrompt('assist', {
      description: 'A prompt to help with trading on Trade Republic',
    }, () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are a Trade Republic trading assistant.

TOOL CATEGORIES (to be implemented):
- Portfolio: get_portfolio, get_cash_balance
- Market Data: get_price, get_price_history, get_order_book, search_assets, get_asset_info, get_market_status, wait_for_market
- Technical Analysis: get_indicators, get_detailed_analysis
- External Data: get_news, get_sentiment, get_fundamentals
- Risk Management: calculate_position_size, get_risk_metrics
- Execution: place_order, get_orders, modify_order, cancel_order

BEST PRACTICES:
1. Always check portfolio and cash balance before trading
2. Use get_market_status to verify market is open
3. Use get_indicators for technical analysis before trading decisions
4. Consider risk metrics and position sizing for all trades
5. Monitor news and sentiment for event-driven opportunities
6. Use limit orders when possible for better execution
7. Respect hard limits: max 10% position size, max 5% daily loss, min 10% cash reserve`,
        },
      }],
    }));
  }

  public getExpressApp(): Express {
    return this.app;
  }

  public getMcpServer(): McpServer {
    return this.createMcpServerInstance();
  }

  private createMcpServerInstance(): McpServer {
    const server = new McpServer(
      { name: 'trade-republic-mcp-server', version: '0.1.0' },
      { capabilities: { tools: {}, prompts: {} } },
    );
    this.registerPromptsForServer(server);
    return server;
  }

  public listen(port: number): void {
    const server = this.app.listen(port, () => {
      logger.server.info(`Trade Republic MCP Server listening on port ${port}`);
    });

    let isShuttingDown = false;
    const shutdown = (): void => {
      if (isShuttingDown) { return; }
      isShuttingDown = true;
      logger.server.info('Shutting down...');

      const forceExitTimeout = setTimeout(() => {
        logger.server.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 10_000);
      forceExitTimeout.unref();

      server.close(() => {
        clearTimeout(forceExitTimeout);
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.server.error(`Port ${port} is already in use`);
        logger.server.error('Try a different port with: PORT=<port> npm start');
      } else {
        logger.server.error(`Error starting server: ${error.message}`);
      }
      process.exit(1);
    });
  }
}
```

**Run test (GREEN):**
```bash
npm test -- --testPathPattern=TradeRepublicMcpServer.spec.ts
```

---

## Step 7: Update src/index.ts

**Files:**
- Modify: `src/index.ts`

**Content:**
```typescript
#!/usr/bin/env node
import { config } from 'dotenv';
import { TradeRepublicMcpServer } from './server/TradeRepublicMcpServer.js';

config();

const server = new TradeRepublicMcpServer();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
server.listen(port);
```

---

## Step 8: Run all verification

**Commands:**
```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

---

## Summary

| Step | File/Action |
|------|-------------|
| 1 | Install supertest |
| 2 | src/test/loggerMock.ts |
| 3 | src/server/tools/ToolRegistry.spec.ts (RED) |
| 4 | src/server/tools/ToolRegistry.ts (GREEN) |
| 5 | src/server/TradeRepublicMcpServer.spec.ts (RED) |
| 6 | src/server/TradeRepublicMcpServer.ts (GREEN) |
| 7 | Update src/index.ts |
| 8 | Run verification |

## Files Created

1. `src/test/loggerMock.ts`
2. `src/server/tools/ToolRegistry.ts`
3. `src/server/tools/ToolRegistry.spec.ts`
4. `src/server/TradeRepublicMcpServer.ts`
5. `src/server/TradeRepublicMcpServer.spec.ts`
