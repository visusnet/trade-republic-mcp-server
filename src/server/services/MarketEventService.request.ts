/**
 * Market Event Service - Request Schemas
 */

import { z } from 'zod';

import {
  ConditionField,
  ConditionLogic,
  ConditionOperator,
} from './MarketEventService.types';

// =============================================================================
// Request Schemas
// =============================================================================

/**
 * A single condition to evaluate against ticker data.
 */
export const ConditionSchema = z
  .object({
    field: z
      .nativeEnum(ConditionField)
      .describe(
        'The ticker field to monitor (bid, ask, mid, last, spread, spreadPercent)',
      ),
    operator: z
      .nativeEnum(ConditionOperator)
      .describe(
        'Comparison operator. Note: crossAbove/crossBelow require a previous value to detect crossing',
      ),
    value: z.number().describe('Threshold value to compare against'),
  })
  .describe('A single condition to evaluate against ticker data');

export type Condition = z.output<typeof ConditionSchema>;

/**
 * A subscription to monitor a specific ISIN with conditions.
 */
export const SubscriptionSchema = z
  .object({
    isin: z.string().describe('ISIN of the instrument to monitor'),
    exchange: z
      .string()
      .optional()
      .describe('Exchange to use (defaults to LSX)'),
    conditions: z
      .array(ConditionSchema)
      .min(1)
      .max(5)
      .describe('Conditions that trigger the event (1-5 conditions)'),
    logic: z
      .nativeEnum(ConditionLogic)
      .default(ConditionLogic.ANY)
      .describe('How to combine conditions: "any" (OR) or "all" (AND)'),
  })
  .describe('A subscription to monitor a specific ISIN with conditions');

export type Subscription = z.output<typeof SubscriptionSchema>;

/**
 * Request schema for wait_for_market_event tool.
 */
export const WaitForMarketEventRequestSchema = z
  .object({
    subscriptions: z
      .array(SubscriptionSchema)
      .min(1)
      .max(5)
      .describe('ISINs and conditions to monitor (1-5 subscriptions)'),
    timeout: z
      .number()
      .min(1)
      .max(55)
      .default(55)
      .describe('Wait time in seconds (1-55, default: 55)'),
  })
  .describe('Request to wait for a market event matching specified conditions');

export type WaitForMarketEventRequest = z.output<
  typeof WaitForMarketEventRequestSchema
>;
