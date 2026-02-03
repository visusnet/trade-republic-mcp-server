/**
 * Order Service - Request Schemas
 */

import { z } from 'zod';

// =============================================================================
// Place Order Request
// =============================================================================

export const PlaceOrderRequestSchema = z.object({
  isin: z.string().length(12),
  exchange: z.string().default('LSX'),
  orderType: z.enum(['buy', 'sell']),
  mode: z.enum(['market', 'limit', 'stopMarket']),
  size: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  expiry: z.enum(['gfd', 'gtd', 'gtc']).default('gfd'),
  expiryDate: z.string().optional(),
  sellFractions: z.boolean().default(false),
  warningsShown: z.array(z.string()).default([]),
});

export type PlaceOrderRequest = z.input<typeof PlaceOrderRequestSchema>;

// =============================================================================
// Get Orders Request
// =============================================================================

export const GetOrdersRequestSchema = z.object({
  includeExecuted: z.boolean().default(false),
  includeCancelled: z.boolean().default(false),
});

export type GetOrdersRequest = z.input<typeof GetOrdersRequestSchema>;

// =============================================================================
// Modify Order Request
// =============================================================================

export const ModifyOrderRequestSchema = z.object({
  orderId: z.string(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
});

export type ModifyOrderRequest = z.infer<typeof ModifyOrderRequestSchema>;

// =============================================================================
// Cancel Order Request
// =============================================================================

export const CancelOrderRequestSchema = z.object({
  orderId: z.string(),
});

export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;
