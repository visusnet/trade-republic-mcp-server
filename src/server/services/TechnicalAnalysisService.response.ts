/**
 * Technical Analysis Service - Response Schemas
 */

import { z } from 'zod';

/**
 * Signal strength schema.
 */
export const SignalStrengthSchema = z.enum(['strong', 'moderate', 'weak']);
export type SignalStrength = z.output<typeof SignalStrengthSchema>;

/**
 * Signal direction schema.
 */
export const SignalDirectionSchema = z.enum(['buy', 'sell', 'hold']);
export type SignalDirection = z.output<typeof SignalDirectionSchema>;

/**
 * Individual indicator result schema.
 */
export const IndicatorResultSchema = z.object({
  type: z.string(),
  period: z.number().optional(),
  value: z.number().nullable(),
  // For multi-value indicators (MACD, Bollinger, Stochastic)
  components: z.record(z.string(), z.number().nullable()).optional(),
});
export type IndicatorResult = z.output<typeof IndicatorResultSchema>;

/**
 * Response schema for get_indicators tool.
 */
export const GetIndicatorsResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  candleCount: z.number(),
  indicators: z.array(IndicatorResultSchema),
  timestamp: z.string(),
});
export type GetIndicatorsResponse = z.output<
  typeof GetIndicatorsResponseSchema
>;

/**
 * Individual indicator signal schema.
 */
export const IndicatorSignalSchema = z.object({
  indicator: z.string(),
  signal: SignalDirectionSchema,
  strength: SignalStrengthSchema,
  reason: z.string(),
  value: z.number().nullable(),
});
export type IndicatorSignal = z.output<typeof IndicatorSignalSchema>;

/**
 * Analysis summary schema.
 * @internal
 */
const AnalysisSummarySchema = z.object({
  overallSignal: SignalDirectionSchema,
  confidence: z.number().min(0).max(100),
  score: z.number().min(-100).max(100),
  bullishCount: z.number(),
  bearishCount: z.number(),
  neutralCount: z.number(),
});

/**
 * Trend info schema.
 * @internal
 */
const TrendInfoSchema = z.object({
  direction: z.enum(['uptrend', 'downtrend', 'sideways']),
  strength: SignalStrengthSchema,
  sma20: z.number().nullable(),
  sma50: z.number().nullable(),
});

/**
 * Response schema for get_detailed_analysis tool.
 */
export const GetDetailedAnalysisResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  currentPrice: z.number(),
  summary: AnalysisSummarySchema,
  trend: TrendInfoSchema,
  signals: z.array(IndicatorSignalSchema),
  indicators: z.object({
    rsi: z.number().nullable(),
    macd: z.object({
      macd: z.number().nullable(),
      signal: z.number().nullable(),
      histogram: z.number().nullable(),
    }),
    bollingerBands: z.object({
      upper: z.number().nullable(),
      middle: z.number().nullable(),
      lower: z.number().nullable(),
      pb: z.number().nullable(),
    }),
    stochastic: z.object({
      k: z.number().nullable(),
      d: z.number().nullable(),
    }),
    adx: z.number().nullable(),
    atr: z.number().nullable(),
  }),
  timestamp: z.string(),
});
export type GetDetailedAnalysisResponse = z.output<
  typeof GetDetailedAnalysisResponseSchema
>;
