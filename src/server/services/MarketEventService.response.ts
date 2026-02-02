/**
 * Market Event Service - Response Schemas
 */

import { z } from 'zod';

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Ticker data snapshot returned in responses.
 */
export const TickerSnapshotSchema = z
  .object({
    bid: z.number().describe('Best bid price'),
    ask: z.number().describe('Best ask price'),
    mid: z.number().describe('Mid price (average of bid and ask)'),
    last: z.number().optional().describe('Last trade price'),
    spread: z.number().describe('Spread (ask - bid)'),
    spreadPercent: z.number().describe('Spread as percentage of mid price'),
  })
  .describe('Ticker data snapshot');

export type TickerSnapshot = z.output<typeof TickerSnapshotSchema>;

/**
 * A condition that was triggered.
 */
export const TriggeredConditionSchema = z
  .object({
    field: z.string().describe('Field that triggered'),
    operator: z.string().describe('Operator used'),
    threshold: z.number().describe('Configured threshold'),
    actualValue: z.number().describe('Actual value that triggered'),
  })
  .describe('A condition that was triggered');

export type TriggeredCondition = z.output<typeof TriggeredConditionSchema>;

/**
 * Response when a market event was triggered.
 */
export const MarketEventTriggeredResponseSchema = z
  .object({
    status: z.literal('triggered').describe('Event was triggered'),
    isin: z.string().describe('ISIN that triggered'),
    exchange: z.string().describe('Exchange of the instrument'),
    triggeredConditions: z
      .array(TriggeredConditionSchema)
      .describe('Conditions that were met'),
    ticker: TickerSnapshotSchema.describe('Current ticker data'),
    timestamp: z.string().describe('Event timestamp'),
  })
  .describe('Response when a market event was triggered');

export type MarketEventTriggeredResponse = z.output<
  typeof MarketEventTriggeredResponseSchema
>;

/**
 * Response when timeout was reached without trigger.
 */
export const MarketEventTimeoutResponseSchema = z
  .object({
    status: z.literal('timeout').describe('Timeout reached without trigger'),
    lastTickers: z
      .record(z.string(), TickerSnapshotSchema)
      .describe('Last known ticker for each subscribed ISIN'),
    duration: z.number().describe('How long we waited in seconds'),
    timestamp: z.string().describe('Timeout timestamp'),
  })
  .describe('Response when timeout was reached without trigger');

export type MarketEventTimeoutResponse = z.output<
  typeof MarketEventTimeoutResponseSchema
>;

/**
 * Discriminated union for wait_for_market_event response.
 */
export const WaitForMarketEventResponseSchema = z
  .discriminatedUnion('status', [
    MarketEventTriggeredResponseSchema,
    MarketEventTimeoutResponseSchema,
  ])
  .describe('Response for wait_for_market_event tool');

export type WaitForMarketEventResponse = z.output<
  typeof WaitForMarketEventResponseSchema
>;
