/**
 * Market Data Service - Response Schemas
 *
 * Internal API response schemas use .passthrough() to allow additional fields from API.
 * Output response schemas define the structure returned to consumers.
 */

import { z } from 'zod';

/**
 * Helper to parse numeric strings or numbers into numbers.
 */
const numericString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseFloat(v) : v));

// ============================================================================
// Internal API Response Schemas (from Trade Republic WebSocket)
// ============================================================================

/**
 * Ticker API response schema (from Trade Republic ticker subscription).
 */
export const TickerApiResponseSchema = z
  .object({
    bid: z.object({ price: numericString, size: numericString.optional() }),
    ask: z.object({ price: numericString, size: numericString.optional() }),
    last: z
      .object({ price: numericString, time: z.string().optional() })
      .optional(),
    open: z.object({ price: numericString }).optional(),
    pre: z.object({ price: numericString }).optional(),
    qualityId: z.string().optional(),
  })
  .passthrough();

export type TickerApiResponse = z.output<typeof TickerApiResponseSchema>;

/**
 * Aggregate history API response schema (from Trade Republic aggregateHistory subscription).
 */
export const AggregateHistoryApiSchema = z
  .object({
    aggregates: z.array(
      z.object({
        time: z.number(),
        open: numericString,
        high: numericString,
        low: numericString,
        close: numericString,
        volume: numericString.optional(),
      }),
    ),
    resolution: z.number().optional(),
  })
  .passthrough();

export type AggregateHistoryApiResponse = z.output<
  typeof AggregateHistoryApiSchema
>;

/**
 * Neon search API response schema (from Trade Republic neonSearch subscription).
 */
export const NeonSearchApiSchema = z
  .object({
    results: z.array(
      z.object({
        isin: z.string(),
        name: z.string(),
        type: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    ),
  })
  .passthrough();

export type NeonSearchApiResponse = z.output<typeof NeonSearchApiSchema>;

/**
 * Instrument API response schema (from Trade Republic instrument subscription).
 */
export const InstrumentApiSchema = z
  .object({
    isin: z.string(),
    name: z.string(),
    shortName: z.string().optional(),
    intlSymbol: z.string().optional(),
    homeSymbol: z.string().optional(),
    typeId: z.string().optional(),
    wkn: z.string().optional(),
    company: z
      .object({
        name: z.string(),
        description: z.string().optional(),
        countryOfOrigin: z.string().optional(),
      })
      .optional(),
    exchanges: z
      .array(
        z.object({
          exchangeId: z.string(),
          name: z.string().optional(),
        }),
      )
      .optional(),
    tags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  })
  .passthrough();

export type InstrumentApiResponse = z.output<typeof InstrumentApiSchema>;

// ============================================================================
// Output Response Schemas (returned to consumers)
// ============================================================================

/**
 * Get price response schema.
 */
export const GetPriceResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  bid: z.number(),
  ask: z.number(),
  last: z.number().optional(),
  spread: z.number(),
  spreadPercent: z.number(),
  timestamp: z.string(),
});
export type GetPriceResponse = z.output<typeof GetPriceResponseSchema>;

/**
 * Get price history response schema.
 */
export const GetPriceHistoryResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  range: z.string(),
  candles: z.array(
    z.object({
      time: z.number(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number().optional(),
    }),
  ),
  resolution: z.number().optional(),
});
export type GetPriceHistoryResponse = z.output<
  typeof GetPriceHistoryResponseSchema
>;

/**
 * Get order book response schema.
 */
export const GetOrderBookResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  bids: z.array(z.object({ price: z.number(), size: z.number().optional() })),
  asks: z.array(z.object({ price: z.number(), size: z.number().optional() })),
  spread: z.number(),
  midPrice: z.number(),
  timestamp: z.string(),
});
export type GetOrderBookResponse = z.output<typeof GetOrderBookResponseSchema>;

/**
 * Search assets response schema.
 */
export const SearchAssetsResponseSchema = z.object({
  results: z.array(
    z.object({
      isin: z.string(),
      name: z.string(),
      type: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
  totalCount: z.number(),
});
export type SearchAssetsResponse = z.output<typeof SearchAssetsResponseSchema>;

/**
 * Get asset info response schema.
 */
export const GetAssetInfoResponseSchema = z.object({
  isin: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  symbol: z.string().optional(),
  type: z.string().optional(),
  wkn: z.string().optional(),
  company: z
    .object({
      name: z.string(),
      description: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  exchanges: z
    .array(z.object({ id: z.string(), name: z.string().optional() }))
    .optional(),
  tags: z.array(z.string()).optional(),
});
export type GetAssetInfoResponse = z.output<typeof GetAssetInfoResponseSchema>;

/**
 * Market status enum.
 */
export const MarketStatusSchema = z.enum([
  'open',
  'closed',
  'pre-market',
  'post-market',
  'unknown',
]);
export type MarketStatus = z.output<typeof MarketStatusSchema>;

/**
 * Get market status response schema.
 */
export const GetMarketStatusResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  status: MarketStatusSchema,
  isOpen: z.boolean(),
  hasBid: z.boolean(),
  hasAsk: z.boolean(),
  timestamp: z.string(),
});
export type GetMarketStatusResponse = z.output<
  typeof GetMarketStatusResponseSchema
>;

/**
 * Wait for market response schema.
 */
export const WaitForMarketResponseSchema = z.object({
  isin: z.string(),
  exchange: z.string(),
  isOpen: z.boolean(),
  waitedMs: z.number(),
  timedOut: z.boolean(),
  timestamp: z.string(),
});
export type WaitForMarketResponse = z.output<
  typeof WaitForMarketResponseSchema
>;
