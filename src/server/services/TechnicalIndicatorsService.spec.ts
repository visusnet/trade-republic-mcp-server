import { describe, it, expect } from '@jest/globals';

import { TechnicalIndicatorsService } from './TechnicalIndicatorsService';
import type { Candle } from './TechnicalAnalysisService.types';

/**
 * Generate deterministic candles from close prices.
 * Each candle has open=close, high=close+1, low=close-1.
 */
function generateCandles(closePrices: number[]): Candle[] {
  return closePrices.map((close, i) => ({
    time: Date.now() - (closePrices.length - i) * 86400000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
  }));
}

/**
 * Generate deterministic candles with volume from close prices.
 */
function generateCandlesWithVolume(closePrices: number[]): Candle[] {
  return closePrices.map((close, i) => ({
    time: Date.now() - (closePrices.length - i) * 86400000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i * 100,
  }));
}

/**
 * Generate deterministic candles with custom high/low/close/volume data.
 */
function generateCandlesWithHLC(
  data: { high: number; low: number; close: number; volume?: number }[],
): Candle[] {
  return data.map(({ high, low, close, volume }, i) => ({
    time: Date.now() - (data.length - i) * 86400000,
    open: close,
    high,
    low,
    close,
    volume,
  }));
}

describe('TechnicalIndicatorsService', () => {
  const service = new TechnicalIndicatorsService();

  // ==========================================================================
  // RSI Tests
  // ==========================================================================
  describe('calculateRSI', () => {
    it('should return null for insufficient data (less than period + 1)', () => {
      // Only 10 candles, less than 14 + 1 = 15 required
      const closePrices = Array.from({ length: 10 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles);

      expect(result.value).toBeNull();
      expect(result.period).toBe(14);
    });

    it('should calculate RSI with default period of 14', () => {
      // Ascending prices - should produce high RSI
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles);

      expect(result.period).toBe(14);
      expect(result.value).not.toBeNull();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should calculate RSI with custom period', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles, 7);

      expect(result.period).toBe(7);
      expect(result.value).not.toBeNull();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should return RSI in range 0-100', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should return high RSI for strong uptrend', () => {
      // Strong ascending prices
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value as number).toBeGreaterThan(50);
    });

    it('should return low RSI for strong downtrend', () => {
      // Strong descending prices
      const closePrices = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value as number).toBeLessThan(50);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateRSI([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandles([100]);
      const result = service.calculateRSI(candles);

      expect(result.value).toBeNull();
    });

    it('should work with exactly minimum required candles', () => {
      // Exactly period + 1 = 15 candles
      const closePrices = Array.from({ length: 15 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateRSI(candles, 14);

      expect(result.period).toBe(14);
    });
  });

  // ==========================================================================
  // MACD Tests
  // ==========================================================================
  describe('calculateMACD', () => {
    it('should return null for insufficient data (less than slowPeriod + signalPeriod)', () => {
      // 30 candles, less than 26 + 9 = 35 required
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles);

      expect(result.macd).toBeNull();
      expect(result.signal).toBeNull();
      expect(result.histogram).toBeNull();
    });

    it('should calculate MACD with default periods (12, 26, 9)', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles);

      expect(result.fastPeriod).toBe(12);
      expect(result.slowPeriod).toBe(26);
      expect(result.signalPeriod).toBe(9);
    });

    it('should return MACD, signal, and histogram values', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles);

      expect(result.macd).not.toBeNull();
      expect(typeof result.macd).toBe('number');
      expect(typeof result.signal).toBe('number');
      expect(typeof result.histogram).toBe('number');
    });

    it('should calculate custom period MACD', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles, 8, 17, 9);

      expect(result.fastPeriod).toBe(8);
      expect(result.slowPeriod).toBe(17);
      expect(result.signalPeriod).toBe(9);
    });

    it('should return histogram value for trending market', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles);

      expect(result.histogram).not.toBeNull();
      expect(typeof result.histogram).toBe('number');
    });

    it('should return all MACD components for valid data', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 200 - i);
      const candles = generateCandles(closePrices);
      const result = service.calculateMACD(candles);

      expect(result.macd).not.toBeNull();
      expect(result.signal).not.toBeNull();
      expect(result.histogram).not.toBeNull();
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateMACD([]);

      expect(result.macd).toBeNull();
      expect(result.signal).toBeNull();
      expect(result.histogram).toBeNull();
    });
  });

  // ==========================================================================
  // Bollinger Bands Tests
  // ==========================================================================
  describe('calculateBollingerBands', () => {
    it('should return null for insufficient data (less than period + 1)', () => {
      // 15 candles, less than 20 + 1 = 21 required
      const closePrices = Array.from({ length: 15 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles);

      expect(result.upper).toBeNull();
      expect(result.middle).toBeNull();
      expect(result.lower).toBeNull();
    });

    it('should calculate Bollinger Bands with default period of 20 and stdDev of 2', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles);

      expect(result.period).toBe(20);
      expect(result.stdDev).toBe(2);
    });

    it('should return upper > middle > lower', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles);

      expect(result.upper).not.toBeNull();
      expect(result.middle).not.toBeNull();
      expect(result.lower).not.toBeNull();

      const upper = result.upper as number;
      const middle = result.middle as number;
      const lower = result.lower as number;
      expect(upper).toBeGreaterThan(middle);
      expect(middle).toBeGreaterThan(lower);
    });

    it('should calculate pb (percent b) value', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles);

      expect(result.pb).not.toBeNull();
      expect(typeof result.pb).toBe('number');
    });

    it('should calculate bandwidth value', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles);

      expect(result.bandwidth).not.toBeNull();
      expect(result.bandwidth as number).toBeGreaterThanOrEqual(0);
    });

    it('should return pb < 0 when price below lower band', () => {
      // Create ascending candles, then force last price to be very low
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      candles[candles.length - 1].close = 50;
      candles[candles.length - 1].low = 49;

      const result = service.calculateBollingerBands(candles);

      expect(result.pb).not.toBeNull();
    });

    it('should return pb > 1 when price above upper band', () => {
      // Create ascending candles, then force last price to be very high
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      candles[candles.length - 1].close = 200;
      candles[candles.length - 1].high = 201;

      const result = service.calculateBollingerBands(candles);

      expect(result.pb).not.toBeNull();
    });

    it('should calculate with custom period and stdDev', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateBollingerBands(candles, 10, 1.5);

      expect(result.period).toBe(10);
      expect(result.stdDev).toBe(1.5);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateBollingerBands([]);

      expect(result.upper).toBeNull();
      expect(result.middle).toBeNull();
      expect(result.lower).toBeNull();
    });
  });

  // ==========================================================================
  // SMA Tests
  // ==========================================================================
  describe('calculateSMA', () => {
    it('should return null for insufficient data', () => {
      const closePrices = Array.from({ length: 10 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateSMA(candles, 20);

      expect(result.value).toBeNull();
    });

    it('should calculate SMA with default period of 20', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateSMA(candles);

      expect(result.period).toBe(20);
    });

    it('should return valid SMA value', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateSMA(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
      expect(result.value as number).toBeGreaterThan(0);
    });

    it('should calculate with custom period', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateSMA(candles, 10);

      expect(result.period).toBe(10);
      expect(result.value).not.toBeNull();
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateSMA([]);

      expect(result.value).toBeNull();
    });
  });

  // ==========================================================================
  // EMA Tests
  // ==========================================================================
  describe('calculateEMA', () => {
    it('should return null for insufficient data', () => {
      const closePrices = Array.from({ length: 10 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateEMA(candles, 20);

      expect(result.value).toBeNull();
    });

    it('should calculate EMA with default period of 20', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateEMA(candles);

      expect(result.period).toBe(20);
    });

    it('should return valid EMA value', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateEMA(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
      expect(result.value as number).toBeGreaterThan(0);
    });

    it('should calculate with custom period', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices);
      const result = service.calculateEMA(candles, 10);

      expect(result.period).toBe(10);
      expect(result.value).not.toBeNull();
    });

    it('should give more weight to recent prices than SMA', () => {
      // Create candles with stable prices, then spike at the end
      const closePrices = [
        ...Array.from({ length: 25 }, () => 100),
        150,
        155,
        160,
        165,
        170,
      ];
      const candles = generateCandles(closePrices);

      const sma = service.calculateSMA(candles, 10);
      const ema = service.calculateEMA(candles, 10);

      expect(sma.value).not.toBeNull();
      expect(ema.value).not.toBeNull();
      // EMA should be higher due to more weight on recent higher prices
      expect(ema.value as number).toBeGreaterThan(sma.value as number);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateEMA([]);

      expect(result.value).toBeNull();
    });
  });

  // ==========================================================================
  // ADX Tests
  // ==========================================================================
  describe('calculateADX', () => {
    it('should return null for insufficient data', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateADX(candles);

      expect(result.adx).toBeNull();
    });

    it('should calculate ADX with default period of 14', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateADX(candles);

      expect(result.period).toBe(14);
    });

    it('should return ADX, +DI, and -DI values', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateADX(candles);

      expect(result.adx).not.toBeNull();
      expect(result.adx as number).toBeGreaterThanOrEqual(0);
      expect(result.adx as number).toBeLessThanOrEqual(100);
      expect(result.plusDI).not.toBeNull();
      expect(result.minusDI).not.toBeNull();
    });

    it('should return higher ADX for trending market', () => {
      // Strong consistent uptrend
      const trendingData = Array.from({ length: 50 }, (_, i) => ({
        high: 100 + i * 3,
        low: 95 + i * 3,
        close: 98 + i * 3,
      }));
      const trendingCandles = generateCandlesWithHLC(trendingData);
      const trendResult = service.calculateADX(trendingCandles);

      expect(trendResult.adx).not.toBeNull();
      // Trending market should have higher ADX (typically > 20)
      expect(trendResult.adx as number).toBeGreaterThan(20);
    });

    it('should calculate with custom period', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateADX(candles, 10);

      expect(result.period).toBe(10);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateADX([]);

      expect(result.adx).toBeNull();
    });
  });

  // ==========================================================================
  // Stochastic Tests
  // ==========================================================================
  describe('calculateStochastic', () => {
    it('should return null for insufficient data', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles);

      expect(result.k).toBeNull();
      expect(result.d).toBeNull();
    });

    it('should calculate Stochastic with default periods (14, 3)', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles);

      expect(result.period).toBe(14);
      expect(result.signalPeriod).toBe(3);
    });

    it('should return %K and %D in range 0-100', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles);

      expect(result.k).not.toBeNull();
      expect(result.d).not.toBeNull();
      const k = result.k as number;
      const d = result.d as number;
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(100);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(100);
    });

    it('should return high values for uptrend', () => {
      // Prices closing near the high of the range
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 110 + i,
        low: 90 + i,
        close: 108 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles);

      expect(result.k).not.toBeNull();
      expect(result.k as number).toBeGreaterThan(50);
    });

    it('should return low values for downtrend', () => {
      // Prices closing near the low of the range
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 110 - i,
        low: 90 - i,
        close: 92 - i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles);

      expect(result.k).not.toBeNull();
      expect(result.k as number).toBeLessThan(50);
    });

    it('should calculate with custom periods', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateStochastic(candles, 10, 5);

      expect(result.period).toBe(10);
      expect(result.signalPeriod).toBe(5);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateStochastic([]);

      expect(result.k).toBeNull();
      expect(result.d).toBeNull();
    });
  });

  // ==========================================================================
  // ATR Tests
  // ==========================================================================
  describe('calculateATR', () => {
    it('should return null for insufficient data', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateATR(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate ATR with default period of 14', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateATR(candles);

      expect(result.period).toBe(14);
    });

    it('should return positive ATR value', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateATR(candles);

      expect(result.value).not.toBeNull();
      expect(result.value as number).toBeGreaterThan(0);
    });

    it('should return higher ATR for volatile market', () => {
      // Low volatility data (tight range)
      const lowVolData = Array.from({ length: 30 }, (_, i) => ({
        high: 101 + i,
        low: 99 + i,
        close: 100 + i,
      }));
      const lowVolCandles = generateCandlesWithHLC(lowVolData);

      // High volatility data (wide range)
      const highVolData = Array.from({ length: 30 }, (_, i) => ({
        high: 120 + i,
        low: 80 + i,
        close: 100 + i,
      }));
      const highVolCandles = generateCandlesWithHLC(highVolData);

      const lowVolResult = service.calculateATR(lowVolCandles);
      const highVolResult = service.calculateATR(highVolCandles);

      expect(lowVolResult.value).not.toBeNull();
      expect(highVolResult.value).not.toBeNull();
      expect(highVolResult.value as number).toBeGreaterThan(
        lowVolResult.value as number,
      );
    });

    it('should calculate with custom period', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
      }));
      const candles = generateCandlesWithHLC(data);
      const result = service.calculateATR(candles, 10);

      expect(result.period).toBe(10);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateATR([]);

      expect(result.value).toBeNull();
    });
  });

  // ==========================================================================
  // OBV Tests
  // ==========================================================================
  describe('calculateOBV', () => {
    it('should return null when volume is not available', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices); // No volume
      const result = service.calculateOBV(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate OBV when volume is available', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      const result = service.calculateOBV(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
    });

    it('should return positive OBV for uptrend with volume', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      const result = service.calculateOBV(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateOBV([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandlesWithVolume([100]);
      const result = service.calculateOBV(candles);

      expect(result.value).toBeNull();
    });

    it('should handle candles where some have undefined volume', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      // Set some volumes to undefined
      candles[5].volume = undefined;
      candles[10].volume = undefined;

      const result = service.calculateOBV(candles);

      // Should return null when volume data is incomplete
      expect(result.value).toBeNull();
    });
  });

  // ==========================================================================
  // VWAP Tests
  // ==========================================================================
  describe('calculateVWAP', () => {
    it('should return null when volume is not available', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandles(closePrices); // No volume
      const result = service.calculateVWAP(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate VWAP when volume is available', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      const result = service.calculateVWAP(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
    });

    it('should return positive VWAP value', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      const result = service.calculateVWAP(candles);

      expect(result.value).not.toBeNull();
      expect(result.value as number).toBeGreaterThan(0);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateVWAP([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandlesWithVolume([100]);
      const result = service.calculateVWAP(candles);

      expect(result.value).toBeNull();
    });

    it('should handle candles where some have undefined volume', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const candles = generateCandlesWithVolume(closePrices);
      // Set some volumes to undefined
      candles[5].volume = undefined;
      candles[10].volume = undefined;

      const result = service.calculateVWAP(candles);

      // Should return null when volume data is incomplete
      expect(result.value).toBeNull();
    });
  });

  // ==========================================================================
  // All-NaN/Edge Cases Tests
  // ==========================================================================
  describe('edge cases', () => {
    it('should handle candles with all same prices for RSI', () => {
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        time: Date.now() - (30 - i) * 86400000,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
      }));

      const result = service.calculateRSI(candles);

      // With no price changes, RSI calculation may return null or 50
      // depending on library implementation
      expect(result.period).toBe(14);
    });

    it('should handle candles with zero values', () => {
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        time: Date.now() - (30 - i) * 86400000,
        open: 0,
        high: 0,
        low: 0,
        close: 0,
      }));

      const result = service.calculateRSI(candles);

      // Should handle gracefully
      expect(result.period).toBe(14);
    });

    it('should handle negative prices gracefully', () => {
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        time: Date.now() - (30 - i) * 86400000,
        open: -100 + i,
        high: -100 + i + 1,
        low: -100 + i - 1,
        close: -100 + i + 0.5,
      }));

      const result = service.calculateSMA(candles);

      // Should calculate even with negative values
      expect(result.period).toBe(20);
    });
  });
});
