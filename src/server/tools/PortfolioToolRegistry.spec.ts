/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { PortfolioToolRegistry } from './PortfolioToolRegistry';
import type { PortfolioService } from '../services/PortfolioService';
import type { ToolResult } from './ToolRegistry';

/**
 * Creates a mock PortfolioService for testing.
 */
function createMockPortfolioService(): jest.Mocked<PortfolioService> {
  return {
    getPortfolio: jest.fn(),
    getCashBalance: jest.fn(),
  } as unknown as jest.Mocked<PortfolioService>;
}

/**
 * Creates a mock McpServer for testing.
 */
function createMockServer(): { registerTool: jest.Mock } {
  return {
    registerTool: jest.fn(),
  };
}

describe('PortfolioToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let mockPortfolioService: jest.Mocked<PortfolioService>;
  let registry: PortfolioToolRegistry;

  beforeEach(() => {
    mockServer = createMockServer();
    mockPortfolioService = createMockPortfolioService();
    registry = new PortfolioToolRegistry(
      mockServer as unknown as McpServer,
      mockPortfolioService,
    );
  });

  describe('register', () => {
    it('should register get_portfolio tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_portfolio',
        expect.objectContaining({
          title: 'Get Portfolio',
          description: expect.stringContaining('portfolio'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_cash_balance tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_cash_balance',
        expect.objectContaining({
          title: 'Get Cash Balance',
          description: expect.stringContaining('cash balance'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });
  });

  describe('get_portfolio handler', () => {
    it('should call portfolioService.getPortfolio', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        positions: [],
        netValue: 0,
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_portfolio',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({});

      expect(mockPortfolioService.getPortfolio).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            averageCost: 95,
            realisedProfit: 50,
          },
        ],
        netValue: 1000,
      };
      mockPortfolioService.getPortfolio.mockResolvedValue(portfolioData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_portfolio',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({});

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(portfolioData);
    });

    it('should return error result on failure', async () => {
      mockPortfolioService.getPortfolio.mockRejectedValue(
        new Error('Not authenticated'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_portfolio',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Not authenticated');
    });
  });

  describe('get_cash_balance handler', () => {
    it('should call portfolioService.getCashBalance', async () => {
      mockPortfolioService.getCashBalance.mockResolvedValue({
        availableCash: 1000,
        currency: 'EUR',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_cash_balance',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({});

      expect(mockPortfolioService.getCashBalance).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const cashData = {
        availableCash: 1000,
        currency: 'EUR',
      };
      mockPortfolioService.getCashBalance.mockResolvedValue(cashData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_cash_balance',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({});

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(cashData);
    });

    it('should return error result on failure', async () => {
      mockPortfolioService.getCashBalance.mockRejectedValue(
        new Error('Connection lost'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_cash_balance',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Connection lost');
    });
  });
});
