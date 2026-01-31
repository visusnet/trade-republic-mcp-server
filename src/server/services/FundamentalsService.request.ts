/**
 * Fundamentals Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Available data modules for fundamentals.
 */
export const FundamentalsModuleSchema = z.enum([
  'profile',
  'financials',
  'earnings',
  'valuation',
  'recommendations',
]);

export type FundamentalsModule = z.output<typeof FundamentalsModuleSchema>;

/**
 * Request schema for get_fundamentals tool.
 * Retrieves fundamental data for an instrument.
 */
export const GetFundamentalsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  modules: z
    .array(FundamentalsModuleSchema)
    .min(1)
    .default(['profile', 'financials', 'valuation'])
    .optional()
    .describe(
      'Data modules to fetch (default: profile, financials, valuation)',
    ),
});

export type GetFundamentalsRequest = z.output<
  typeof GetFundamentalsRequestSchema
>;
