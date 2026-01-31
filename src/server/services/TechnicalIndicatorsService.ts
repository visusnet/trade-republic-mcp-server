/**
 * Technical Indicators Service
 *
 * Pure, stateless indicator calculations from candle arrays.
 * This is an internal service, not exported from the services module.
 */

import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ADX,
  Stochastic,
  ATR,
  OBV,
  VWAP,
} from '@thuantan2060/technicalindicators';

import type {
  Candle,
  RSIResult,
  MACDResult,
  BollingerBandsResult,
  MovingAverageResult,
  ADXResult,
  StochasticResult,
  ATRResult,
  OBVResult,
  VWAPResult,
} from './TechnicalAnalysisService.types';

const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_MACD_FAST_PERIOD = 12;
const DEFAULT_MACD_SLOW_PERIOD = 26;
const DEFAULT_MACD_SIGNAL_PERIOD = 9;
const DEFAULT_BOLLINGER_PERIOD = 20;
const DEFAULT_BOLLINGER_STDDEV = 2;
const DEFAULT_MA_PERIOD = 20;
const DEFAULT_ADX_PERIOD = 14;
const DEFAULT_STOCHASTIC_PERIOD = 14;
const DEFAULT_STOCHASTIC_SIGNAL_PERIOD = 3;
const DEFAULT_ATR_PERIOD = 14;

export class TechnicalIndicatorsService {
  /**
   * Calculate Relative Strength Index (RSI).
   * @param candles - OHLCV candle data
   * @param period - RSI period (default: 14)
   */
  public calculateRSI(
    candles: Candle[],
    period: number = DEFAULT_RSI_PERIOD,
  ): RSIResult {
    if (candles.length < period + 1) {
      return { value: null, period };
    }

    const values = candles.map((c) => c.close);
    const rsiValues = RSI.calculate({ values, period });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (rsiValues.length === 0) {
      return { value: null, period };
    }

    return {
      value: rsiValues[rsiValues.length - 1],
      period,
    };
  }

