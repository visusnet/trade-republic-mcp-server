/**
 * Technical Analysis Service - Request Schemas
 */

import { z } from 'zod';

import { DEFAULT_EXCHANGE, TimeRangeSchema } from './MarketDataService.request';

/**
 * Indicator type schema.
 * Defines the available technical indicators.
 * @internal
 */
const IndicatorTypeSchema = z.enum([
  'RSI', // Relative Strength Index
  'MACD', // Moving Average Convergence Divergence
  'BOLLINGER', // Bollinger Bands
  'SMA', // Simple Moving Average
  'EMA', // Exponential Moving Average
  'ADX', // Average Directional Index
  'STOCHASTIC', // Stochastic Oscillator
  'ATR', // Average True Range
  'OBV', // On-Balance Volume (no period)
  'VWAP', // Volume Weighted Average Price (no period)
]);

/**
 * Indicator configuration schema.
 * Configures a single indicator with optional period.
 * @internal
 */
const IndicatorConfigSchema = z.object({
  type: IndicatorTypeSchema.describe('Indicator type'),
  period: z
    .number()
    .int()
    .min(2)
    .max(200)
    .optional()
    .describe(
      'Period for the indicator (ignored for OBV/VWAP, default varies by indicator)',
    ),
});

/**
 * Request schema for get_indicators tool.
 * Calculate specific technical indicators for an instrument.
 */
export const GetIndicatorsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range for historical data'),
  indicators: z
    .array(IndicatorConfigSchema)
    .min(1)
    .max(10)
    .describe('Indicators to calculate'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetIndicatorsRequest = z.output<typeof GetIndicatorsRequestSchema>;

/**
 * Request schema for get_detailed_analysis tool.
 * Get comprehensive technical analysis with signals for an instrument.
 */
export const GetDetailedAnalysisRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.default('3m')
    .optional()
    .describe('Time range for analysis (default: 3m)'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetDetailedAnalysisRequest = z.output<
  typeof GetDetailedAnalysisRequestSchema
>;
