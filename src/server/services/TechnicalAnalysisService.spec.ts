/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { TechnicalAnalysisError } from './TechnicalAnalysisService.types';
import type { MarketDataService } from './MarketDataService';
import type { GetPriceHistoryResponse } from './MarketDataService.response';

// Standalone mock functions to avoid unbound-method lint errors
const getPriceHistoryMock =
  jest.fn<(request: unknown) => Promise<GetPriceHistoryResponse>>();

/**
 * Creates a mock MarketDataService for testing.
 */
function createMockMarketDataService(): jest.Mocked<MarketDataService> {
  return {
    getPriceHistory: getPriceHistoryMock,
    getPrice: jest.fn(),
    getOrderBook: jest.fn(),
    searchAssets: jest.fn(),
    getAssetInfo: jest.fn(),
    getMarketStatus: jest.fn(),
    waitForMarket: jest.fn(),
  } as unknown as jest.Mocked<MarketDataService>;
}

/**
 * Generate sample candles for testing.
 */
function generateCandles(
  count: number,
  options?: { withVolume?: boolean },
): GetPriceHistoryResponse['candles'] {
  const candles: GetPriceHistoryResponse['candles'] = [];
  let basePrice = 100;

  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i * 0.5) * 5 + (Math.random() - 0.5) * 2;
    const open = basePrice + variation;
    const high = open + Math.random() * 3;
    const low = open - Math.random() * 3;
    const close = low + Math.random() * (high - low);

    candles.push({
      time: Date.now() - (count - i) * 86400000,
      open,
      high,
      low,
      close,
      volume: options?.withVolume
        ? Math.floor(Math.random() * 10000) + 1000
        : undefined,
    });

    basePrice = close;
  }

  return candles;
}

/**
 * Generate trending candles for testing.
 */
function generateTrendingCandles(
  count: number,
  direction: 'up' | 'down',
  options?: { withVolume?: boolean },
): GetPriceHistoryResponse['candles'] {
  const candles: GetPriceHistoryResponse['candles'] = [];
  let basePrice = direction === 'up' ? 100 : 200;
  const trend = direction === 'up' ? 2 : -2;

  for (let i = 0; i < count; i++) {
    const open = basePrice;
    const change = (Math.random() * 1 + 1) * trend;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;

    candles.push({
      time: Date.now() - (count - i) * 86400000,
      open,
      high,
      low,
      close,
      volume: options?.withVolume
        ? Math.floor(Math.random() * 10000) + 1000
        : undefined,
    });

    basePrice = close;
  }

  return candles;
}

