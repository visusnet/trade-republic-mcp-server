/**
 * Order Service - Response Schemas
 *
 * Schemas use passthrough() to allow additional fields from API.
 */

import { z } from 'zod';

// =============================================================================
// Place Order Response
// =============================================================================

export const PlaceOrderResponseSchema = z
  .object({
    orderId: z.string(),
    status: z.string(),
    isin: z.string(),
    exchange: z.string(),
    orderType: z.enum(['buy', 'sell']),
    mode: z.enum(['market', 'limit', 'stopMarket']),
    size: z.number(),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    estimatedPrice: z.number().optional(),
    estimatedCost: z.number().optional(),
    estimatedFees: z.number().optional(),
    warnings: z.array(z.string()).optional(),
    timestamp: z.string(),
  })
  .passthrough();

export type PlaceOrderResponse = z.output<typeof PlaceOrderResponseSchema>;

// =============================================================================
// Order Info Schema (used in Get Orders Response)
// =============================================================================

const OrderInfoSchema = z
  .object({
    orderId: z.string(),
    status: z.string(),
    isin: z.string(),
    exchange: z.string(),
    orderType: z.enum(['buy', 'sell']),
    mode: z.enum(['market', 'limit', 'stopMarket']),
    size: z.number(),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    executedSize: z.number().optional(),
    executedPrice: z.number().optional(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export type OrderInfo = z.output<typeof OrderInfoSchema>;

// =============================================================================
// Get Orders Response
// =============================================================================

export const GetOrdersResponseSchema = z
  .object({
    orders: z.array(OrderInfoSchema),
    totalCount: z.number(),
    timestamp: z.string(),
  })
  .passthrough();

export type GetOrdersResponse = z.output<typeof GetOrdersResponseSchema>;

// =============================================================================
// Modify Order Response
// =============================================================================

export const ModifyOrderResponseSchema = z
  .object({
    orderId: z.string(),
    status: z.string(),
    timestamp: z.string(),
  })
  .passthrough();

export type ModifyOrderResponse = z.output<typeof ModifyOrderResponseSchema>;

// =============================================================================
// Cancel Order Response
// =============================================================================

export const CancelOrderResponseSchema = z
  .object({
    orderId: z.string(),
    status: z.string(),
    cancelled: z.boolean(),
    timestamp: z.string(),
  })
  .passthrough();

export type CancelOrderResponse = z.output<typeof CancelOrderResponseSchema>;
