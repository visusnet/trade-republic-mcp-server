/**
 * Technical Analysis Service - Internal Types
 *
 * These interfaces define the internal result types used by the service.
 * They are not used for runtime validation since they represent internal
 * calculation results, not external API boundaries.
 */

/**
 * Custom error class for technical analysis operations.
 */
export class TechnicalAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechnicalAnalysisError';
  }
}

/**
 * OHLCV candle data.
 */
export interface Candle {
  /** Unix timestamp in milliseconds */
  time: number;
  /** Opening price */
  open: number;
  /** Highest price */
  high: number;
  /** Lowest price */
  low: number;
  /** Closing price */
  close: number;
  /** Trading volume */
  volume?: number;
}

/**
 * RSI indicator result.
 */
export interface RSIResult {
  /** RSI value (0-100) or null if insufficient data */
  value: number | null;
  /** RSI calculation period */
  period: number;
}

/**
 * MACD indicator result.
 */
export interface MACDResult {
  /** MACD line value or null if insufficient data */
  macd: number | null;
  /** Signal line value or null if insufficient data */
  signal: number | null;
  /** MACD histogram value or null if insufficient data */
  histogram: number | null;
  /** Fast EMA period */
  fastPeriod: number;
  /** Slow EMA period */
  slowPeriod: number;
  /** Signal line period */
  signalPeriod: number;
}

/**
 * Bollinger Bands indicator result.
 */
export interface BollingerBandsResult {
  /** Upper band value or null if insufficient data */
  upper: number | null;
  /** Middle band (SMA) value or null if insufficient data */
  middle: number | null;
  /** Lower band value or null if insufficient data */
  lower: number | null;
  /** Percent B value (position within bands) or null if insufficient data */
  pb: number | null;
  /** Bandwidth as percentage of middle band or null if insufficient data */
  bandwidth: number | null;
  /** Bollinger Bands calculation period */
  period: number;
  /** Standard deviation multiplier */
  stdDev: number;
}

/**
 * SMA/EMA indicator result.
 */
export interface MovingAverageResult {
  /** Moving average value or null if insufficient data */
  value: number | null;
  /** Moving average calculation period */
  period: number;
}

/**
 * ADX indicator result.
 */
export interface ADXResult {
  /** ADX value (trend strength 0-100) or null if insufficient data */
  adx: number | null;
  /** Positive Directional Indicator (+DI) or null if insufficient data */
  plusDI: number | null;
  /** Negative Directional Indicator (-DI) or null if insufficient data */
  minusDI: number | null;
  /** ADX calculation period */
  period: number;
}

/**
 * Stochastic indicator result.
 */
export interface StochasticResult {
  /** Stochastic %K value (0-100) or null if insufficient data */
  k: number | null;
  /** Stochastic %D (signal line) value (0-100) or null if insufficient data */
  d: number | null;
  /** Stochastic %K calculation period */
  period: number;
  /** Signal line (%D) smoothing period */
  signalPeriod: number;
}

/**
 * ATR indicator result.
 */
export interface ATRResult {
  /** Average True Range value or null if insufficient data */
  value: number | null;
  /** ATR calculation period */
  period: number;
}

/**
 * OBV indicator result.
 */
export interface OBVResult {
  /** On-Balance Volume value or null if insufficient data or no volume */
  value: number | null;
}

/**
 * VWAP indicator result.
 */
export interface VWAPResult {
  /** Volume Weighted Average Price or null if insufficient data or no volume */
  value: number | null;
}
