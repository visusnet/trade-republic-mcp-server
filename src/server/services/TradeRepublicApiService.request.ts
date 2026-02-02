/**
 * Trade Republic API Service - Request Schemas (Zod)
 */

import { z } from 'zod';

/**
 * Two-factor authentication code schema
 */
export const TwoFactorCodeSchema = z.object({
  /** 4-digit verification code */
  code: z.string().regex(/^\d{4}$/, 'Code must be exactly 4 digits'),
});

export type TwoFactorCodeInput = z.input<typeof TwoFactorCodeSchema>;

/**
 * WebSocket subscription request schema
 */
export const SubscribeRequestSchema = z.object({
  /** Subscription topic (e.g., 'instrument', 'timeline') */
  topic: z.string().min(1, 'Topic cannot be empty'),
  /** Optional payload for the subscription */
  payload: z.record(z.unknown()).optional(),
});

export type SubscribeRequestInput = z.input<typeof SubscribeRequestSchema>;

/**
 * Request schema for entering two-factor authentication code
 */
export const EnterTwoFactorCodeRequestSchema = z
  .object({
    /** The 2FA code received via SMS */
    code: z
      .string()
      .min(1, 'Code is required')
      .describe('The 2FA code received via SMS'),
  })
  .describe('Request to enter the two-factor authentication code');

export type EnterTwoFactorCodeRequest = z.output<
  typeof EnterTwoFactorCodeRequestSchema
>;
