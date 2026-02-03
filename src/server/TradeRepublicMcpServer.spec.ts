import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import request from 'supertest';
import * as StreamableHttpModule from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { mockLogger } from '@test/loggerMock';
import { AuthStatus } from './services/TradeRepublicApiService.types';

const logger = mockLogger();
jest.mock('../logger', () => ({ logger }));

// Mock TradeRepublicApiService
const mockApiService = {
  getAuthStatus: jest
    .fn<() => AuthStatus>()
    .mockReturnValue(AuthStatus.AUTHENTICATED),
  subscribe: jest
    .fn<(input: { topic: string; payload?: object }) => number>()
    .mockReturnValue(1),
  unsubscribe: jest.fn<(id: number) => void>(),
  onMessage: jest.fn(),
  offMessage: jest.fn(),
  onError: jest.fn(),
  offError: jest.fn(),
  enterTwoFactorCode: jest
    .fn<() => Promise<{ message: string }>>()
    .mockResolvedValue({ message: 'Authentication successful' }),
};

jest.mock('./services/TradeRepublicApiService', () => ({
  TradeRepublicApiService: jest.fn().mockImplementation(() => mockApiService),
}));

jest.mock('./services/TradeRepublicCredentials', () => ({
  TradeRepublicCredentials: jest.fn().mockImplementation(() => ({
    phoneNumber: '+4917012345678',
    pin: '1234',
    getMaskedPhoneNumber: () => '+49170***78',
  })),
}));

import { TradeRepublicMcpServer } from './TradeRepublicMcpServer';

const TEST_PHONE_NUMBER = '+4917012345678';
const TEST_PIN = '1234';