  /**
   * Calculate Moving Average Convergence Divergence (MACD).
   * @param candles - OHLCV candle data
   * @param fastPeriod - Fast EMA period (default: 12)
   * @param slowPeriod - Slow EMA period (default: 26)
   * @param signalPeriod - Signal line period (default: 9)
   */
  public calculateMACD(
    candles: Candle[],
    fastPeriod: number = DEFAULT_MACD_FAST_PERIOD,
    slowPeriod: number = DEFAULT_MACD_SLOW_PERIOD,
    signalPeriod: number = DEFAULT_MACD_SIGNAL_PERIOD,
  ): MACDResult {
    const minRequired = slowPeriod + signalPeriod;
    if (candles.length < minRequired) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        fastPeriod,
        slowPeriod,
        signalPeriod,
      };
    }

    const values = candles.map((c) => c.close);
    const macdValues = MACD.calculate({
      values,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (macdValues.length === 0) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        fastPeriod,
        slowPeriod,
        signalPeriod,
      };
    }

    const lastMacd = macdValues[macdValues.length - 1];

    return {
      macd: lastMacd.MACD ?? /* istanbul ignore next */ null,
      signal: lastMacd.signal ?? null,
      histogram: lastMacd.histogram ?? /* istanbul ignore next */ null,
      fastPeriod,
      slowPeriod,
      signalPeriod,
    };
  }

  /**
   * Calculate Bollinger Bands.
   * @param candles - OHLCV candle data
   * @param period - Bollinger period (default: 20)
   * @param stdDev - Standard deviation multiplier (default: 2)
   */
  public calculateBollingerBands(
    candles: Candle[],
    period: number = DEFAULT_BOLLINGER_PERIOD,
    stdDev: number = DEFAULT_BOLLINGER_STDDEV,
  ): BollingerBandsResult {
    if (candles.length < period + 1) {
      return {
        upper: null,
        middle: null,
        lower: null,
        pb: null,
        bandwidth: null,
        period,
        stdDev,
      };
    }

    const values = candles.map((c) => c.close);
    const bbValues = BollingerBands.calculate({ values, period, stdDev });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (bbValues.length === 0) {
      return {
        upper: null,
        middle: null,
        lower: null,
        pb: null,
        bandwidth: null,
        period,
        stdDev,
      };
    }

    const lastBb = bbValues[bbValues.length - 1];
    const bandwidth =
      lastBb.middle > 0 ? (lastBb.upper - lastBb.lower) / lastBb.middle : null;

    return {
      upper: lastBb.upper,
      middle: lastBb.middle,
      lower: lastBb.lower,
      pb: lastBb.pb,
      bandwidth,
      period,
      stdDev,
    };
  }

  /**
   * Calculate Simple Moving Average (SMA).
   * @param candles - OHLCV candle data
   * @param period - SMA period (default: 20)
   */
  public calculateSMA(
    candles: Candle[],
    period: number = DEFAULT_MA_PERIOD,
  ): MovingAverageResult {
    if (candles.length < period) {
      return { value: null, period };
    }

    const values = candles.map((c) => c.close);
    const smaValues = SMA.calculate({ values, period });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (smaValues.length === 0) {
      return { value: null, period };
    }

    return {
      value: smaValues[smaValues.length - 1],
      period,
    };
  }

  /**
   * Calculate Exponential Moving Average (EMA).
   * @param candles - OHLCV candle data
   * @param period - EMA period (default: 20)
   */
  public calculateEMA(
    candles: Candle[],
    period: number = DEFAULT_MA_PERIOD,
  ): MovingAverageResult {
    if (candles.length < period) {
      return { value: null, period };
    }

    const values = candles.map((c) => c.close);
    const emaValues = EMA.calculate({ values, period });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (emaValues.length === 0) {
      return { value: null, period };
    }

    return {
      value: emaValues[emaValues.length - 1],
      period,
    };
  }

  /**
   * Calculate Average Directional Index (ADX).
   * @param candles - OHLCV candle data
   * @param period - ADX period (default: 14)
   */
  public calculateADX(
    candles: Candle[],
    period: number = DEFAULT_ADX_PERIOD,
  ): ADXResult {
    // ADX requires period * 2 candles for calculation
    if (candles.length < period * 2) {
      return { adx: null, plusDI: null, minusDI: null, period };
    }

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);

    const adxValues = ADX.calculate({ high, low, close, period });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (adxValues.length === 0) {
      return { adx: null, plusDI: null, minusDI: null, period };
    }

    const lastAdx = adxValues[adxValues.length - 1];

    return {
      adx: lastAdx.adx,
      plusDI: lastAdx.pdi,
      minusDI: lastAdx.mdi,
      period,
    };
  }

  /**
   * Calculate Stochastic Oscillator.
   * @param candles - OHLCV candle data
   * @param period - Stochastic %K period (default: 14)
   * @param signalPeriod - Signal line period (default: 3)
   */
  public calculateStochastic(
    candles: Candle[],
    period: number = DEFAULT_STOCHASTIC_PERIOD,
    signalPeriod: number = DEFAULT_STOCHASTIC_SIGNAL_PERIOD,
  ): StochasticResult {
    const minRequired = period + signalPeriod;
    if (candles.length < minRequired) {
      return { k: null, d: null, period, signalPeriod };
    }

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);

    const stochValues = Stochastic.calculate({
      high,
      low,
      close,
      period,
      signalPeriod,
    });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (stochValues.length === 0) {
      return { k: null, d: null, period, signalPeriod };
    }

    const lastStoch = stochValues[stochValues.length - 1];

    return {
      k: lastStoch.k,
      d: lastStoch.d,
      period,
      signalPeriod,
    };
  }

  /**
   * Calculate Average True Range (ATR).
   * @param candles - OHLCV candle data
   * @param period - ATR period (default: 14)
   */
  public calculateATR(
    candles: Candle[],
    period: number = DEFAULT_ATR_PERIOD,
  ): ATRResult {
    if (candles.length < period + 1) {
      return { value: null, period };
    }

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);

    const atrValues = ATR.calculate({ high, low, close, period });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (atrValues.length === 0) {
      return { value: null, period };
    }

    return {
      value: atrValues[atrValues.length - 1],
      period,
    };
  }

  /**
   * Calculate On-Balance Volume (OBV).
   * @param candles - OHLCV candle data with volume
   */
  public calculateOBV(candles: Candle[]): OBVResult {
    if (candles.length < 2) {
      return { value: null };
    }

    // Check if all candles have volume
    if (!candles.every((c) => c.volume !== undefined)) {
      return { value: null };
    }

    const close = candles.map((c) => c.close);
    const volume = candles.map((c) => c.volume as number);

    const obvValues = OBV.calculate({ close, volume });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (obvValues.length === 0) {
      return { value: null };
    }

    return {
      value: obvValues[obvValues.length - 1],
    };
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP).
   * @param candles - OHLCV candle data with volume
   */
  public calculateVWAP(candles: Candle[]): VWAPResult {
    if (candles.length < 2) {
      return { value: null };
    }

    // Check if all candles have volume
    if (!candles.every((c) => c.volume !== undefined)) {
      return { value: null };
    }

    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);
    const volume = candles.map((c) => c.volume as number);

    const vwapValues = VWAP.calculate({ high, low, close, volume });

    // istanbul ignore next - defensive check for unexpected library behavior
    if (vwapValues.length === 0) {
      return { value: null };
    }

    return {
      value: vwapValues[vwapValues.length - 1],
    };
  }
}