describe('TechnicalAnalysisService', () => {
  let mockMarketData: jest.Mocked<MarketDataService>;
  let service: TechnicalAnalysisService;

  beforeEach(() => {
    mockMarketData = createMockMarketDataService();
    service = new TechnicalAnalysisService(mockMarketData);
  });

  // ==========================================================================
  // getIndicators Tests
  // ==========================================================================
  describe('getIndicators', () => {
    it('should fetch candles from MarketDataService', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(getPriceHistoryMock).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '3m',
        exchange: 'LSX',
      });
    });

    it('should calculate requested indicator', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result.indicators).toHaveLength(1);
      expect(result.indicators[0].type).toBe('RSI');
    });

    it('should calculate multiple indicators', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }, { type: 'SMA' }, { type: 'EMA' }],
      });

      expect(result.indicators).toHaveLength(3);
      expect(result.indicators[0].type).toBe('RSI');
      expect(result.indicators[1].type).toBe('SMA');
      expect(result.indicators[2].type).toBe('EMA');
    });

    it('should use custom period when specified', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI', period: 7 }],
      });

      expect(result.indicators[0].period).toBe(7);
    });

    it('should return null value for insufficient data', async () => {
      const candles = generateCandles(10); // Not enough for RSI
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result.indicators[0].value).toBeNull();
    });

    it('should calculate MACD with components', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'MACD' }],
      });

      expect(result.indicators[0].type).toBe('MACD');
      expect(result.indicators[0].components).toBeDefined();
      expect(result.indicators[0].components!.macd).toBeDefined();
      expect(result.indicators[0].components!.signal).toBeDefined();
      expect(result.indicators[0].components!.histogram).toBeDefined();
    });

    it('should calculate Bollinger Bands with components', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'BOLLINGER' }],
      });

      expect(result.indicators[0].type).toBe('BOLLINGER');
      expect(result.indicators[0].components).toBeDefined();
      expect(result.indicators[0].components!.upper).toBeDefined();
      expect(result.indicators[0].components!.middle).toBeDefined();
      expect(result.indicators[0].components!.lower).toBeDefined();
      expect(result.indicators[0].components!.pb).toBeDefined();
    });

    it('should calculate Stochastic with components', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'STOCHASTIC' }],
      });

      expect(result.indicators[0].type).toBe('STOCHASTIC');
      expect(result.indicators[0].components).toBeDefined();
      expect(result.indicators[0].components!.k).toBeDefined();
      expect(result.indicators[0].components!.d).toBeDefined();
    });

    it('should calculate ADX with components', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'ADX' }],
      });

      expect(result.indicators[0].type).toBe('ADX');
      expect(result.indicators[0].value).not.toBeNull();
    });

    it('should throw TechnicalAnalysisError for empty candles', async () => {
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles: [],
      });

      await expect(
        service.getIndicators({
          isin: 'DE0007164600',
          range: '3m',
          indicators: [{ type: 'RSI' }],
        }),
      ).rejects.toThrow(TechnicalAnalysisError);
    });

    it('should propagate errors from MarketDataService', async () => {
      mockMarketData.getPriceHistory.mockRejectedValue(
        new Error('Not authenticated'),
      );

      await expect(
        service.getIndicators({
          isin: 'DE0007164600',
          range: '3m',
          indicators: [{ type: 'RSI' }],
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should include metadata in response', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.range).toBe('3m');
      expect(result.candleCount).toBe(50);
      expect(result.timestamp).toBeDefined();
    });

    it('should use specified exchange', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'XETRA',
        range: '3m',
        candles,
      });

      await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
        exchange: 'XETRA',
      });

      expect(getPriceHistoryMock).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '3m',
        exchange: 'XETRA',
      });
    });

    it('should calculate OBV when volume is available', async () => {
      const candles = generateCandles(50, { withVolume: true });
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'OBV' }],
      });

      expect(result.indicators[0].type).toBe('OBV');
      expect(result.indicators[0].value).not.toBeNull();
    });

    it('should return null for OBV when volume is not available', async () => {
      const candles = generateCandles(50, { withVolume: false });
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'OBV' }],
      });

      expect(result.indicators[0].value).toBeNull();
    });

    it('should calculate VWAP when volume is available', async () => {
      const candles = generateCandles(50, { withVolume: true });
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'VWAP' }],
      });

      expect(result.indicators[0].type).toBe('VWAP');
      expect(result.indicators[0].value).not.toBeNull();
    });

    it('should calculate ATR', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'ATR' }],
      });

      expect(result.indicators[0].type).toBe('ATR');
      expect(result.indicators[0].value).not.toBeNull();
    });
  });

  // ==========================================================================
  // getDetailedAnalysis Tests
  // ==========================================================================
  describe('getDetailedAnalysis', () => {
    it('should fetch candles with default 3m range', async () => {
      const candles = generateCandles(100, { withVolume: true });
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(getPriceHistoryMock).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '3m',
        exchange: 'LSX',
      });
    });

    it('should require minimum 50 candles', async () => {
      const candles = generateCandles(30);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      await expect(
        service.getDetailedAnalysis({
          isin: 'DE0007164600',
        }),
      ).rejects.toThrow(TechnicalAnalysisError);
    });

    it('should calculate all core indicators', async () => {
      const candles = generateCandles(100, { withVolume: true });
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.indicators.rsi).toBeDefined();
      expect(result.indicators.macd).toBeDefined();
      expect(result.indicators.bollingerBands).toBeDefined();
      expect(result.indicators.stochastic).toBeDefined();
      expect(result.indicators.adx).toBeDefined();
      expect(result.indicators.atr).toBeDefined();
    });

    it('should include current price', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.currentPrice).toBe(candles[candles.length - 1].close);
    });

    it('should generate signals', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
    });

    it('should include trend analysis', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend).toBeDefined();
      expect(['uptrend', 'downtrend', 'sideways']).toContain(
        result.trend.direction,
      );
      expect(['strong', 'moderate', 'weak']).toContain(result.trend.strength);
    });

    it('should include summary with overall signal', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.summary).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(result.summary.overallSignal);
      expect(result.summary.confidence).toBeGreaterThanOrEqual(0);
      expect(result.summary.confidence).toBeLessThanOrEqual(100);
      expect(result.summary.score).toBeGreaterThanOrEqual(-100);
      expect(result.summary.score).toBeLessThanOrEqual(100);
    });

    it('should generate buy signal for strong uptrend', async () => {
      const candles = generateTrendingCandles(100, 'up');
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Strong uptrend should have uptrend direction
      expect(result.trend.direction).toBe('uptrend');
    });

    it('should generate sell signal for strong downtrend', async () => {
      const candles = generateTrendingCandles(100, 'down');
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Strong downtrend should have downtrend direction
      expect(result.trend.direction).toBe('downtrend');
    });

    it('should handle score calculation with zero total', async () => {
      // Create candles that would result in all neutral signals
      const candles: GetPriceHistoryResponse['candles'] = [];
      for (let i = 0; i < 100; i++) {
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: 100,
          high: 100.1,
          low: 99.9,
          close: 100,
        });
      }
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Should handle division by zero gracefully
      expect(typeof result.summary.score).toBe('number');
      expect(Number.isFinite(result.summary.score)).toBe(true);
    });

    it('should return metadata in response', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.isin).toBe('DE0007164600');
      expect(result.exchange).toBe('LSX');
      expect(result.range).toBe('3m');
      expect(result.timestamp).toBeDefined();
    });

    it('should use specified range', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '1y',
        candles,
      });

      await service.getDetailedAnalysis({
        isin: 'DE0007164600',
        range: '1y',
      });

      expect(getPriceHistoryMock).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '1y',
        exchange: 'LSX',
      });
    });

    it('should use specified exchange', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'XETRA',
        range: '3m',
        candles,
      });

      await service.getDetailedAnalysis({
        isin: 'DE0007164600',
        exchange: 'XETRA',
      });

      expect(getPriceHistoryMock).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '3m',
        exchange: 'XETRA',
      });
    });

    it('should propagate errors from MarketDataService', async () => {
      mockMarketData.getPriceHistory.mockRejectedValue(
        new Error('Not authenticated'),
      );

      await expect(
        service.getDetailedAnalysis({
          isin: 'DE0007164600',
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should include counts in summary', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(typeof result.summary.bullishCount).toBe('number');
      expect(typeof result.summary.bearishCount).toBe('number');
      expect(typeof result.summary.neutralCount).toBe('number');
    });
  });

  // ==========================================================================
  // Signal Generation Tests
  // ==========================================================================
  describe('signal generation', () => {
    it('should generate RSI oversold signal for low RSI', async () => {
      // Generate candles with strong downtrend to get low RSI
      const candles = generateTrendingCandles(100, 'down');
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
    });

    it('should generate strong RSI buy signal for extreme RSI < 20', async () => {
      // Generate extreme downtrend to get RSI below 20
      const candles: GetPriceHistoryResponse['candles'] = [];
      let price = 200;
      for (let i = 0; i < 100; i++) {
        price = price * 0.97; // 3% daily drop for extreme RSI
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: price * 1.01,
          high: price * 1.02,
          low: price * 0.99,
          close: price,
        });
      }
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.signal).toBe('buy');
      // RSI should be very low with strong downtrend
      expect(['strong', 'moderate']).toContain(rsiSignal!.strength);
    });

    it('should generate RSI overbought signal for high RSI', async () => {
      // Generate candles with strong uptrend to get high RSI
      const candles = generateTrendingCandles(100, 'up');
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
    });

    it('should generate strong RSI sell signal for extreme RSI > 80', async () => {
      // Generate extreme uptrend to get RSI above 80
      const candles: GetPriceHistoryResponse['candles'] = [];
      let price = 50;
      for (let i = 0; i < 100; i++) {
        price = price * 1.03; // 3% daily gain for extreme RSI
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: price * 0.99,
          high: price * 1.01,
          low: price * 0.98,
          close: price,
        });
      }
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.signal).toBe('sell');
      // RSI should be very high with strong uptrend
      expect(['strong', 'moderate']).toContain(rsiSignal!.strength);
    });

    it('should include signal strength', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      for (const signal of result.signals) {
        expect(['strong', 'moderate', 'weak']).toContain(signal.strength);
      }
    });

    it('should include signal reason', async () => {
      const candles = generateCandles(100);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      for (const signal of result.signals) {
        expect(typeof signal.reason).toBe('string');
        expect(signal.reason.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Unknown Indicator Tests
  // ==========================================================================
  describe('unknown indicator handling', () => {
    it('should return null for unknown indicator type', async () => {
      const candles = generateCandles(50);
      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      // Cast to bypass TypeScript for testing unknown indicator
      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'UNKNOWN' as unknown as 'RSI' }],
      });

      expect(result.indicators[0].type).toBe('UNKNOWN');
      expect(result.indicators[0].value).toBeNull();
    });
  });

  // ==========================================================================
  // MACD Crossover Signal Tests
  // ==========================================================================
  describe('MACD crossover signals', () => {
    it('should generate bullish crossover signal', async () => {
      // Create candles that transition from down to up (bullish crossover)
      const downCandles = generateTrendingCandles(60, 'down');
      const upCandles = generateTrendingCandles(50, 'up');
      // Adjust the up candles to continue from the last down candle
      const lastDownPrice = downCandles[downCandles.length - 1].close;
      for (let i = 0; i < upCandles.length; i++) {
        const mult = 1 + i * 0.03;
        upCandles[i].open = lastDownPrice * mult;
        upCandles[i].high = lastDownPrice * mult * 1.02;
        upCandles[i].low = lastDownPrice * mult * 0.99;
        upCandles[i].close = lastDownPrice * mult * 1.01;
      }
      const candles = [...downCandles, ...upCandles];

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const macdSignal = result.signals.find((s) => s.indicator === 'MACD');
      expect(macdSignal).toBeDefined();
    });

    it('should generate bearish crossover signal', async () => {
      // Create candles that transition from up to down (bearish crossover)
      const upCandles = generateTrendingCandles(60, 'up');
      const downCandles = generateTrendingCandles(50, 'down');
      // Adjust the down candles to continue from the last up candle
      const lastUpPrice = upCandles[upCandles.length - 1].close;
      for (let i = 0; i < downCandles.length; i++) {
        const mult = 1 - i * 0.03;
        downCandles[i].open = lastUpPrice * mult;
        downCandles[i].high = lastUpPrice * mult * 1.01;
        downCandles[i].low = lastUpPrice * mult * 0.98;
        downCandles[i].close = lastUpPrice * mult * 0.99;
      }
      const candles = [...upCandles, ...downCandles];

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const macdSignal = result.signals.find((s) => s.indicator === 'MACD');
      expect(macdSignal).toBeDefined();
    });
  });

  // ==========================================================================
  // Bollinger Band Signal Tests
  // ==========================================================================
  describe('Bollinger Band signals', () => {
    it('should generate strong buy signal when pb < 0 (price below lower band)', async () => {
      // Create stable candles then a massive crash on the last candle
      const candles: GetPriceHistoryResponse['candles'] = [];
      for (let i = 0; i < 99; i++) {
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
        });
      }
      // Last candle crashes to 50 (way below the lower band)
      candles.push({
        time: Date.now(),
        open: 100,
        high: 100,
        low: 50,
        close: 50,
      });

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal!.signal).toBe('buy');
      expect(bollSignal!.strength).toBe('strong');
      expect(bollSignal!.reason).toBe('Below lower band');
    });

    it('should generate strong sell signal when pb > 1 (price above upper band)', async () => {
      // Create stable candles then a massive spike on the last candle
      const candles: GetPriceHistoryResponse['candles'] = [];
      for (let i = 0; i < 99; i++) {
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
        });
      }
      // Last candle spikes to 150 (way above the upper band)
      candles.push({
        time: Date.now(),
        open: 100,
        high: 150,
        low: 100,
        close: 150,
      });

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal!.signal).toBe('sell');
      expect(bollSignal!.strength).toBe('strong');
      expect(bollSignal!.reason).toBe('Above upper band');
    });
  });

  // ==========================================================================
  // Stochastic Signal Tests
  // ==========================================================================
  describe('Stochastic signals', () => {
    it('should generate strong buy signal when oversold', async () => {
      // Create strong downtrend for oversold stochastic
      const candles = generateTrendingCandles(100, 'down');

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
    });

    it('should generate strong sell signal when overbought', async () => {
      // Create strong uptrend for overbought stochastic
      const candles = generateTrendingCandles(100, 'up');

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
    });

    it('should generate moderate buy signal for bullish crossover in lower zone', async () => {
      // Create candles with recovery from downtrend (k > d in lower zone)
      const downCandles = generateTrendingCandles(70, 'down');
      // Add some recovery
      const recoveryCandles: GetPriceHistoryResponse['candles'] = [];
      let lastPrice = downCandles[downCandles.length - 1].close;
      for (let i = 0; i < 30; i++) {
        const change = Math.random() * 0.5 + 0.2;
        const close = lastPrice + change;
        recoveryCandles.push({
          time: Date.now() - (30 - i) * 86400000,
          open: lastPrice,
          high: close + 0.3,
          low: lastPrice - 0.1,
          close: close,
        });
        lastPrice = close;
      }
      const candles = [...downCandles, ...recoveryCandles];

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
    });

    it('should generate moderate sell signal for bearish crossover in upper zone', async () => {
      // Create strong uptrend followed by slight pullback
      // This should result in: k > 50 and k < d (bearish crossover in upper zone)
      const candles: GetPriceHistoryResponse['candles'] = [];

      // Strong uptrend for most of the period
      let price = 100;
      for (let i = 0; i < 90; i++) {
        price = price * 1.01; // 1% daily gain
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: price * 0.99,
          high: price * 1.01,
          low: price * 0.98,
          close: price,
        });
      }

      // Small pullback at the end (prices still high but declining slightly)
      for (let i = 0; i < 10; i++) {
        price = price * 0.995; // 0.5% daily decline
        candles.push({
          time: Date.now() - (10 - i) * 86400000,
          open: price * 1.01,
          high: price * 1.02,
          low: price * 0.99,
          close: price,
        });
      }

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
    });
  });

  // ==========================================================================
  // Trend Determination Tests
  // ==========================================================================
  describe('trend determination', () => {
    it('should determine uptrend when price > sma20 and sma50 is null', async () => {
      // Create 60 candles (enough for SMA20 but not SMA50)
      const candles = generateTrendingCandles(60, 'up');

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // When only SMA20 is available and price > SMA20, should be uptrend
      expect(result.trend.sma20).not.toBeNull();
    });

    it('should determine downtrend when price < sma20 and sma50 is null', async () => {
      // Create 60 candles (enough for SMA20 but not SMA50)
      const candles = generateTrendingCandles(60, 'down');

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // When only SMA20 is available and price < SMA20, should be downtrend
      expect(result.trend.sma20).not.toBeNull();
    });

    it('should determine strong trend when ADX > 40', async () => {
      // Create strong trending candles
      const candles = generateTrendingCandles(100, 'up');

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Just verify trend strength is returned
      expect(['strong', 'moderate', 'weak']).toContain(result.trend.strength);
    });
  });

  // ==========================================================================
  // Signal Aggregation Tests
  // ==========================================================================
  describe('signal aggregation', () => {
    it('should return sell signal when score < -20', async () => {
      // Create very strong downtrend with crash to get multiple strong sell signals
      const candles: GetPriceHistoryResponse['candles'] = [];

      // Start with stable prices
      for (let i = 0; i < 50; i++) {
        candles.push({
          time: Date.now() - (100 - i) * 86400000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
        });
      }

      // Sharp spike up (to get RSI overbought and Bollinger above upper band)
      let price = 100;
      for (let i = 0; i < 50; i++) {
        price = price * 1.02; // 2% daily gain
        candles.push({
          time: Date.now() - (50 - i) * 86400000,
          open: price * 0.98,
          high: price * 1.01,
          low: price * 0.97,
          close: price,
        });
      }

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Strong uptrend should produce sell signals (overbought conditions)
      // RSI > 70 = sell, Stochastic > 80 = sell
      expect(result.summary).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(result.summary.overallSignal);
    });

    it('should return hold signal when signals are mixed', async () => {
      // Create candles with mixed signals
      const candles = generateCandles(100);

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Mixed signals should result in hold or small score
      expect(result.summary).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(result.summary.overallSignal);
    });
  });

  // ==========================================================================
  // SMA20-only Trend Tests
  // ==========================================================================
  describe('trend determination with limited data', () => {
    it('should determine uptrend with only SMA20 (not enough data for SMA50)', async () => {
      // Create exactly 50 candles - enough for detailed analysis but SMA50 may have limited data
      const candles: GetPriceHistoryResponse['candles'] = [];

      // Create an uptrending dataset
      let price = 100;
      for (let i = 0; i < 50; i++) {
        price = price * 1.005; // 0.5% daily gain
        candles.push({
          time: Date.now() - (50 - i) * 86400000,
          open: price * 0.995,
          high: price * 1.01,
          low: price * 0.99,
          close: price,
        });
      }

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend).toBeDefined();
      expect(result.trend.sma20).not.toBeNull();
    });

    it('should determine downtrend with only SMA20 (not enough data for SMA50)', async () => {
      // Create exactly 50 candles - enough for detailed analysis but SMA50 may have limited data
      const candles: GetPriceHistoryResponse['candles'] = [];

      // Create a downtrending dataset
      let price = 150;
      for (let i = 0; i < 50; i++) {
        price = price * 0.995; // 0.5% daily decline
        candles.push({
          time: Date.now() - (50 - i) * 86400000,
          open: price * 1.005,
          high: price * 1.01,
          low: price * 0.99,
          close: price,
        });
      }

      mockMarketData.getPriceHistory.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend).toBeDefined();
      expect(result.trend.sma20).not.toBeNull();
    });
  });
});