describe('TradeRepublicMcpServer', () => {
  let server: TradeRepublicMcpServer;
  let client: Client;

  beforeEach(async () => {
    jest.clearAllMocks();
    server = new TradeRepublicMcpServer(TEST_PHONE_NUMBER, TEST_PIN);
    const mcpServer = server.getMcpServer();
    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);
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

  describe('Server Methods', () => {
    it('should return express app with expected interface', () => {
      const app = server.getExpressApp();
      expect(typeof app.listen).toBe('function');
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
    });

    it('should return MCP server instance with expected interface', () => {
      const mcpServer = server.getMcpServer();
      expect(typeof mcpServer.registerTool).toBe('function');
      expect(typeof mcpServer.connect).toBe('function');
    });
  });

  describe('Portfolio Tools', () => {
    it('should register portfolio tools', async () => {
      const tools = await client.listTools({});
      expect(tools.tools.length).toBeGreaterThan(0);
      expect(tools.tools.map((t) => t.name)).toContain('get_portfolio');
      expect(tools.tools.map((t) => t.name)).toContain('get_cash_balance');
    });
  });

  describe('Market Data Tools', () => {
    it('should register market data tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('get_price');
      expect(toolNames).toContain('get_price_history');
      expect(toolNames).toContain('get_order_book');
      expect(toolNames).toContain('search_assets');
      expect(toolNames).toContain('get_asset_info');
      expect(toolNames).toContain('get_market_status');
      expect(toolNames).toContain('wait_for_market');
    });

    it('should register all 22 tools', async () => {
      const tools = await client.listTools({});
      // 1 auth + 2 portfolio + 7 market data + 1 market event + 2 technical analysis + 3 external data + 2 risk management + 4 execution = 22 total
      expect(tools.tools).toHaveLength(22);
    });
  });

  describe('Auth Tools', () => {
    it('should register auth tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('enter_two_factor_code');
    });
  });

  describe('Market Event Tools', () => {
    it('should register market event tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('wait_for_market_event');
    });
  });

  describe('Technical Analysis Tools', () => {
    it('should register technical analysis tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('get_indicators');
      expect(toolNames).toContain('get_detailed_analysis');
    });
  });

  describe('Execution Tools', () => {
    it('should register execution tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('place_order');
      expect(toolNames).toContain('get_orders');
      expect(toolNames).toContain('modify_order');
      expect(toolNames).toContain('cancel_order');
    });
  });

  describe('External Data Tools', () => {
    it('should register external data tools', async () => {
      const tools = await client.listTools({});
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain('get_news');
      expect(toolNames).toContain('get_sentiment');
      expect(toolNames).toContain('get_fundamentals');
    });
  });

  describe('HTTP Routes', () => {
    it('should respond with 405 for GET /mcp', async () => {
      const response = await request(server.getExpressApp()).get('/mcp');
      expect(response.status).toBe(405);
      expect(
        (response.body as { error: { message: string } }).error.message,
      ).toContain('Method not allowed');
    });

    it('should accept POST /mcp requests', async () => {
      const response = await request(server.getExpressApp())
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 })
        .set('Content-Type', 'application/json');
      expect(response.status).not.toBe(404);
    });

    it('should handle errors in POST /mcp with 500', async () => {
      const spy = jest
        .spyOn(StreamableHttpModule, 'StreamableHTTPServerTransport')
        .mockImplementationOnce(() => {
          throw new Error('Transport failed');
        });
      const testServer = new TradeRepublicMcpServer(
        TEST_PHONE_NUMBER,
        TEST_PIN,
      );
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
      const mockListen = jest.fn((_port: number, cb: () => void) => {
        cb();
        return mockServer;
      });
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      expect(mockListen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(logger.server.info).toHaveBeenCalledWith(
        'Trade Republic MCP Server listening on port 3000',
      );
    });

    it('should handle EADDRINUSE error', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn(() => mockServer);
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      const errorHandler = mockServer.on.mock.calls.find(
        (c) => c[0] === 'error',
      )?.[1] as (e: NodeJS.ErrnoException) => void;
      const error: NodeJS.ErrnoException = new Error('in use');
      error.code = 'EADDRINUSE';
      errorHandler(error);
      expect(logger.server.error).toHaveBeenCalledWith(
        'Port 3000 is already in use',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should handle other server errors', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn(() => mockServer);
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      const errorHandler = mockServer.on.mock.calls.find(
        (c) => c[0] === 'error',
      )?.[1] as (e: NodeJS.ErrnoException) => void;
      const error: NodeJS.ErrnoException = new Error('permission denied');
      error.code = 'EACCES';
      errorHandler(error);
      expect(logger.server.error).toHaveBeenCalledWith(
        'Error starting server: permission denied',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should register shutdown handlers', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn((_p: number, cb: () => void) => {
        cb();
        return mockServer;
      });
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      expect(processOnSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function),
      );
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      processOnSpy.mockRestore();
    });

    it('should close server on SIGTERM', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn((cb: () => void) => {
        cb();
      });
      const mockServer = { on: jest.fn(), close: mockServerClose };
      const mockListen = jest.fn((_p: number, cb: () => void) => {
        cb();
        return mockServer;
      });
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      const handler = processOnSpy.mock.calls.find(
        (c) => c[0] === 'SIGTERM',
      )?.[1] as (() => void) | undefined;
      if (handler) {
        handler();
      }
      expect(logger.server.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockServerClose).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should only shutdown once when called multiple times', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn((cb: () => void) => {
        cb();
      });
      const mockServer = { on: jest.fn(), close: mockServerClose };
      const mockListen = jest.fn((_p: number, cb: () => void) => {
        cb();
        return mockServer;
      });
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      const handler = processOnSpy.mock.calls.find(
        (c) => c[0] === 'SIGTERM',
      )?.[1] as (() => void) | undefined;
      if (handler) {
        handler();
        handler();
      }
      expect(mockServerClose).toHaveBeenCalledTimes(1);
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should force exit on shutdown timeout', () => {
      jest.useFakeTimers();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn();
      const mockServer = { on: jest.fn(), close: mockServerClose };
      const mockListen = jest.fn((_p: number, cb: () => void) => {
        cb();
        return mockServer;
      });
      Object.defineProperty(server.getExpressApp(), 'listen', {
        value: mockListen,
        writable: true,
      });
      server.listen(3000);
      const handler = processOnSpy.mock.calls.find(
        (c) => c[0] === 'SIGTERM',
      )?.[1] as (() => void) | undefined;
      if (handler) {
        handler();
      }
      jest.advanceTimersByTime(10_000);
      expect(logger.server.error).toHaveBeenCalledWith(
        'Graceful shutdown timed out, forcing exit',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
