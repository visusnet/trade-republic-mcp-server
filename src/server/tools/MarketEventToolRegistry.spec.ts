/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { MarketEventToolRegistry } from './MarketEventToolRegistry';
import type { MarketEventService } from '../services/MarketEventService';
import type { ToolResult } from './ToolRegistry';

/**
 * Creates a mock MarketEventService for testing.
 */
function createMockMarketEventService(): jest.Mocked<MarketEventService> {
  return {
    waitForMarketEvent: jest.fn(),
  } as unknown as jest.Mocked<MarketEventService>;
}

/**
 * Creates a mock McpServer for testing.
 */
function createMockServer(): { registerTool: jest.Mock } {
  return {
    registerTool: jest.fn(),
  };
}

describe('MarketEventToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let mockMarketEventService: jest.Mocked<MarketEventService>;
  let registry: MarketEventToolRegistry;

  beforeEach(() => {
    mockServer = createMockServer();
    mockMarketEventService = createMockMarketEventService();
    registry = new MarketEventToolRegistry(
      mockServer as unknown as McpServer,
      mockMarketEventService,
    );
  });

  describe('register', () => {
    it('should register wait_for_market_event tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'wait_for_market_event',
        expect.objectContaining({
          title: 'Wait for Market Event',
          description: expect.stringContaining('market'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register exactly 1 tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('wait_for_market_event handler', () => {
    it('should call marketEventService.waitForMarketEvent', async () => {
      mockMarketEventService.waitForMarketEvent.mockResolvedValue({
        status: 'triggered',
        isin: 'DE0007164600',
        exchange: 'LSX',
        triggeredConditions: [
          {
            field: 'bid',
            operator: 'gt',
            threshold: 65,
            actualValue: 66,
          },
        ],
        ticker: {
          bid: 66,
          ask: 67,
          mid: 66.5,
          spread: 1,
          spreadPercent: 1.5,
        },
        timestamp: '2025-01-25T12:00:00.000Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market_event',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({
        subscriptions: [
          {
            isin: 'DE0007164600',
            conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
          },
        ],
      });

      expect(mockMarketEventService.waitForMarketEvent).toHaveBeenCalled();
    });

    it('should return triggered response on success', async () => {
      const triggeredData = {
        status: 'triggered' as const,
        isin: 'DE0007164600',
        exchange: 'LSX',
        triggeredConditions: [
          {
            field: 'bid',
            operator: 'gt',
            threshold: 65,
            actualValue: 66,
          },
        ],
        ticker: {
          bid: 66,
          ask: 67,
          mid: 66.5,
          spread: 1,
          spreadPercent: 1.5,
        },
        timestamp: '2025-01-25T12:00:00.000Z',
      };
      mockMarketEventService.waitForMarketEvent.mockResolvedValue(
        triggeredData,
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market_event',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({
        subscriptions: [
          {
            isin: 'DE0007164600',
            conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
          },
        ],
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(triggeredData);
    });

    it('should return timeout response on timeout', async () => {
      const timeoutData = {
        status: 'timeout' as const,
        lastTickers: {
          'DE0007164600.LSX': {
            bid: 60,
            ask: 61,
            mid: 60.5,
            spread: 1,
            spreadPercent: 1.65,
          },
        },
        duration: 55,
        timestamp: '2025-01-25T12:00:00.000Z',
      };
      mockMarketEventService.waitForMarketEvent.mockResolvedValue(timeoutData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market_event',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({
        subscriptions: [
          {
            isin: 'DE0007164600',
            conditions: [{ field: 'bid', operator: 'lt', value: 50 }],
          },
        ],
      });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(timeoutData);
    });

    it('should return error result on failure', async () => {
      mockMarketEventService.waitForMarketEvent.mockRejectedValue(
        new Error('Not authenticated'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market_event',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({
        subscriptions: [
          {
            isin: 'DE0007164600',
            conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
          },
        ],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Not authenticated');
    });
  });
});
