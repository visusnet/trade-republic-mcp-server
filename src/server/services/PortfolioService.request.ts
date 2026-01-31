/**
 * Portfolio Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Request schema for get_portfolio tool.
 * No parameters required - retrieves current portfolio.
 */
export const GetPortfolioRequestSchema = z
  .object({})
  .describe('Request parameters for getting portfolio');

export type GetPortfolioRequest = z.output<typeof GetPortfolioRequestSchema>;

/**
 * Request schema for get_cash_balance tool.
 * No parameters required - retrieves current cash balance.
 */
export const GetCashBalanceRequestSchema = z
  .object({})
  .describe('Request parameters for getting cash balance');

export type GetCashBalanceRequest = z.output<
  typeof GetCashBalanceRequestSchema
>;
