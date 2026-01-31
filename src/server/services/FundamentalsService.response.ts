/**
 * Fundamentals Service - Response Schemas
 */

import { z } from 'zod';

/**
 * Company profile data.
 */
export const ProfileDataSchema = z.object({
  name: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  employees: z.number().optional(),
  description: z.string().optional(),
});

export type ProfileData = z.output<typeof ProfileDataSchema>;

/**
 * Financial metrics data.
 */
export const FinancialsDataSchema = z.object({
  revenue: z.number().optional(),
  grossMargin: z.number().optional(),
  operatingMargin: z.number().optional(),
  profitMargin: z.number().optional(),
  freeCashFlow: z.number().optional(),
  totalDebt: z.number().optional(),
  totalCash: z.number().optional(),
  debtToEquity: z.number().optional(),
  currentRatio: z.number().optional(),
});

export type FinancialsData = z.output<typeof FinancialsDataSchema>;

/**
 * Earnings data.
 */
export const EarningsDataSchema = z.object({
  eps: z.number().optional(),
  epsTTM: z.number().optional(),
  epsGrowth: z.number().optional(),
  nextEarningsDate: z.string().optional(),
  earningsQuarterlyGrowth: z.number().optional(),
});

export type EarningsData = z.output<typeof EarningsDataSchema>;

/**
 * Valuation metrics data.
 */
export const ValuationDataSchema = z.object({
  marketCap: z.number().optional(),
  peRatio: z.number().optional(),
  forwardPE: z.number().optional(),
  pegRatio: z.number().optional(),
  priceToBook: z.number().optional(),
  priceToSales: z.number().optional(),
  enterpriseValue: z.number().optional(),
  evToRevenue: z.number().optional(),
  evToEbitda: z.number().optional(),
});

export type ValuationData = z.output<typeof ValuationDataSchema>;

/**
 * Analyst recommendation data.
 */
export const RecommendationSchema = z.object({
  rating: z.string().optional(),
  targetPrice: z.number().optional(),
  numberOfAnalysts: z.number().optional(),
  strongBuy: z.number().optional(),
  buy: z.number().optional(),
  hold: z.number().optional(),
  sell: z.number().optional(),
  strongSell: z.number().optional(),
});

export type Recommendation = z.output<typeof RecommendationSchema>;

/**
 * Response schema for get_fundamentals tool.
 */
export const GetFundamentalsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  profile: ProfileDataSchema.optional(),
  financials: FinancialsDataSchema.optional(),
  earnings: EarningsDataSchema.optional(),
  valuation: ValuationDataSchema.optional(),
  recommendations: RecommendationSchema.optional(),
  timestamp: z.string(),
});

export type GetFundamentalsResponse = z.output<
  typeof GetFundamentalsResponseSchema
>;
