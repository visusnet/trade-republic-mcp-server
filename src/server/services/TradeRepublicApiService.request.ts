/**
 * Trade Republic API Service - Request Schemas (Zod)
 */

import { z } from 'zod';

/**
 * E.164 phone number format regex
 * Examples: +49123456789, +1234567890
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Credentials schema for login
 */
export const CredentialsSchema = z.object({
  /** Phone number in E.164 format */
  phoneNumber: z
    .string()
    .regex(
      E164_PHONE_REGEX,
      'Phone number must be in E.164 format (e.g., +49123456789)',
    ),
  /** 4-digit PIN */
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export type CredentialsInput = z.input<typeof CredentialsSchema>;

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
