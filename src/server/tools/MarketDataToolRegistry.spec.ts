/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { MarketDataToolRegistry } from './MarketDataToolRegistry';
import type { MarketDataService } from '../services/MarketDataService';
import type { ToolResult } from './ToolRegistry';

/**
 * Creates a mock MarketDataService for testing.
 */
function createMockMarketDataService(): jest.Mocked<MarketDataService> {
  return {
    getPrice: jest.fn(),
    getPriceHistory: jest.fn(),
    getOrderBook: jest.fn(),
    searchAssets: jest.fn(),
    getAssetInfo: jest.fn(),
    getMarketStatus: jest.fn(),
    waitForMarket: jest.fn(),
  } as unknown as jest.Mocked<MarketDataService>;
}

/**
 * Creates a mock McpServer for testing.
 */
function createMockServer(): { registerTool: jest.Mock } {
  return {
    registerTool: jest.fn(),
  };
}

describe('MarketDataToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let registry: MarketDataToolRegistry;

  beforeEach(() => {
    mockServer = createMockServer();
    mockMarketDataService = createMockMarketDataService();
    registry = new MarketDataToolRegistry(
      mockServer as unknown as McpServer,
      mockMarketDataService,
    );
  });

  describe('register', () => {
    it('should register get_price tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_price',
        expect.objectContaining({
          title: 'Get Price',
          description: expect.stringContaining('price'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_price_history tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_price_history',
        expect.objectContaining({
          title: 'Get Price History',
          description: expect.stringContaining('historical'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_order_book tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_order_book',
        expect.objectContaining({
          title: 'Get Order Book',
          description: expect.stringContaining('order book'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register search_assets tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'search_assets',
        expect.objectContaining({
          title: 'Search Assets',
          description: expect.stringMatching(/search/i),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_asset_info tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_asset_info',
        expect.objectContaining({
          title: 'Get Asset Info',
          description: expect.stringContaining('information'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_market_status tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_market_status',
        expect.objectContaining({
          title: 'Get Market Status',
          description: expect.stringContaining('market'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register wait_for_market tool with correct metadata', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'wait_for_market',
        expect.objectContaining({
          title: 'Wait for Market',
          description: expect.stringMatching(/wait/i),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register all 7 tools', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(7);
    });
  });

  describe('get_price handler', () => {
    it('should call marketDataService.getPrice', async () => {
      mockMarketDataService.getPrice.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        bid: 100,
        ask: 101,
        spread: 1,
        spreadPercent: 0.99,
        timestamp: '2024-01-15T10:30:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'DE0007164600' });

      expect(mockMarketDataService.getPrice).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const priceData = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        bid: 100,
        ask: 101,
        spread: 1,
        spreadPercent: 0.99,
        timestamp: '2024-01-15T10:30:00Z',
      };
      mockMarketDataService.getPrice.mockResolvedValue(priceData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(priceData);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.getPrice.mockRejectedValue(
        new Error('Not authenticated'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Not authenticated');
    });
  });

  describe('get_price_history handler', () => {
    it('should call marketDataService.getPriceHistory', async () => {
      mockMarketDataService.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '1d',
        candles: [],
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price_history',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'DE0007164600', range: '1d' });

      expect(mockMarketDataService.getPriceHistory).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const historyData = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '1d',
        candles: [
          { time: 1705312800000, open: 100, high: 102, low: 99, close: 101 },
        ],
      };
      mockMarketDataService.getPriceHistory.mockResolvedValue(historyData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price_history',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600', range: '1d' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(historyData);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.getPriceHistory.mockRejectedValue(
        new Error('Invalid range'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_price_history',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600', range: 'invalid' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Invalid range');
    });
  });

  describe('get_order_book handler', () => {
    it('should call marketDataService.getOrderBook', async () => {
      mockMarketDataService.getOrderBook.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        bids: [{ price: 100 }],
        asks: [{ price: 101 }],
        spread: 1,
        midPrice: 100.5,
        timestamp: '2024-01-15T10:30:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_order_book',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'DE0007164600' });

      expect(mockMarketDataService.getOrderBook).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const orderBookData = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        bids: [{ price: 100, size: 1000 }],
        asks: [{ price: 101, size: 500 }],
        spread: 1,
        midPrice: 100.5,
        timestamp: '2024-01-15T10:30:00Z',
      };
      mockMarketDataService.getOrderBook.mockResolvedValue(orderBookData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_order_book',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(orderBookData);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.getOrderBook.mockRejectedValue(
        new Error('Ticker not found'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_order_book',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'INVALID' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Ticker not found');
    });
  });

  describe('search_assets handler', () => {
    it('should call marketDataService.searchAssets', async () => {
      mockMarketDataService.searchAssets.mockResolvedValue({
        results: [],
        totalCount: 0,
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'search_assets',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ query: 'Apple' });

      expect(mockMarketDataService.searchAssets).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const searchData = {
        results: [{ isin: 'US0378331005', name: 'Apple Inc.', type: 'stock' }],
        totalCount: 1,
      };
      mockMarketDataService.searchAssets.mockResolvedValue(searchData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'search_assets',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ query: 'Apple' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(searchData);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.searchAssets.mockRejectedValue(
        new Error('Search failed'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'search_assets',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ query: 'Apple' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Search failed');
    });
  });

  describe('get_asset_info handler', () => {
    it('should call marketDataService.getAssetInfo', async () => {
      mockMarketDataService.getAssetInfo.mockResolvedValue({
        isin: 'US0378331005',
        name: 'Apple Inc.',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_asset_info',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'US0378331005' });

      expect(mockMarketDataService.getAssetInfo).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const assetInfo = {
        isin: 'US0378331005',
        name: 'Apple Inc.',
        shortName: 'AAPL',
        symbol: 'AAPL',
        type: 'stock',
      };
      mockMarketDataService.getAssetInfo.mockResolvedValue(assetInfo);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_asset_info',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'US0378331005' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(assetInfo);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.getAssetInfo.mockRejectedValue(
        new Error('Instrument not found'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_asset_info',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'INVALID' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Instrument not found');
    });
  });

  describe('get_market_status handler', () => {
    it('should call marketDataService.getMarketStatus', async () => {
      mockMarketDataService.getMarketStatus.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        status: 'open',
        isOpen: true,
        hasBid: true,
        hasAsk: true,
        timestamp: '2024-01-15T10:30:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_market_status',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'DE0007164600' });

      expect(mockMarketDataService.getMarketStatus).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const statusData = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        status: 'open' as const,
        isOpen: true,
        hasBid: true,
        hasAsk: true,
        timestamp: '2024-01-15T10:30:00Z',
      };
      mockMarketDataService.getMarketStatus.mockResolvedValue(statusData);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_market_status',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(statusData);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.getMarketStatus.mockRejectedValue(
        new Error('Ticker not found'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_market_status',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'INVALID' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Ticker not found');
    });
  });

  describe('wait_for_market handler', () => {
    it('should call marketDataService.waitForMarket', async () => {
      mockMarketDataService.waitForMarket.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        isOpen: true,
        waitedMs: 0,
        timedOut: false,
        timestamp: '2024-01-15T10:30:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ isin: 'DE0007164600' });

      expect(mockMarketDataService.waitForMarket).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const waitResult = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        isOpen: true,
        waitedMs: 5000,
        timedOut: false,
        timestamp: '2024-01-15T10:30:00Z',
      };
      mockMarketDataService.waitForMarket.mockResolvedValue(waitResult);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(waitResult);
    });

    it('should return error result on failure', async () => {
      mockMarketDataService.waitForMarket.mockRejectedValue(
        new Error('Not authenticated'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'wait_for_market',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ isin: 'DE0007164600' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Not authenticated');
    });
  });
});
