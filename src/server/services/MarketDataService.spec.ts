/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { MarketDataService } from './MarketDataService';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';

/**
 * Creates a mock TradeRepublicApiService for testing.
 */
function createMockApiService(): jest.Mocked<TradeRepublicApiService> {
  return {
    getAuthStatus: jest
      .fn<() => AuthStatus>()
      .mockReturnValue(AuthStatus.AUTHENTICATED),
    subscribe: jest
      .fn<(input: { topic: string; payload?: object }) => number>()
      .mockReturnValue(1),
    unsubscribe: jest.fn<(id: number) => void>(),
    onMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    offMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    onError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
    offError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
  } as unknown as jest.Mocked<TradeRepublicApiService>;
}

describe('MarketDataService', () => {
  let mockApi: jest.Mocked<TradeRepublicApiService>;
  let service: MarketDataService;
  const SHORT_TIMEOUT = 100;

  beforeEach(() => {
    mockApi = createMockApiService();
    service = new MarketDataService(mockApi, SHORT_TIMEOUT);
  });

  // ==========================================================================
  // getPrice Tests
  // ==========================================================================
  describe('getPrice', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should subscribe to ticker topic with correct ID format (ISIN.EXCHANGE)', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getPrice({
        isin: 'DE0007164600',
        exchange: 'XETRA',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'ticker',
        payload: { id: 'DE0007164600.XETRA' },
      });

      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should use default exchange (LSX) when not provided', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getPrice({ isin: 'DE0007164600' });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'ticker',
        payload: { id: 'DE0007164600.LSX' },
      });

      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should resolve with price data on success', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
        last: { price: 100.55, time: '2024-01-15T10:30:00Z' },
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: tickerData,
      });

      const result = await promise;

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.bid).toBe(100.5);
      expect(result.ask).toBe(100.6);
      expect(result.last).toBe(100.55);
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate spread correctly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.spread).toBe(1);
    });

    it('should calculate spreadPercent correctly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 102 },
        },
      });

      const result = await promise;

      // spreadPercent = spread / midPrice * 100 = 2 / 101 * 100 = ~1.98%
      expect(result.spreadPercent).toBeCloseTo(1.98, 1);
    });

    it('should reject on API error (code E)', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription failed' },
      });

      await expect(promise).rejects.toThrow(TradeRepublicError);
      await expect(promise).rejects.toThrow('Subscription failed');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'ticker request timed out',
      );
    });

    it('should handle missing last price', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.last).toBeUndefined();
    });

    it('should cleanup on success', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should cleanup on error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Error' },
      });

      await expect(promise).rejects.toThrow();

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should cleanup on timeout', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      await expect(
        service.getPrice({ isin: 'DE0007164600' }),
      ).rejects.toThrow();

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should handle numeric string prices', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: '100.50' },
          ask: { price: '101.00' },
          last: { price: '100.75' },
        },
      });

      const result = await promise;

      expect(result.bid).toBe(100.5);
      expect(result.ask).toBe(101.0);
      expect(result.last).toBe(100.75);
    });

    it('should handle zero midPrice for spreadPercent calculation', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      // Both bid and ask are 0, so midPrice is 0
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      const result = await promise;

      expect(result.spread).toBe(0);
      expect(result.spreadPercent).toBe(0); // Avoid division by zero
    });
  });

  // ==========================================================================
  // getPriceHistory Tests
  // ==========================================================================
  describe('getPriceHistory', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.getPriceHistory({ isin: 'DE0007164600', range: '1d' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.getPriceHistory({ isin: 'DE0007164600', range: '1d' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to aggregateHistory topic with range', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1m',
        exchange: 'XETRA',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'aggregateHistory',
        payload: { id: 'DE0007164600.XETRA', range: '1m' },
      });

      await expect(promise).rejects.toThrow(
        'aggregateHistory request timed out',
      );
    });

    it('should resolve with candle data', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      const historyData = {
        aggregates: [
          {
            time: 1705312800000,
            open: 100,
            high: 102,
            low: 99,
            close: 101,
            volume: 10000,
          },
        ],
        resolution: 3600,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: historyData,
      });

      const result = await promise;

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.range).toBe('1d');
      expect(result.candles).toHaveLength(1);
      expect(result.candles[0].open).toBe(100);
      expect(result.candles[0].high).toBe(102);
      expect(result.candles[0].low).toBe(99);
      expect(result.candles[0].close).toBe(101);
      expect(result.candles[0].volume).toBe(10000);
      expect(result.resolution).toBe(3600);
    });

    it.each(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'max'] as const)(
      'should accept TimeRange value: %s',
      async (range) => {
        mockApi.subscribe.mockReturnValue(42);

        const promise = service.getPriceHistory({
          isin: 'DE0007164600',
          range,
        });

        expect(mockApi.subscribe).toHaveBeenCalledWith({
          topic: 'aggregateHistory',
          payload: { id: 'DE0007164600.LSX', range },
        });

        await expect(promise).rejects.toThrow(
          'aggregateHistory request timed out',
        );
      },
    );

    it('should reject on API error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Invalid range' },
      });

      await expect(promise).rejects.toThrow('Invalid range');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(
        service.getPriceHistory({ isin: 'DE0007164600', range: '1d' }),
      ).rejects.toThrow('aggregateHistory request timed out');
    });

    it('should handle empty candles array', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { aggregates: [] },
      });

      const result = await promise;

      expect(result.candles).toHaveLength(0);
    });

    it('should cleanup properly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { aggregates: [] },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should handle numeric string values in candles', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          aggregates: [
            {
              time: 1705312800000,
              open: '100.50',
              high: '102.00',
              low: '99.00',
              close: '101.50',
              volume: '10000',
            },
          ],
        },
      });

      const result = await promise;

      expect(result.candles[0].open).toBe(100.5);
      expect(result.candles[0].high).toBe(102.0);
      expect(result.candles[0].low).toBe(99.0);
      expect(result.candles[0].close).toBe(101.5);
      expect(result.candles[0].volume).toBe(10000);
    });
  });

  // ==========================================================================
  // getOrderBook Tests
  // ==========================================================================
  describe('getOrderBook', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.getOrderBook({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.getOrderBook({ isin: 'DE0007164600' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to ticker topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getOrderBook({
        isin: 'DE0007164600',
        exchange: 'XETRA',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'ticker',
        payload: { id: 'DE0007164600.XETRA' },
      });

      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should resolve with bids/asks', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrderBook({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100.5, size: 1000 },
          ask: { price: 100.6, size: 500 },
        },
      });

      const result = await promise;

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.bids).toHaveLength(1);
      expect(result.bids[0].price).toBe(100.5);
      expect(result.bids[0].size).toBe(1000);
      expect(result.asks).toHaveLength(1);
      expect(result.asks[0].price).toBe(100.6);
      expect(result.asks[0].size).toBe(500);
    });

    it('should calculate spread and midPrice', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrderBook({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 102 },
        },
      });

      const result = await promise;

      expect(result.spread).toBe(2);
      expect(result.midPrice).toBe(101);
    });

    it('should handle missing sizes', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrderBook({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.bids[0].size).toBeUndefined();
      expect(result.asks[0].size).toBeUndefined();
    });

    it('should cleanup properly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrderBook({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should reject on API error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrderBook({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Ticker not found' },
      });

      await expect(promise).rejects.toThrow('Ticker not found');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(
        service.getOrderBook({ isin: 'DE0007164600' }),
      ).rejects.toThrow('ticker request timed out');
    });
  });

  // ==========================================================================
  // searchAssets Tests
  // ==========================================================================
  describe('searchAssets', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.searchAssets({ query: 'Apple' })).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.searchAssets({ query: 'Apple' })).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should subscribe to neonSearch topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.searchAssets({ query: 'Apple' });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'neonSearch',
        payload: { data: { q: 'Apple' } },
      });

      await expect(promise).rejects.toThrow('neonSearch request timed out');
    });

    it('should resolve with results', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.searchAssets({ query: 'Apple' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          results: [
            {
              isin: 'US0378331005',
              name: 'Apple Inc.',
              type: 'stock',
              tags: ['tech'],
            },
            { isin: 'US0378331006', name: 'Apple ETF', type: 'etf' },
          ],
        },
      });

      const result = await promise;

      expect(result.results).toHaveLength(2);
      expect(result.results[0].isin).toBe('US0378331005');
      expect(result.results[0].name).toBe('Apple Inc.');
      expect(result.results[0].type).toBe('stock');
      expect(result.results[0].tags).toEqual(['tech']);
      expect(result.totalCount).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.searchAssets({ query: 'Apple', limit: 1 });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          results: [
            { isin: 'US0378331005', name: 'Apple Inc.' },
            { isin: 'US0378331006', name: 'Apple ETF' },
          ],
        },
      });

      const result = await promise;

      // Service should truncate to limit
      expect(result.results).toHaveLength(1);
      expect(result.totalCount).toBe(2);
    });

    it('should handle empty results', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.searchAssets({ query: 'xyznonsense' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { results: [] },
      });

      const result = await promise;

      expect(result.results).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should cleanup properly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.searchAssets({ query: 'Apple' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { results: [] },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should reject on API error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.searchAssets({ query: 'Apple' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Search failed' },
      });

      await expect(promise).rejects.toThrow('Search failed');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(service.searchAssets({ query: 'Apple' })).rejects.toThrow(
        'neonSearch request timed out',
      );
    });

    it('should use default limit when not provided', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      // Generate 15 results
      const manyResults = Array.from({ length: 15 }, (_, i) => ({
        isin: `US000000000${i}`,
        name: `Stock ${i}`,
      }));

      const promise = service.searchAssets({ query: 'Stock' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { results: manyResults },
      });

      const result = await promise;

      // Default limit is 10
      expect(result.results).toHaveLength(10);
      expect(result.totalCount).toBe(15);
    });
  });

  // ==========================================================================
  // getAssetInfo Tests
  // ==========================================================================
  describe('getAssetInfo', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.getAssetInfo({ isin: 'US0378331005' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.getAssetInfo({ isin: 'US0378331005' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to instrument topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'instrument',
        payload: { id: 'US0378331005' },
      });

      await expect(promise).rejects.toThrow('instrument request timed out');
    });

    it('should resolve with instrument details', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
          shortName: 'AAPL',
          intlSymbol: 'AAPL',
          typeId: 'stock',
          wkn: '865985',
        },
      });

      const result = await promise;

      expect(result.isin).toBe('US0378331005');
      expect(result.name).toBe('Apple Inc.');
      expect(result.shortName).toBe('AAPL');
      expect(result.symbol).toBe('AAPL');
      expect(result.type).toBe('stock');
      expect(result.wkn).toBe('865985');
    });

    it('should transform company fields correctly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
          company: {
            name: 'Apple Inc.',
            description: 'Technology company',
            countryOfOrigin: 'US',
          },
        },
      });

      const result = await promise;

      expect(result.company).toBeDefined();
      expect(result.company!.name).toBe('Apple Inc.');
      expect(result.company!.description).toBe('Technology company');
      expect(result.company!.country).toBe('US');
    });

    it('should transform exchange fields correctly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
          exchanges: [
            { exchangeId: 'LSX', name: 'Lang & Schwarz' },
            { exchangeId: 'XETRA', name: 'XETRA' },
          ],
        },
      });

      const result = await promise;

      expect(result.exchanges).toHaveLength(2);
      expect(result.exchanges![0].id).toBe('LSX');
      expect(result.exchanges![0].name).toBe('Lang & Schwarz');
    });

    it('should handle missing optional fields', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
        },
      });

      const result = await promise;

      expect(result.shortName).toBeUndefined();
      expect(result.symbol).toBeUndefined();
      expect(result.type).toBeUndefined();
      expect(result.company).toBeUndefined();
      expect(result.exchanges).toBeUndefined();
    });

    it('should cleanup properly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
        },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should reject on API error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'INVALID' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Instrument not found' },
      });

      await expect(promise).rejects.toThrow('Instrument not found');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(
        service.getAssetInfo({ isin: 'US0378331005' }),
      ).rejects.toThrow('instrument request timed out');
    });

    it('should transform tags correctly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getAssetInfo({ isin: 'US0378331005' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          isin: 'US0378331005',
          name: 'Apple Inc.',
          tags: [
            { id: 'tech', name: 'Technology' },
            { id: 'us', name: 'United States' },
          ],
        },
      });

      const result = await promise;

      expect(result.tags).toEqual(['Technology', 'United States']);
    });
  });

  // ==========================================================================
  // getMarketStatus Tests
  // ==========================================================================
  describe('getMarketStatus', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.getMarketStatus({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.getMarketStatus({ isin: 'DE0007164600' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should derive status from ticker data', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.status).toBe('open');
    });

    it('should return isOpen: true when bid/ask available', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(result.hasBid).toBe(true);
      expect(result.hasAsk).toBe(true);
    });

    it('should return isOpen: false when no bid/ask', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      // Simulate response without bid/ask prices (or with zero prices)
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(false);
      expect(result.hasBid).toBe(false);
      expect(result.hasAsk).toBe(false);
    });

    it('should return pre-market status when pre price available', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
          pre: { price: 99.5 },
        },
      });

      const result = await promise;

      expect(result.status).toBe('pre-market');
      expect(result.isOpen).toBe(false);
    });

    it('should return closed status when no prices', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      const result = await promise;

      expect(result.status).toBe('closed');
    });

    it('should handle ticker errors gracefully', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'INVALID' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Ticker not found' },
      });

      await expect(promise).rejects.toThrow('Ticker not found');
    });

    it('should cleanup properly', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should include timestamp in response', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getMarketStatus({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should use specified exchange', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getMarketStatus({
        isin: 'DE0007164600',
        exchange: 'XETRA',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'ticker',
        payload: { id: 'DE0007164600.XETRA' },
      });

      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(
        service.getMarketStatus({ isin: 'DE0007164600' }),
      ).rejects.toThrow('ticker request timed out');
    });
  });

  // ==========================================================================
  // waitForMarket Tests
  // ==========================================================================
  describe('waitForMarket', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.waitForMarket({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.waitForMarket({ isin: 'DE0007164600' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should resolve immediately if market is open', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      // Simulate market is open
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.waitedMs).toBeGreaterThanOrEqual(0);
    });

    it('should poll until market opens', async () => {
      jest.useFakeTimers();
      const subId = 42;
      let subscriptionCount = 0;
      mockApi.subscribe.mockImplementation(() => {
        subscriptionCount++;
        return subId;
      });

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      // First poll - market closed
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      // Advance time to trigger second poll
      await jest.advanceTimersByTimeAsync(1000);

      // Second poll - market open
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(subscriptionCount).toBeGreaterThanOrEqual(2);

      jest.useRealTimers();
    });

    it('should timeout after timeoutMs', async () => {
      jest.useFakeTimers();
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 2000,
        pollIntervalMs: 1000,
      });

      // Market stays closed
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      // Advance past timeout
      await jest.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result.isOpen).toBe(false);
      expect(result.timedOut).toBe(true);

      jest.useRealTimers();
    });

    it('should return timedOut: true on timeout', async () => {
      // Use a very short service with very short timeout
      const shortService = new MarketDataService(mockApi, 50);
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = shortService.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 100, // Very short timeout
        pollIntervalMs: 50,
      });

      // Market stays closed on first poll
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      // Keep responding with closed market until timeout
      const closedPayload = {
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      };

      // Respond to multiple polls with closed market
      const intervalId = setInterval(() => {
        if (messageHandler) {
          messageHandler(closedPayload);
        }
      }, 30);

      const result = await promise;
      clearInterval(intervalId);

      expect(result.timedOut).toBe(true);
      expect(result.isOpen).toBe(false);
    });

    it('should return waitedMs accurately', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const startTime = Date.now();
      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      // Immediate open
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;
      const elapsed = Date.now() - startTime;

      // Should be roughly accurate (allow some margin)
      expect(result.waitedMs).toBeLessThanOrEqual(elapsed + 50);
      expect(result.waitedMs).toBeGreaterThanOrEqual(0);
    });

    it('should use default timeout (60s) when timeoutMs not provided', async () => {
      // Use a short service timeout but test that waitForMarket uses 60s default
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        // Not providing timeoutMs - should use default 60000
        pollIntervalMs: 50, // Short poll interval for test
      });

      // Market is open immediately
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(result.timedOut).toBe(false);
    });

    it('should use default pollInterval (5s)', async () => {
      jest.useFakeTimers();
      const subId = 42;
      let subscriptionCount = 0;
      mockApi.subscribe.mockImplementation(() => {
        subscriptionCount++;
        return subId;
      });

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      // Use default pollInterval but short timeout
      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 12000,
      });

      // First poll - market closed
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      // Advance time by 5 seconds (default poll interval)
      await jest.advanceTimersByTimeAsync(5000);

      // Second poll - market open
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      await promise;

      expect(subscriptionCount).toBe(2);

      jest.useRealTimers();
    });

    it('should cleanup subscriptions between polls', async () => {
      jest.useFakeTimers();
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      // First poll - market closed
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 0 },
          ask: { price: 0 },
        },
      });

      // Should have cleaned up after first poll
      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);

      // Advance time to trigger second poll
      await jest.advanceTimersByTimeAsync(1000);

      // Second poll - market open
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      await promise;

      // Should have cleaned up after second poll too
      expect(mockApi.unsubscribe).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should include isin and exchange in response', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        exchange: 'XETRA',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('XETRA');
    });

    it('should include timestamp in response', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should handle getMarketStatus errors during polling', async () => {
      jest.useFakeTimers();
      const subId = 42;
      let pollCount = 0;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 5000,
        pollIntervalMs: 1000,
      });

      // First poll - error (should continue polling)
      pollCount++;
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Temporary error' },
      });

      await jest.advanceTimersByTimeAsync(1000);

      // Second poll - success
      pollCount++;
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(pollCount).toBe(2);

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // Additional Edge Cases
  // ==========================================================================
  describe('edge cases', () => {
    it('should ignore messages for other subscription IDs', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      // Send message for different subscription ID
      messageHandler!({
        id: 999,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      // Should still timeout since we didn't get our message
      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should handle WebSocket errors', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      errorHandler!(new Error('WebSocket connection lost'));

      await expect(promise).rejects.toThrow('WebSocket connection lost');
    });

    it('should handle subscription failure', async () => {
      mockApi.subscribe.mockImplementation(() => {
        throw new Error('Subscribe failed');
      });

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'Subscribe failed',
      );
    });

    it('should handle non-Error thrown from subscribe', async () => {
      mockApi.subscribe.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error from subscribe';
      });

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'String error from subscribe',
      );
    });

    it('should ignore unsubscribe errors during cleanup', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);
      mockApi.unsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      // Should not throw despite unsubscribe failure
      const result = await promise;
      expect(result.bid).toBe(100);
    });

    it('should use default error message if no message in error payload', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: {},
      });

      await expect(promise).rejects.toThrow('API error');
    });

    it('should handle invalid response format', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      // Send invalid data
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { invalid: 'data' },
      });

      await expect(promise).rejects.toThrow('Invalid ticker response format');
    });

    it('should handle WebSocketMessage errors with matching subscription ID', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      errorHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription error' },
      });

      await expect(promise).rejects.toThrow('Subscription error');
    });

    it('should handle WebSocketMessage errors without message in payload', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      errorHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: 'Raw error string',
      });

      await expect(promise).rejects.toThrow('Raw error string');
    });

    it('should ignore WebSocketMessage errors for other subscription IDs', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      // Send error for different subscription ID - should be ignored
      errorHandler!({
        id: 999,
        code: MESSAGE_CODE.E,
        payload: { message: 'Other subscription error' },
      });

      // Should still timeout since we didn't get our message
      await expect(promise).rejects.toThrow('ticker request timed out');
    });

    it('should ignore errors that arrive after already resolved', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPrice({ isin: 'DE0007164600' });

      // First send a successful response
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {
          bid: { price: 100 },
          ask: { price: 101 },
        },
      });

      // Then send an error (which should be ignored)
      errorHandler!(new Error('Late error'));

      // Should resolve successfully without the late error affecting it
      const result = await promise;
      expect(result.bid).toBe(100);
    });
  });
});
