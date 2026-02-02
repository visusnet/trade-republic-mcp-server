/**
 * Technical Analysis Service - Internal Types
 *
 * These schemas are used only for type derivation (via z.output<typeof Schema>).
 * They are not exported because they are not used for runtime validation.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from 'zod';

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
 * OHLCV candle data schema.
 */
const CandleSchema = z.object({
  time: z.number().describe('Unix timestamp in milliseconds'),
  open: z.number().describe('Opening price'),
  high: z.number().describe('Highest price'),
  low: z.number().describe('Lowest price'),
  close: z.number().describe('Closing price'),
  volume: z.number().optional().describe('Trading volume'),
});
type Candle = z.output<typeof CandleSchema>;

/**
 * RSI indicator result schema.
 */
const RSIResultSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe('RSI value (0-100) or null if insufficient data'),
  period: z.number().describe('RSI calculation period'),
});
type RSIResult = z.output<typeof RSIResultSchema>;

/**
 * MACD indicator result schema.
 */
const MACDResultSchema = z.object({
  macd: z
    .number()
    .nullable()
    .describe('MACD line value or null if insufficient data'),
  signal: z
    .number()
    .nullable()
    .describe('Signal line value or null if insufficient data'),
  histogram: z
    .number()
    .nullable()
    .describe('MACD histogram value or null if insufficient data'),
  fastPeriod: z.number().describe('Fast EMA period'),
  slowPeriod: z.number().describe('Slow EMA period'),
  signalPeriod: z.number().describe('Signal line period'),
});
type MACDResult = z.output<typeof MACDResultSchema>;

/**
 * Bollinger Bands indicator result schema.
 */
const BollingerBandsResultSchema = z.object({
  upper: z
    .number()
    .nullable()
    .describe('Upper band value or null if insufficient data'),
  middle: z
    .number()
    .nullable()
    .describe('Middle band (SMA) value or null if insufficient data'),
  lower: z
    .number()
    .nullable()
    .describe('Lower band value or null if insufficient data'),
  pb: z
    .number()
    .nullable()
    .describe(
      'Percent B value (position within bands) or null if insufficient data',
    ),
  bandwidth: z
    .number()
    .nullable()
    .describe(
      'Bandwidth as percentage of middle band or null if insufficient data',
    ),
  period: z.number().describe('Bollinger Bands calculation period'),
  stdDev: z.number().describe('Standard deviation multiplier'),
});
type BollingerBandsResult = z.output<typeof BollingerBandsResultSchema>;

/**
 * SMA/EMA indicator result schema.
 */
const MovingAverageResultSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe('Moving average value or null if insufficient data'),
  period: z.number().describe('Moving average calculation period'),
});
type MovingAverageResult = z.output<typeof MovingAverageResultSchema>;

/**
 * ADX indicator result schema.
 */
const ADXResultSchema = z.object({
  adx: z
    .number()
    .nullable()
    .describe('ADX value (trend strength 0-100) or null if insufficient data'),
  plusDI: z
    .number()
    .nullable()
    .describe(
      'Positive Directional Indicator (+DI) or null if insufficient data',
    ),
  minusDI: z
    .number()
    .nullable()
    .describe(
      'Negative Directional Indicator (-DI) or null if insufficient data',
    ),
  period: z.number().describe('ADX calculation period'),
});
type ADXResult = z.output<typeof ADXResultSchema>;

/**
 * Stochastic indicator result schema.
 */
const StochasticResultSchema = z.object({
  k: z
    .number()
    .nullable()
    .describe('Stochastic %K value (0-100) or null if insufficient data'),
  d: z
    .number()
    .nullable()
    .describe(
      'Stochastic %D (signal line) value (0-100) or null if insufficient data',
    ),
  period: z.number().describe('Stochastic %K calculation period'),
  signalPeriod: z.number().describe('Signal line (%D) smoothing period'),
});
type StochasticResult = z.output<typeof StochasticResultSchema>;

/**
 * ATR indicator result schema.
 */
const ATRResultSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe('Average True Range value or null if insufficient data'),
  period: z.number().describe('ATR calculation period'),
});
type ATRResult = z.output<typeof ATRResultSchema>;

/**
 * OBV indicator result schema.
 */
const OBVResultSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe(
      'On-Balance Volume value or null if insufficient data or no volume',
    ),
});
type OBVResult = z.output<typeof OBVResultSchema>;

/**
 * VWAP indicator result schema.
 */
const VWAPResultSchema = z.object({
  value: z
    .number()
    .nullable()
    .describe(
      'Volume Weighted Average Price or null if insufficient data or no volume',
    ),
});
type VWAPResult = z.output<typeof VWAPResultSchema>;

export type {
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
};
