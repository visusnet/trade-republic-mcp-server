/**
 * Risk Service - Types, Schemas, and Constants
 */

import { z } from 'zod';

/**
 * Custom error class for risk management operations.
 */
export class RiskServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RiskServiceError';
  }
}

// Annualization factors
export const TRADING_DAYS_PER_YEAR = 252;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

// One-tailed z-scores for VaR (downside risk only)
export const VAR_Z_SCORES: Record<string, number> = {
  '0.95': -1.645, // 95% confidence
  '0.99': -2.326, // 99% confidence (often rounded to -2.33)
};

// Annualization periods mapping
export const PERIODS_PER_YEAR: Record<string, number> = {
  daily: TRADING_DAYS_PER_YEAR,
  weekly: WEEKS_PER_YEAR,
  monthly: MONTHS_PER_YEAR,
};

/**
 * Internal result type schemas
 *
 * These schemas are used both for type derivation and as building blocks
 * for the response schema (DRY principle).
 */

/**
 * Volatility calculation result schema.
 */
const VolatilityResultSchema = z.object({
  daily: z
    .number()
    .describe('Daily volatility (standard deviation of log returns)'),
  annualized: z.number().describe('Annualized volatility'),
});
type VolatilityResult = z.output<typeof VolatilityResultSchema>;

/**
 * Value at Risk calculation result schema.
 */
const VaRResultSchema = z.object({
  parametric: z
    .number()
    .describe('Parametric VaR (negative value = expected loss)'),
  historical: z
    .number()
    .describe('Historical VaR (negative value = expected loss)'),
  confidenceLevel: z.string().describe('Confidence level used (0.95 or 0.99)'),
});
type VaRResult = z.output<typeof VaRResultSchema>;

/**
 * Maximum drawdown calculation result schema.
 */
const MaxDrawdownResultSchema = z.object({
  value: z.number().describe('Maximum drawdown in absolute price terms'),
  percent: z
    .number()
    .describe('Maximum drawdown as percentage (positive value)'),
  peakIndex: z
    .number()
    .int()
    .describe('Index of peak price in the price array'),
  troughIndex: z
    .number()
    .int()
    .describe('Index of trough price in the price array'),
});
type MaxDrawdownResult = z.output<typeof MaxDrawdownResultSchema>;

export type { VolatilityResult, VaRResult, MaxDrawdownResult };

// Request Schemas
export const CalculatePositionSizeRequestSchema = z.object({
  accountBalance: z
    .number()
    .positive()
    .describe('Total account balance in EUR'),
  winRate: z
    .number()
    .min(0)
    .max(1)
    .describe('Historical win rate (0.0 to 1.0)'),
  avgWin: z.number().positive().describe('Average winning trade amount in EUR'),
  avgLoss: z.number().positive().describe('Average losing trade amount in EUR'),
  kellyFraction: z
    .number()
    .min(0.1)
    .max(1.0)
    .default(0.25)
    .optional()
    .describe(
      'Fraction of Kelly (0.25=quarter, 0.5=half, 1.0=full). Default: 0.25 (recommended)',
    ),
  maxPositionPct: z
    .number()
    .min(0)
    .max(1)
    .default(0.1)
    .optional()
    .describe(
      'Maximum position size as fraction of account. Default: 0.10 (10%)',
    ),
  minCashReservePct: z
    .number()
    .min(0)
    .max(1)
    .default(0.1)
    .optional()
    .describe(
      'Minimum cash reserve as fraction of account. Default: 0.10 (10%)',
    ),
});

export type CalculatePositionSizeRequest = z.infer<
  typeof CalculatePositionSizeRequestSchema
>;

export const CalculatePositionSizeResponseSchema = z.object({
  kellyPercentage: z.number().describe('Raw Kelly percentage'),
  adjustedPercentage: z
    .number()
    .describe('After applying Kelly fraction and caps'),
  positionSizeAmount: z.number().describe('Recommended position size in EUR'),
  maxPositionSize: z.number().describe('Maximum allowed position size in EUR'),
  availableCapital: z
    .number()
    .describe('Available capital after cash reserve in EUR'),
  winLossRatio: z.number().describe('Win/Loss ratio used in calculation'),
  warnings: z.array(z.string()).describe('Warning messages if any'),
  timestamp: z.string().datetime(),
});

export type CalculatePositionSizeResponse = z.infer<
  typeof CalculatePositionSizeResponseSchema
>;

export const GetRiskMetricsRequestSchema = z.object({
  prices: z
    .array(z.number().positive())
    .min(2)
    .describe('Historical prices (chronological, oldest first)'),
  riskFreeRate: z
    .number()
    .min(0)
    .max(1)
    .default(0.02)
    .optional()
    .describe('Annual risk-free rate for Sharpe ratio. Default: 0.02 (2%)'),
  confidenceLevel: z
    .enum(['0.95', '0.99'])
    .default('0.95')
    .optional()
    .describe('Confidence level for VaR. Default: 0.95 (95%)'),
  timeframe: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('daily')
    .optional()
    .describe('Timeframe of price data for annualization. Default: daily'),
});

export type GetRiskMetricsRequest = z.infer<typeof GetRiskMetricsRequestSchema>;

export const GetRiskMetricsResponseSchema = z.object({
  volatility: VolatilityResultSchema,
  valueAtRisk: VaRResultSchema,
  maxDrawdown: MaxDrawdownResultSchema,
  sharpeRatio: z
    .number()
    .nullable()
    .describe('Annualized Sharpe ratio (null if zero volatility)'),
  returns: z.object({
    total: z.number().describe('Total return as percentage'),
    mean: z.number().describe('Mean log return'),
    annualized: z.number().describe('Annualized return as percentage'),
  }),
  dataPoints: z.number().int().describe('Number of price data points'),
  timeframe: z.enum(['daily', 'weekly', 'monthly']),
  timestamp: z.string().datetime(),
});

export type GetRiskMetricsResponse = z.infer<
  typeof GetRiskMetricsResponseSchema
>;
