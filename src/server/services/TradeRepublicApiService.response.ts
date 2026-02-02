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
 * Response schema for entering two-factor authentication code
 */
export const EnterTwoFactorCodeResponseSchema = z
  .object({
    /** Result message indicating success or failure */
    message: z
      .string()
      .describe('Result message indicating success or failure'),
  })
  .describe('Response from entering the two-factor authentication code');

export type EnterTwoFactorCodeResponse = z.output<
  typeof EnterTwoFactorCodeResponseSchema
>;
