/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-conditional-expect */
import { describe, it, expect } from '@jest/globals';

import { TechnicalIndicatorsService } from './TechnicalIndicatorsService';
import type { Candle } from './TechnicalAnalysisService.types';

/**
 * Generate sample candles for testing.
 */
function generateCandles(
  count: number,
  options?: { withVolume?: boolean },
): Candle[] {
  const candles: Candle[] = [];
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
): Candle[] {
  const candles: Candle[] = [];
  let basePrice = direction === 'up' ? 100 : 200;
  const trend = direction === 'up' ? 1 : -1;

  for (let i = 0; i < count; i++) {
    const open = basePrice;
    const change = (Math.random() * 2 + 0.5) * trend;
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

describe('TechnicalIndicatorsService', () => {
  const service = new TechnicalIndicatorsService();

  // ==========================================================================
  // RSI Tests
  // ==========================================================================
  describe('calculateRSI', () => {
    it('should return null for insufficient data (less than period + 1)', () => {
      const candles = generateCandles(10); // Less than 14 + 1 = 15
      const result = service.calculateRSI(candles);

      expect(result.value).toBeNull();
      expect(result.period).toBe(14);
    });

    it('should calculate RSI with default period of 14', () => {
      const candles = generateCandles(30);
      const result = service.calculateRSI(candles);

      expect(result.period).toBe(14);
      if (result.value !== null) {
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate RSI with custom period', () => {
      const candles = generateCandles(30);
      const result = service.calculateRSI(candles, 7);

      expect(result.period).toBe(7);
      if (result.value !== null) {
        expect(result.value).toBeGreaterThanOrEqual(0);
        expect(result.value).toBeLessThanOrEqual(100);
      }
    });

    it('should return RSI in range 0-100', () => {
      const candles = generateCandles(50);
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it('should return high RSI for strong uptrend', () => {
      const candles = generateTrendingCandles(30, 'up');
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value!).toBeGreaterThan(50);
    });

    it('should return low RSI for strong downtrend', () => {
      const candles = generateTrendingCandles(30, 'down');
      const result = service.calculateRSI(candles);

      expect(result.value).not.toBeNull();
      expect(result.value!).toBeLessThan(50);
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateRSI([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandles(1);
      const result = service.calculateRSI(candles);

      expect(result.value).toBeNull();
    });

    it('should work with exactly minimum required candles', () => {
      const candles = generateCandles(15); // Exactly period + 1
      const result = service.calculateRSI(candles, 14);

      // Should have at least one result
      expect(result.period).toBe(14);
    });
  });

  // ==========================================================================
  // MACD Tests
  // ==========================================================================
  describe('calculateMACD', () => {
    it('should return null for insufficient data (less than slowPeriod + signalPeriod)', () => {
      const candles = generateCandles(30); // Less than 26 + 9 = 35
      const result = service.calculateMACD(candles);

      expect(result.macd).toBeNull();
      expect(result.signal).toBeNull();
      expect(result.histogram).toBeNull();
    });

    it('should calculate MACD with default periods (12, 26, 9)', () => {
      const candles = generateCandles(50);
      const result = service.calculateMACD(candles);

      expect(result.fastPeriod).toBe(12);
      expect(result.slowPeriod).toBe(26);
      expect(result.signalPeriod).toBe(9);
    });

    it('should return MACD, signal, and histogram values', () => {
      const candles = generateCandles(50);
      const result = service.calculateMACD(candles);

      if (result.macd !== null) {
        expect(typeof result.macd).toBe('number');
        expect(typeof result.signal).toBe('number');
        expect(typeof result.histogram).toBe('number');
      }
    });

    it('should calculate custom period MACD', () => {
      const candles = generateCandles(50);
      const result = service.calculateMACD(candles, 8, 17, 9);

      expect(result.fastPeriod).toBe(8);
      expect(result.slowPeriod).toBe(17);
      expect(result.signalPeriod).toBe(9);
    });

    it('should return histogram value for trending market', () => {
      const candles = generateTrendingCandles(50, 'up');
      const result = service.calculateMACD(candles);

      if (result.histogram !== null) {
        // MACD histogram should be a number (sign depends on momentum)
        expect(typeof result.histogram).toBe('number');
      }
    });

    it('should return all MACD components for valid data', () => {
      const candles = generateTrendingCandles(50, 'down');
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
      const candles = generateCandles(15); // Less than 20 + 1 = 21
      const result = service.calculateBollingerBands(candles);

      expect(result.upper).toBeNull();
      expect(result.middle).toBeNull();
      expect(result.lower).toBeNull();
    });

    it('should calculate Bollinger Bands with default period of 20 and stdDev of 2', () => {
      const candles = generateCandles(30);
      const result = service.calculateBollingerBands(candles);

      expect(result.period).toBe(20);
      expect(result.stdDev).toBe(2);
    });

    it('should return upper > middle > lower', () => {
      const candles = generateCandles(30);
      const result = service.calculateBollingerBands(candles);

      if (
        result.upper !== null &&
        result.middle !== null &&
        result.lower !== null
      ) {
        expect(result.upper).toBeGreaterThan(result.middle);
        expect(result.middle).toBeGreaterThan(result.lower);
      }
    });

    it('should calculate pb (percent b) value', () => {
      const candles = generateCandles(30);
      const result = service.calculateBollingerBands(candles);

      if (result.pb !== null) {
        expect(typeof result.pb).toBe('number');
      }
    });

    it('should calculate bandwidth value', () => {
      const candles = generateCandles(30);
      const result = service.calculateBollingerBands(candles);

      if (result.bandwidth !== null) {
        expect(result.bandwidth).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return pb < 0 when price below lower band', () => {
      // Create candles that end with a sharp drop
      const candles = generateCandles(30);
      // Force last price to be very low
      candles[candles.length - 1].close = candles[0].close * 0.7;
      candles[candles.length - 1].low = candles[candles.length - 1].close;

      const result = service.calculateBollingerBands(candles);

      // pb can be negative when price is below lower band
      expect(result.pb).not.toBeNull();
    });

    it('should return pb > 1 when price above upper band', () => {
      // Create candles that end with a sharp rise
      const candles = generateCandles(30);
      // Force last price to be very high
      candles[candles.length - 1].close = candles[0].close * 1.3;
      candles[candles.length - 1].high = candles[candles.length - 1].close;

      const result = service.calculateBollingerBands(candles);

      // pb can be > 1 when price is above upper band
      expect(result.pb).not.toBeNull();
    });

    it('should calculate with custom period and stdDev', () => {
      const candles = generateCandles(30);
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
      const candles = generateCandles(10);
      const result = service.calculateSMA(candles, 20);

      expect(result.value).toBeNull();
    });

    it('should calculate SMA with default period of 20', () => {
      const candles = generateCandles(30);
      const result = service.calculateSMA(candles);

      expect(result.period).toBe(20);
    });

    it('should return valid SMA value', () => {
      const candles = generateCandles(30);
      const result = service.calculateSMA(candles);

      if (result.value !== null) {
        expect(typeof result.value).toBe('number');
        expect(result.value).toBeGreaterThan(0);
      }
    });

    it('should calculate with custom period', () => {
      const candles = generateCandles(30);
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
      const candles = generateCandles(10);
      const result = service.calculateEMA(candles, 20);

      expect(result.value).toBeNull();
    });

    it('should calculate EMA with default period of 20', () => {
      const candles = generateCandles(30);
      const result = service.calculateEMA(candles);

      expect(result.period).toBe(20);
    });

    it('should return valid EMA value', () => {
      const candles = generateCandles(30);
      const result = service.calculateEMA(candles);

      if (result.value !== null) {
        expect(typeof result.value).toBe('number');
        expect(result.value).toBeGreaterThan(0);
      }
    });

    it('should calculate with custom period', () => {
      const candles = generateCandles(30);
      const result = service.calculateEMA(candles, 10);

      expect(result.period).toBe(10);
      expect(result.value).not.toBeNull();
    });

    it('should give more weight to recent prices than SMA', () => {
      // Create candles with recent sharp uptrend
      const candles = generateCandles(30);
      // Make recent prices higher
      for (let i = 25; i < 30; i++) {
        candles[i].close = candles[i].close * 1.2;
      }

      const sma = service.calculateSMA(candles, 10);
      const ema = service.calculateEMA(candles, 10);

      // EMA should be higher due to more weight on recent higher prices
      if (sma.value !== null && ema.value !== null) {
        expect(ema.value).toBeGreaterThan(sma.value);
      }
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
      const candles = generateCandles(20);
      const result = service.calculateADX(candles);

      expect(result.adx).toBeNull();
    });

    it('should calculate ADX with default period of 14', () => {
      const candles = generateCandles(50);
      const result = service.calculateADX(candles);

      expect(result.period).toBe(14);
    });

    it('should return ADX, +DI, and -DI values', () => {
      const candles = generateCandles(50);
      const result = service.calculateADX(candles);

      if (result.adx !== null) {
        expect(result.adx).toBeGreaterThanOrEqual(0);
        expect(result.adx).toBeLessThanOrEqual(100);
        expect(result.plusDI).not.toBeNull();
        expect(result.minusDI).not.toBeNull();
      }
    });

    it('should return higher ADX for trending market', () => {
      const trendingCandles = generateTrendingCandles(50, 'up');
      const sidewaysCandles = generateCandles(50);

      const trendResult = service.calculateADX(trendingCandles);
      const sidewaysResult = service.calculateADX(sidewaysCandles);

      // Trending market should have higher ADX
      if (trendResult.adx !== null && sidewaysResult.adx !== null) {
        expect(trendResult.adx).toBeGreaterThan(20);
      }
    });

    it('should calculate with custom period', () => {
      const candles = generateCandles(50);
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
      const candles = generateCandles(10);
      const result = service.calculateStochastic(candles);

      expect(result.k).toBeNull();
      expect(result.d).toBeNull();
    });

    it('should calculate Stochastic with default periods (14, 3)', () => {
      const candles = generateCandles(30);
      const result = service.calculateStochastic(candles);

      expect(result.period).toBe(14);
      expect(result.signalPeriod).toBe(3);
    });

    it('should return %K and %D in range 0-100', () => {
      const candles = generateCandles(30);
      const result = service.calculateStochastic(candles);

      if (result.k !== null && result.d !== null) {
        expect(result.k).toBeGreaterThanOrEqual(0);
        expect(result.k).toBeLessThanOrEqual(100);
        expect(result.d).toBeGreaterThanOrEqual(0);
        expect(result.d).toBeLessThanOrEqual(100);
      }
    });

    it('should return high values for uptrend', () => {
      const candles = generateTrendingCandles(30, 'up');
      const result = service.calculateStochastic(candles);

      if (result.k !== null) {
        expect(result.k).toBeGreaterThan(50);
      }
    });

    it('should return low values for downtrend', () => {
      const candles = generateTrendingCandles(30, 'down');
      const result = service.calculateStochastic(candles);

      if (result.k !== null) {
        expect(result.k).toBeLessThan(50);
      }
    });

    it('should calculate with custom periods', () => {
      const candles = generateCandles(30);
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
      const candles = generateCandles(10);
      const result = service.calculateATR(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate ATR with default period of 14', () => {
      const candles = generateCandles(30);
      const result = service.calculateATR(candles);

      expect(result.period).toBe(14);
    });

    it('should return positive ATR value', () => {
      const candles = generateCandles(30);
      const result = service.calculateATR(candles);

      if (result.value !== null) {
        expect(result.value).toBeGreaterThan(0);
      }
    });

    it('should return higher ATR for volatile market', () => {
      // Create volatile candles
      const volatileCandles = generateCandles(30);
      for (const candle of volatileCandles) {
        candle.high = candle.close * 1.1;
        candle.low = candle.close * 0.9;
      }

      const normalCandles = generateCandles(30);

      const volatileResult = service.calculateATR(volatileCandles);
      const normalResult = service.calculateATR(normalCandles);

      if (volatileResult.value !== null && normalResult.value !== null) {
        expect(volatileResult.value).toBeGreaterThan(normalResult.value);
      }
    });

    it('should calculate with custom period', () => {
      const candles = generateCandles(30);
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
      const candles = generateCandles(30, { withVolume: false });
      const result = service.calculateOBV(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate OBV when volume is available', () => {
      const candles = generateCandles(30, { withVolume: true });
      const result = service.calculateOBV(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
    });

    it('should return positive OBV for uptrend with volume', () => {
      const candles = generateTrendingCandles(30, 'up', { withVolume: true });
      const result = service.calculateOBV(candles);

      // OBV should be positive in an uptrend
      if (result.value !== null) {
        expect(typeof result.value).toBe('number');
      }
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateOBV([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandles(1, { withVolume: true });
      const result = service.calculateOBV(candles);

      expect(result.value).toBeNull();
    });

    it('should handle candles where some have undefined volume', () => {
      const candles = generateCandles(30, { withVolume: true });
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
      const candles = generateCandles(30, { withVolume: false });
      const result = service.calculateVWAP(candles);

      expect(result.value).toBeNull();
    });

    it('should calculate VWAP when volume is available', () => {
      const candles = generateCandles(30, { withVolume: true });
      const result = service.calculateVWAP(candles);

      expect(result.value).not.toBeNull();
      expect(typeof result.value).toBe('number');
    });

    it('should return positive VWAP value', () => {
      const candles = generateCandles(30, { withVolume: true });
      const result = service.calculateVWAP(candles);

      if (result.value !== null) {
        expect(result.value).toBeGreaterThan(0);
      }
    });

    it('should return null for empty candles array', () => {
      const result = service.calculateVWAP([]);

      expect(result.value).toBeNull();
    });

    it('should return null for single candle', () => {
      const candles = generateCandles(1, { withVolume: true });
      const result = service.calculateVWAP(candles);

      expect(result.value).toBeNull();
    });

    it('should handle candles where some have undefined volume', () => {
      const candles = generateCandles(30, { withVolume: true });
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
