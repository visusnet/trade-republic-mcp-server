/**
 * Technical Analysis Service - Internal Types
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
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * RSI indicator result.
 */
export interface RSIResult {
  value: number | null;
  period: number;
}

/**
 * MACD indicator result.
 */
export interface MACDResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

/**
 * Bollinger Bands indicator result.
 */
export interface BollingerBandsResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  pb: number | null;
  bandwidth: number | null;
  period: number;
  stdDev: number;
}

/**
 * SMA/EMA indicator result.
 */
export interface MovingAverageResult {
  value: number | null;
  period: number;
}

/**
 * ADX indicator result.
 */
export interface ADXResult {
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  period: number;
}

/**
 * Stochastic indicator result.
 */
export interface StochasticResult {
  k: number | null;
  d: number | null;
  period: number;
  signalPeriod: number;
}

/**
 * ATR indicator result.
 */
export interface ATRResult {
  value: number | null;
  period: number;
}

/**
 * OBV indicator result.
 */
export interface OBVResult {
  value: number | null;
}

/**
 * VWAP indicator result.
 */
export interface VWAPResult {
  value: number | null;
}
