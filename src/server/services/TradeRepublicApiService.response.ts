/**
 * Trade Republic API Service - Response Schemas (Zod)
 */

import { z } from 'zod';

/**
 * Login response schema
 * Returned after initiating login with phone/PIN
 */
export const LoginResponseSchema = z.object({
  /** Process ID for completing 2FA */
  processId: z.string(),
});

export type LoginResponse = z.output<typeof LoginResponseSchema>;

/**
 * Token response schema
 * Returned after successful 2FA verification
 */
export const TokenResponseSchema = z.object({
  /** Refresh token for obtaining new session tokens */
  refreshToken: z.string(),
  /** Session token for WebSocket authentication */
  sessionToken: z.string(),
});

export type TokenResponse = z.output<typeof TokenResponseSchema>;

/**
 * Error response schema
 * Returned when API request fails
 */
export const ErrorResponseSchema = z.object({
  /** Error code */
  errorCode: z.string().optional(),
  /** Error message */
  errorMessage: z.string().optional(),
  /** Human-readable error description */
  message: z.string().optional(),
});

export type ErrorResponse = z.output<typeof ErrorResponseSchema>;

/**
 * Refresh token response schema
 * Returned when refreshing session token
 */
export const RefreshTokenResponseSchema = z.object({
  /** New session token */
  sessionToken: z.string(),
});

export type RefreshTokenResponse = z.output<typeof RefreshTokenResponseSchema>;
