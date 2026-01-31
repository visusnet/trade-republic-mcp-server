/**
 * Portfolio Service - Response Schemas
 *
 * Field names based on Trade Republic API research (pytr).
 * Schemas use passthrough() to allow additional fields from API.
 */

import { z } from 'zod';

/**
 * Portfolio position schema
 * Handles field name variations between different API versions
 */
const PortfolioPositionSchema = z
  .object({
    instrumentId: z.string(),
    netSize: z.union([z.number(), z.string()]).transform((v) => Number(v)),
    netValue: z.number(),
    // Accept both field name variations
    averageBuyIn: z.number().optional(),
    unrealisedAverageCost: z.number().optional(),
    realisedProfit: z.number().optional(),
  })
  .passthrough()
  .transform((data) => ({
    instrumentId: data.instrumentId,
    netSize: data.netSize,
    netValue: data.netValue,
    averageCost: data.averageBuyIn ?? data.unrealisedAverageCost ?? 0,
    realisedProfit: data.realisedProfit ?? 0,
  }));

export type PortfolioPosition = z.output<typeof PortfolioPositionSchema>;

/**
 * Portfolio response schema
 */
export const GetPortfolioResponseSchema = z
  .object({
    positions: z.array(PortfolioPositionSchema),
    netValue: z.number(),
    referenceChangeProfit: z.number().optional(),
    referenceChangeProfitPercent: z.number().optional(),
    unrealisedProfit: z.number().optional(),
    unrealisedProfitPercent: z.number().optional(),
    unrealisedCost: z.number().optional(),
  })
  .passthrough();

export type GetPortfolioResponse = z.output<typeof GetPortfolioResponseSchema>;

/**
 * Cash balance response schema
 * Handles field name variations (amount/availableCash, currencyId/currency)
 */
export const GetCashBalanceResponseSchema = z
  .object({
    // Accept both field name variations
    amount: z.number().optional(),
    availableCash: z.number().optional(),
    currencyId: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough()
  .transform((data) => ({
    availableCash: data.amount ?? data.availableCash ?? 0,
    currency: data.currencyId ?? data.currency ?? 'EUR',
  }));

export type GetCashBalanceResponse = z.output<
  typeof GetCashBalanceResponseSchema
>;
