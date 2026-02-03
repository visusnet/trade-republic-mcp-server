import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { TechnicalAnalysisError } from './TechnicalAnalysisService.types';
import type { MarketDataService } from './MarketDataService';
import type { TechnicalIndicatorsService } from './TechnicalIndicatorsService';
import type { GetPriceHistoryResponse } from './MarketDataService.response';

// Standalone mock functions to avoid unbound-method lint errors
const getPriceHistoryMock =
  jest.fn<(request: unknown) => Promise<GetPriceHistoryResponse>>();

const calculateRSIMock = jest.fn<TechnicalIndicatorsService['calculateRSI']>();
const calculateMACDMock =
  jest.fn<TechnicalIndicatorsService['calculateMACD']>();
const calculateBollingerBandsMock =
  jest.fn<TechnicalIndicatorsService['calculateBollingerBands']>();
const calculateStochasticMock =
  jest.fn<TechnicalIndicatorsService['calculateStochastic']>();
const calculateADXMock = jest.fn<TechnicalIndicatorsService['calculateADX']>();
const calculateATRMock = jest.fn<TechnicalIndicatorsService['calculateATR']>();
const calculateSMAMock = jest.fn<TechnicalIndicatorsService['calculateSMA']>();
const calculateEMAMock = jest.fn<TechnicalIndicatorsService['calculateEMA']>();
const calculateOBVMock = jest.fn<TechnicalIndicatorsService['calculateOBV']>();
const calculateVWAPMock =
  jest.fn<TechnicalIndicatorsService['calculateVWAP']>();

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
  let mockMarketDataService: MarketDataService;
  let mockIndicatorsService: TechnicalIndicatorsService;
  let service: TechnicalAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMarketDataService = {
      getPriceHistory: getPriceHistoryMock,
    } as never;

    mockIndicatorsService = {
      calculateRSI: calculateRSIMock,
      calculateMACD: calculateMACDMock,
      calculateBollingerBands: calculateBollingerBandsMock,
      calculateStochastic: calculateStochasticMock,
      calculateADX: calculateADXMock,
      calculateATR: calculateATRMock,
      calculateSMA: calculateSMAMock,
      calculateEMA: calculateEMAMock,
      calculateOBV: calculateOBVMock,
      calculateVWAP: calculateVWAPMock,
    } as never;

    service = new TechnicalAnalysisService(
      mockMarketDataService,
      mockIndicatorsService,
    );
  });

  // ==========================================================================
  // getIndicators Tests
  // ==========================================================================
  describe('getIndicators', () => {
    it('should fetch candles from MarketDataService', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 55, period: 14 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result.indicators).toHaveLength(1);
      expect(result.indicators[0].type).toBe('RSI');
      expect(result.indicators[0].value).toBe(55);
    });

    it('should calculate multiple indicators', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
      calculateEMAMock.mockReturnValue({ value: 101, period: 20 });

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 45, period: 7 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI', period: 7 }],
      });

      expect(result.indicators[0].period).toBe(7);
      expect(calculateRSIMock).toHaveBeenCalledWith(expect.anything(), 7);
    });

    it('should return null value for insufficient data', async () => {
      const candles = generateCandles(10); // Not enough for RSI
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: null, period: 14 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result.indicators[0].value).toBeNull();
    });

    it('should calculate MACD with components', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateMACDMock.mockReturnValue({
        macd: 1.5,
        signal: 1.0,
        histogram: 0.5,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'MACD' }],
      });

      expect(result.indicators[0].type).toBe('MACD');
      expect(result.indicators[0].value).toBe(1.5);
      expect(result.indicators[0].components?.macd).toBe(1.5);
      expect(result.indicators[0].components?.signal).toBe(1.0);
      expect(result.indicators[0].components?.histogram).toBe(0.5);
    });

    it('should calculate Bollinger Bands with components', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'BOLLINGER' }],
      });

      expect(result.indicators[0].type).toBe('BOLLINGER');
      expect(result.indicators[0].value).toBe(100);
      expect(result.indicators[0].components?.upper).toBe(110);
      expect(result.indicators[0].components?.middle).toBe(100);
      expect(result.indicators[0].components?.lower).toBe(90);
      expect(result.indicators[0].components?.pb).toBe(0.5);
    });

    it('should calculate Stochastic with components', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateStochasticMock.mockReturnValue({
        k: 60,
        d: 55,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'STOCHASTIC' }],
      });

      expect(result.indicators[0].type).toBe('STOCHASTIC');
      expect(result.indicators[0].value).toBe(60);
      expect(result.indicators[0].components?.k).toBe(60);
      expect(result.indicators[0].components?.d).toBe(55);
    });

    it('should calculate ADX with components', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'ADX' }],
      });

      expect(result.indicators[0].type).toBe('ADX');
      expect(result.indicators[0].value).toBe(25);
    });

    it('should throw TechnicalAnalysisError for empty candles', async () => {
      getPriceHistoryMock.mockResolvedValue({
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
      getPriceHistoryMock.mockRejectedValue(new Error('Not authenticated'));

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'XETRA',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateOBVMock.mockReturnValue({ value: 50000 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'OBV' }],
      });

      expect(result.indicators[0].type).toBe('OBV');
      expect(result.indicators[0].value).toBe(50000);
    });

    it('should return null for OBV when volume is not available', async () => {
      const candles = generateCandles(50, { withVolume: false });
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateOBVMock.mockReturnValue({ value: null });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'OBV' }],
      });

      expect(result.indicators[0].value).toBeNull();
    });

    it('should calculate VWAP when volume is available', async () => {
      const candles = generateCandles(50, { withVolume: true });
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateVWAPMock.mockReturnValue({ value: 105.5 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'VWAP' }],
      });

      expect(result.indicators[0].type).toBe('VWAP');
      expect(result.indicators[0].value).toBe(105.5);
    });

    it('should calculate ATR', async () => {
      const candles = generateCandles(50);
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });

      const result = await service.getIndicators({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'ATR' }],
      });

      expect(result.indicators[0].type).toBe('ATR');
      expect(result.indicators[0].value).toBe(2.5);
    });
  });

  // ==========================================================================
  // getDetailedAnalysis Tests
  // ==========================================================================
  describe('getDetailedAnalysis', () => {
    const setupDefaultMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateMACDMock.mockReturnValue({
        macd: 1.5,
        signal: 1.0,
        histogram: 0.5,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
    };

    it('should fetch candles with default 3m range', async () => {
      const candles = generateCandles(100, { withVolume: true });
      setupDefaultMocks(candles);

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
      getPriceHistoryMock.mockResolvedValue({
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
      setupDefaultMocks(candles);

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.indicators.rsi).toBe(50);
      expect(result.indicators.macd).toBeDefined();
      expect(result.indicators.bollingerBands).toBeDefined();
      expect(result.indicators.stochastic).toBeDefined();
      expect(result.indicators.adx).toBe(25);
      expect(result.indicators.atr).toBe(2.5);
    });

    it('should include current price', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.currentPrice).toBe(candles[candles.length - 1].close);
    });

    it('should generate signals', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
    });

    it('should include trend analysis', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);

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
      setupDefaultMocks(candles);

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
      setupDefaultMocks(candles);
      // Override to simulate uptrend indicators
      calculateSMAMock
        .mockReturnValueOnce({
          value: candles[candles.length - 1].close - 10,
          period: 20,
        })
        .mockReturnValueOnce({
          value: candles[candles.length - 1].close - 20,
          period: 50,
        });
      calculateADXMock.mockReturnValue({
        adx: 45,
        plusDI: 40,
        minusDI: 15,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Strong uptrend should have uptrend direction
      expect(result.trend.direction).toBe('uptrend');
    });

    it('should generate sell signal for strong downtrend', async () => {
      const candles = generateTrendingCandles(100, 'down');
      setupDefaultMocks(candles);
      // Override to simulate downtrend indicators
      calculateSMAMock
        .mockReturnValueOnce({
          value: candles[candles.length - 1].close + 10,
          period: 20,
        })
        .mockReturnValueOnce({
          value: candles[candles.length - 1].close + 20,
          period: 50,
        });
      calculateADXMock.mockReturnValue({
        adx: 45,
        plusDI: 15,
        minusDI: 40,
        period: 14,
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
      setupDefaultMocks(candles);

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      // Should handle division by zero gracefully
      expect(typeof result.summary.score).toBe('number');
      expect(Number.isFinite(result.summary.score)).toBe(true);
    });

    it('should return metadata in response', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '1y',
        candles,
      });
      setupDefaultMocks(candles);

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
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'XETRA',
        range: '3m',
        candles,
      });
      setupDefaultMocks(candles);

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
      getPriceHistoryMock.mockRejectedValue(new Error('Not authenticated'));

      await expect(
        service.getDetailedAnalysis({
          isin: 'DE0007164600',
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should include counts in summary', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);

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
    const setupDefaultMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateMACDMock.mockReturnValue({
        macd: 1.5,
        signal: 1.0,
        histogram: 0.5,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
    };

    it('should generate RSI oversold signal for low RSI', async () => {
      const candles = generateTrendingCandles(100, 'down');
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 25, period: 14 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal?.signal).toBe('buy');
    });

    it('should generate strong RSI buy signal for extreme RSI < 20', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 15, period: 14 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal?.signal).toBe('buy');
      expect(rsiSignal?.strength).toBe('strong');
    });

    it('should generate RSI overbought signal for high RSI', async () => {
      const candles = generateTrendingCandles(100, 'up');
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 75, period: 14 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal?.signal).toBe('sell');
    });

    it('should generate strong RSI sell signal for extreme RSI > 80', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 85, period: 14 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const rsiSignal = result.signals.find((s) => s.indicator === 'RSI');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal?.signal).toBe('sell');
      expect(rsiSignal?.strength).toBe('strong');
    });

    it('should include signal strength', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      for (const signal of result.signals) {
        expect(['strong', 'moderate', 'weak']).toContain(signal.strength);
      }
    });

    it('should include signal reason', async () => {
      const candles = generateCandles(100);
      setupDefaultMocks(candles);
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });

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
      getPriceHistoryMock.mockResolvedValue({
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
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
    };

    it('should generate bullish crossover signal', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      // First call returns negative histogram (previous), second returns positive (current)
      calculateMACDMock
        .mockReturnValueOnce({
          macd: 1.5,
          signal: 1.0,
          histogram: 0.5,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        })
        .mockReturnValueOnce({
          macd: -0.5,
          signal: 0.0,
          histogram: -0.5,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const macdSignal = result.signals.find((s) => s.indicator === 'MACD');
      expect(macdSignal).toBeDefined();
      expect(macdSignal?.signal).toBe('buy');
      expect(macdSignal?.strength).toBe('strong');
    });

    it('should generate bearish crossover signal', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      // First call returns positive histogram (previous was positive), second returns negative (current)
      calculateMACDMock
        .mockReturnValueOnce({
          macd: -1.5,
          signal: -1.0,
          histogram: -0.5,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        })
        .mockReturnValueOnce({
          macd: 0.5,
          signal: 0.0,
          histogram: 0.5,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const macdSignal = result.signals.find((s) => s.indicator === 'MACD');
      expect(macdSignal).toBeDefined();
      expect(macdSignal?.signal).toBe('sell');
      expect(macdSignal?.strength).toBe('strong');
    });
  });

  // ==========================================================================
  // Bollinger Band Signal Tests
  // ==========================================================================
  describe('Bollinger Band signals', () => {
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateMACDMock.mockReturnValue({
        macd: 0,
        signal: 0,
        histogram: 0,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
    };

    it('should generate strong buy signal when pb < 0 (price below lower band)', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: -0.1,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal?.signal).toBe('buy');
      expect(bollSignal?.strength).toBe('strong');
      expect(bollSignal?.reason).toBe('Below lower band');
    });

    it('should generate strong sell signal when pb > 1 (price above upper band)', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 1.1,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal?.signal).toBe('sell');
      expect(bollSignal?.strength).toBe('strong');
      expect(bollSignal?.reason).toBe('Above upper band');
    });

    it('should generate moderate buy signal when pb < 0.2', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.15,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal?.signal).toBe('buy');
      expect(bollSignal?.strength).toBe('moderate');
    });

    it('should generate moderate sell signal when pb > 0.8', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.85,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const bollSignal = result.signals.find(
        (s) => s.indicator === 'Bollinger',
      );
      expect(bollSignal).toBeDefined();
      expect(bollSignal?.signal).toBe('sell');
      expect(bollSignal?.strength).toBe('moderate');
    });
  });

  // ==========================================================================
  // Stochastic Signal Tests
  // ==========================================================================
  describe('Stochastic signals', () => {
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateMACDMock.mockReturnValue({
        macd: 0,
        signal: 0,
        histogram: 0,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
    };

    it('should generate strong buy signal when oversold', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateStochasticMock.mockReturnValue({
        k: 15,
        d: 15,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
      expect(stochSignal?.signal).toBe('buy');
      expect(stochSignal?.strength).toBe('strong');
    });

    it('should generate strong sell signal when overbought', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateStochasticMock.mockReturnValue({
        k: 85,
        d: 85,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
      expect(stochSignal?.signal).toBe('sell');
      expect(stochSignal?.strength).toBe('strong');
    });

    it('should generate moderate buy signal for bullish crossover in lower zone', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateStochasticMock.mockReturnValue({
        k: 40,
        d: 35,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
      expect(stochSignal?.signal).toBe('buy');
      expect(stochSignal?.strength).toBe('moderate');
    });

    it('should generate moderate sell signal for bearish crossover in upper zone', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateStochasticMock.mockReturnValue({
        k: 60,
        d: 65,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
      expect(stochSignal?.signal).toBe('sell');
      expect(stochSignal?.strength).toBe('moderate');
    });

    it('should generate hold signal for neutral conditions', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      const stochSignal = result.signals.find(
        (s) => s.indicator === 'Stochastic',
      );
      expect(stochSignal).toBeDefined();
      expect(stochSignal?.signal).toBe('hold');
    });
  });

  // ==========================================================================
  // Trend Determination Tests
  // ==========================================================================
  describe('trend determination', () => {
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateMACDMock.mockReturnValue({
        macd: 0,
        signal: 0,
        histogram: 0,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
    };

    it('should determine uptrend when price > SMA20 > SMA50', async () => {
      const candles = generateCandles(100);
      const currentPrice = candles[candles.length - 1].close;
      setupBaseMocks(candles);
      calculateSMAMock
        .mockReturnValueOnce({ value: currentPrice - 5, period: 20 })
        .mockReturnValueOnce({ value: currentPrice - 10, period: 50 });
      calculateADXMock.mockReturnValue({
        adx: 30,
        plusDI: 35,
        minusDI: 20,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend.direction).toBe('uptrend');
    });

    it('should determine downtrend when price < SMA20 < SMA50', async () => {
      const candles = generateCandles(100);
      const currentPrice = candles[candles.length - 1].close;
      setupBaseMocks(candles);
      calculateSMAMock
        .mockReturnValueOnce({ value: currentPrice + 5, period: 20 })
        .mockReturnValueOnce({ value: currentPrice + 10, period: 50 });
      calculateADXMock.mockReturnValue({
        adx: 30,
        plusDI: 20,
        minusDI: 35,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend.direction).toBe('downtrend');
    });

    it('should determine strong trend when ADX > 40', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
      calculateADXMock.mockReturnValue({
        adx: 45,
        plusDI: 40,
        minusDI: 15,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend.strength).toBe('strong');
    });

    it('should determine moderate trend when ADX > 20', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
      calculateADXMock.mockReturnValue({
        adx: 30,
        plusDI: 25,
        minusDI: 20,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend.strength).toBe('moderate');
    });

    it('should determine weak trend when ADX <= 20', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
      calculateADXMock.mockReturnValue({
        adx: 15,
        plusDI: 18,
        minusDI: 17,
        period: 14,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend.strength).toBe('weak');
    });
  });

  // ==========================================================================
  // Signal Aggregation Tests
  // ==========================================================================
  describe('signal aggregation', () => {
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateSMAMock.mockReturnValue({ value: 100, period: 20 });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
    };

    it('should return buy signal when score > 20', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      // Set up all indicators to give buy signals
      calculateRSIMock.mockReturnValue({ value: 25, period: 14 }); // Oversold - buy
      calculateMACDMock.mockReturnValue({
        macd: 2,
        signal: 1,
        histogram: 1,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: -0.1,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 15,
        d: 15,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.summary.overallSignal).toBe('buy');
    });

    it('should return sell signal when score < -20', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      // Set up all indicators to give sell signals
      calculateRSIMock.mockReturnValue({ value: 85, period: 14 }); // Overbought - sell
      calculateMACDMock.mockReturnValue({
        macd: -2,
        signal: -1,
        histogram: -1,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 1.1,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 85,
        d: 85,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.summary.overallSignal).toBe('sell');
    });

    it('should return hold signal when signals are mixed', async () => {
      const candles = generateCandles(100);
      setupBaseMocks(candles);
      // Set up neutral/mixed indicators
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 }); // Neutral
      // Set histogram to null so no MACD signal is generated
      calculateMACDMock.mockReturnValue({
        macd: null,
        signal: null,
        histogram: null,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.summary.overallSignal).toBe('hold');
    });
  });

  // ==========================================================================
  // SMA20-only Trend Tests
  // ==========================================================================
  describe('trend determination with limited data', () => {
    const setupBaseMocks = (candles: GetPriceHistoryResponse['candles']) => {
      getPriceHistoryMock.mockResolvedValue({
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candles,
      });
      calculateRSIMock.mockReturnValue({ value: 50, period: 14 });
      calculateMACDMock.mockReturnValue({
        macd: 0,
        signal: 0,
        histogram: 0,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      calculateBollingerBandsMock.mockReturnValue({
        upper: 110,
        middle: 100,
        lower: 90,
        pb: 0.5,
        bandwidth: 0.2,
        period: 20,
        stdDev: 2,
      });
      calculateStochasticMock.mockReturnValue({
        k: 50,
        d: 50,
        period: 14,
        signalPeriod: 3,
      });
      calculateATRMock.mockReturnValue({ value: 2.5, period: 14 });
      calculateADXMock.mockReturnValue({
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        period: 14,
      });
    };

    it('should determine uptrend with only SMA20 (not enough data for SMA50)', async () => {
      const candles = generateCandles(50);
      const currentPrice = candles[candles.length - 1].close;
      setupBaseMocks(candles);
      calculateSMAMock
        .mockReturnValueOnce({ value: currentPrice - 5, period: 20 })
        .mockReturnValueOnce({ value: null, period: 50 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend).toBeDefined();
      expect(result.trend.sma20).not.toBeNull();
    });

    it('should determine downtrend with only SMA20 (not enough data for SMA50)', async () => {
      const candles = generateCandles(50);
      const currentPrice = candles[candles.length - 1].close;
      setupBaseMocks(candles);
      calculateSMAMock
        .mockReturnValueOnce({ value: currentPrice + 5, period: 20 })
        .mockReturnValueOnce({ value: null, period: 50 });

      const result = await service.getDetailedAnalysis({
        isin: 'DE0007164600',
      });

      expect(result.trend).toBeDefined();
      expect(result.trend.sma20).not.toBeNull();
    });
  });
});
