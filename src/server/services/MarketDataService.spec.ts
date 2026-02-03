import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';
import { mockTradeRepublicApiService } from '@test/serviceMocks';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { MarketDataService } from './MarketDataService';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  TradeRepublicError,
} from './TradeRepublicApiService.types';
import {
  TickerApiResponseSchema,
  AggregateHistoryApiSchema,
  NeonSearchApiSchema,
  InstrumentApiSchema,
} from './MarketDataService.response';

describe('MarketDataService.response', () => {
  describe('TickerApiResponseSchema', () => {
    it('should parse numeric string values in prices', () => {
      const data = {
        bid: { price: '100.5', size: '1000' },
        ask: { price: '100.6', size: '500' },
      };

      const result = TickerApiResponseSchema.parse(data);

      expect(result.bid.price).toBe(100.5);
      expect(result.ask.price).toBe(100.6);
    });

    it('should pass through numeric values unchanged', () => {
      const data = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };

      const result = TickerApiResponseSchema.parse(data);

      expect(result.bid.price).toBe(100.5);
      expect(result.ask.price).toBe(100.6);
    });
  });
});

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
      AuthStatus.AUTHENTICATED,
    );
    service = new MarketDataService(
      mockTradeRepublicApiService as unknown as TradeRepublicApiService,
    );
  });

  // ==========================================================================
  // getPrice Tests
  // ==========================================================================
  describe('getPrice', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should call subscribeAndWait with correct parameters using default exchange', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
        last: { price: 100.55 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      await service.getPrice({ isin: 'DE0007164600' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'ticker',
        { id: 'DE0007164600.LSX' },
        TickerApiResponseSchema,
      );
    });

    it('should use specified exchange', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      await service.getPrice({ isin: 'DE0007164600', exchange: 'XETRA' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'ticker',
        { id: 'DE0007164600.XETRA' },
        TickerApiResponseSchema,
      );
    });

    it('should return formatted price data with spread calculations', async () => {
      const tickerData = {
        bid: { price: 100, size: 1000 },
        ask: { price: 101, size: 500 },
        last: { price: 100.5 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getPrice({ isin: 'DE0007164600' });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.bid).toBe(100);
      expect(result.ask).toBe(101);
      expect(result.last).toBe(100.5);
      expect(result.spread).toBe(1);
      expect(result.spreadPercent).toBeCloseTo(0.995, 2);
      expect(result.timestamp).toBeDefined();
    });

    it('should return spreadPercent as 0 when midPrice is 0', async () => {
      const tickerData = {
        bid: { price: 0, size: 0 },
        ask: { price: 0, size: 0 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getPrice({ isin: 'DE0007164600' });

      expect(result.bid).toBe(0);
      expect(result.ask).toBe(0);
      expect(result.spreadPercent).toBe(0);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('ticker request timed out'),
      );

      await expect(service.getPrice({ isin: 'DE0007164600' })).rejects.toThrow(
        'ticker request timed out',
      );
    });

    it('should log the request', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        bid: { price: 100 },
        ask: { price: 101 },
      });

      await service.getPrice({ isin: 'DE0007164600' });

      expect(logger.api.info).toHaveBeenCalledWith(
        { isin: 'DE0007164600', exchange: 'LSX' },
        'Requesting price data',
      );
    });
  });

  // ==========================================================================
  // getPriceHistory Tests
  // ==========================================================================
  describe('getPriceHistory', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.getPriceHistory({ isin: 'DE0007164600', range: '1d' }),
      ).rejects.toThrow(TradeRepublicError);
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const historyData = {
        aggregates: [],
        resolution: 60,
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        historyData,
      );

      await service.getPriceHistory({ isin: 'DE0007164600', range: '1m' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'aggregateHistory',
        { id: 'DE0007164600.LSX', range: '1m' },
        AggregateHistoryApiSchema,
      );
    });

    it('should return formatted candle data', async () => {
      const historyData = {
        aggregates: [
          {
            time: 1700000000,
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: 10000,
          },
        ],
        resolution: 3600,
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        historyData,
      );

      const result = await service.getPriceHistory({
        isin: 'DE0007164600',
        range: '1d',
      });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.range).toBe('1d');
      expect(result.candles).toHaveLength(1);
      expect(result.candles[0]).toEqual({
        time: 1700000000,
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 10000,
      });
      expect(result.resolution).toBe(3600);
    });
  });

  // ==========================================================================
  // getOrderBook Tests
  // ==========================================================================
  describe('getOrderBook', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.getOrderBook({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      await service.getOrderBook({ isin: 'DE0007164600' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'ticker',
        { id: 'DE0007164600.LSX' },
        TickerApiResponseSchema,
      );
    });

    it('should return formatted order book data', async () => {
      const tickerData = {
        bid: { price: 100, size: 1000 },
        ask: { price: 101, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getOrderBook({ isin: 'DE0007164600' });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.bids).toEqual([{ price: 100, size: 1000 }]);
      expect(result.asks).toEqual([{ price: 101, size: 500 }]);
      expect(result.spread).toBe(1);
      expect(result.midPrice).toBe(100.5);
      expect(result.timestamp).toBeDefined();
    });
  });

  // ==========================================================================
  // searchAssets Tests
  // ==========================================================================
  describe('searchAssets', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(service.searchAssets({ query: 'apple' })).rejects.toThrow(
        TradeRepublicError,
      );
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const searchData = { results: [] };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        searchData,
      );

      await service.searchAssets({ query: 'apple' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'neonSearch',
        { data: { q: 'apple' } },
        NeonSearchApiSchema,
      );
    });

    it('should return formatted search results', async () => {
      const searchData = {
        results: [
          {
            isin: 'US0378331005',
            name: 'Apple Inc.',
            type: 'stock',
            tags: ['tech'],
          },
        ],
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        searchData,
      );

      const result = await service.searchAssets({ query: 'apple' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].isin).toBe('US0378331005');
      expect(result.results[0].name).toBe('Apple Inc.');
      expect(result.totalCount).toBe(1);
    });

    it('should respect limit parameter', async () => {
      const searchData = {
        results: [
          { isin: 'ISIN1', name: 'Result 1', type: 'stock', tags: [] },
          { isin: 'ISIN2', name: 'Result 2', type: 'stock', tags: [] },
          { isin: 'ISIN3', name: 'Result 3', type: 'stock', tags: [] },
        ],
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        searchData,
      );

      const result = await service.searchAssets({ query: 'test', limit: 2 });

      expect(result.results).toHaveLength(2);
      expect(result.totalCount).toBe(3);
    });
  });

  // ==========================================================================
  // getAssetInfo Tests
  // ==========================================================================
  describe('getAssetInfo', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.getAssetInfo({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const instrumentData = {
        isin: 'DE0007164600',
        name: 'SAP SE',
        shortName: 'SAP',
        typeId: 'stock',
        wkn: '716460',
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        instrumentData,
      );

      await service.getAssetInfo({ isin: 'DE0007164600' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'instrument',
        { id: 'DE0007164600' },
        InstrumentApiSchema,
      );
    });

    it('should return formatted asset info', async () => {
      const instrumentData = {
        isin: 'DE0007164600',
        name: 'SAP SE',
        shortName: 'SAP',
        typeId: 'stock',
        wkn: '716460',
        intlSymbol: 'SAP',
        homeSymbol: 'SAP',
        company: {
          name: 'SAP SE',
          description: 'Software company',
          countryOfOrigin: 'DE',
        },
        exchanges: [{ exchangeId: 'LSX', name: 'Lang & Schwarz' }],
        tags: [{ name: 'Tech' }],
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        instrumentData,
      );

      const result = await service.getAssetInfo({ isin: 'DE0007164600' });

      expect(result.isin).toBe('DE0007164600');
      expect(result.name).toBe('SAP SE');
      expect(result.shortName).toBe('SAP');
      expect(result.symbol).toBe('SAP');
      expect(result.type).toBe('stock');
      expect(result.wkn).toBe('716460');
      expect(result.company?.name).toBe('SAP SE');
      expect(result.exchanges).toHaveLength(1);
      expect(result.tags).toEqual(['Tech']);
    });
  });

  // ==========================================================================
  // getMarketStatus Tests
  // ==========================================================================
  describe('getMarketStatus', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.getMarketStatus({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      await service.getMarketStatus({ isin: 'DE0007164600' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'ticker',
        { id: 'DE0007164600.LSX' },
        TickerApiResponseSchema,
      );
    });

    it('should return market open status when bid and ask are available', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getMarketStatus({ isin: 'DE0007164600' });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.status).toBe('open');
      expect(result.isOpen).toBe(true);
      expect(result.hasBid).toBe(true);
      expect(result.hasAsk).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should return market closed status when bid is zero', async () => {
      const tickerData = {
        bid: { price: 0, size: 0 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getMarketStatus({ isin: 'DE0007164600' });

      expect(result.status).toBe('closed');
      expect(result.isOpen).toBe(false);
      expect(result.hasBid).toBe(false);
      expect(result.hasAsk).toBe(true);
    });

    it('should return pre-market status when pre price is available', async () => {
      const tickerData = {
        bid: { price: 0, size: 0 },
        ask: { price: 0, size: 0 },
        pre: { price: 99.5 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.getMarketStatus({ isin: 'DE0007164600' });

      expect(result.status).toBe('pre-market');
      expect(result.isOpen).toBe(false);
    });
  });

  // ==========================================================================
  // waitForMarket Tests
  // ==========================================================================
  describe('waitForMarket', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.waitForMarket({ isin: 'DE0007164600' }),
      ).rejects.toThrow(TradeRepublicError);
    });

    it('should return immediately if market is already open', async () => {
      const tickerData = {
        bid: { price: 100.5, size: 1000 },
        ask: { price: 100.6, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const result = await service.waitForMarket({ isin: 'DE0007164600' });

      expect(result.isOpen).toBe(true);
      expect(result.timedOut).toBe(false);
    });

    it('should timeout if market does not open within timeout', async () => {
      jest.useFakeTimers();

      const tickerData = {
        bid: { price: 0, size: 0 },
        ask: { price: 0, size: 0 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 100,
        pollIntervalMs: 50,
      });

      await jest.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result.isOpen).toBe(false);
      expect(result.timedOut).toBe(true);

      jest.useRealTimers();
    });

    it('should poll until market opens', async () => {
      jest.useFakeTimers();

      let callCount = 0;
      mockTradeRepublicApiService.subscribeAndWait.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            bid: { price: 0, size: 0 },
            ask: { price: 0, size: 0 },
          } as never);
        }
        return Promise.resolve({
          bid: { price: 100, size: 1000 },
          ask: { price: 101, size: 500 },
        } as never);
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 10000,
        pollIntervalMs: 100,
      });

      await jest.advanceTimersByTimeAsync(300);

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(result.timedOut).toBe(false);

      jest.useRealTimers();
    });

    it('should log the wait request', async () => {
      const tickerData = {
        bid: { price: 100, size: 1000 },
        ask: { price: 101, size: 500 },
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        tickerData,
      );

      await service.waitForMarket({ isin: 'DE0007164600' });

      expect(logger.api.info).toHaveBeenCalledWith(
        expect.objectContaining({
          isin: 'DE0007164600',
          exchange: 'LSX',
        }),
        'Waiting for market to open',
      );
    });

    it('should continue polling on errors and log warnings', async () => {
      jest.useFakeTimers();

      let callCount = 0;
      mockTradeRepublicApiService.subscribeAndWait.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          bid: { price: 100, size: 1000 },
          ask: { price: 101, size: 500 },
        } as never);
      });

      const promise = service.waitForMarket({
        isin: 'DE0007164600',
        timeoutMs: 10000,
        pollIntervalMs: 100,
      });

      await jest.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result.isOpen).toBe(true);
      expect(logger.api.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error checking market status, retrying',
      );

      jest.useRealTimers();
    });
  });
});
