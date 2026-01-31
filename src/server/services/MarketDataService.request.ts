/**
 * Market Data Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Default exchange for market data requests.
 * LSX (Lang & Schwarz Exchange) is used as the default.
 */
export const DEFAULT_EXCHANGE = 'LSX';

/**
 * Time range options for price history requests.
 * @internal
 */
const TimeRangeSchema = z.enum([
  '1d',
  '5d',
  '1m',
  '3m',
  '6m',
  '1y',
  '5y',
  'max',
]);

/**
 * Valid time range values for price history requests.
 */
export type TimeRange = z.output<typeof TimeRangeSchema>;

/**
 * Request schema for get_price tool.
 * Retrieves current price for an instrument.
 */
export const GetPriceRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetPriceRequest = z.output<typeof GetPriceRequestSchema>;

/**
 * Request schema for get_price_history tool.
 * Retrieves historical price data for an instrument.
 */
export const GetPriceHistoryRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  range: TimeRangeSchema.describe('Time range'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetPriceHistoryRequest = z.output<
  typeof GetPriceHistoryRequestSchema
>;

/**
 * Request schema for get_order_book tool.
 * Retrieves order book (bid/ask) for an instrument.
 */
export const GetOrderBookRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetOrderBookRequest = z.output<typeof GetOrderBookRequestSchema>;

/**
 * Request schema for search_assets tool.
 * Searches for instruments by name or symbol.
 */
export const SearchAssetsRequestSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Max results'),
});
export type SearchAssetsRequest = z.output<typeof SearchAssetsRequestSchema>;

/**
 * Request schema for get_asset_info tool.
 * Retrieves detailed information about an instrument.
 */
export const GetAssetInfoRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
});
export type GetAssetInfoRequest = z.output<typeof GetAssetInfoRequestSchema>;

/**
 * Request schema for get_market_status tool.
 * Checks if the market is open for an instrument.
 */
export const GetMarketStatusRequestSchema = z.object({
  isin: z.string().describe('ISIN to check'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
});
export type GetMarketStatusRequest = z.output<
  typeof GetMarketStatusRequestSchema
>;

/**
 * Request schema for wait_for_market tool.
 * Waits for the market to open for an instrument.
 */
export const WaitForMarketRequestSchema = z.object({
  isin: z.string().describe('ISIN to monitor'),
  exchange: z
    .string()
    .default(DEFAULT_EXCHANGE)
    .optional()
    .describe('Exchange (default: LSX)'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(60000)
    .optional()
    .describe('Timeout ms (default: 60000)'),
  pollIntervalMs: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000)
    .optional()
    .describe('Poll interval ms (default: 5000)'),
});
export type WaitForMarketRequest = z.output<typeof WaitForMarketRequestSchema>;
