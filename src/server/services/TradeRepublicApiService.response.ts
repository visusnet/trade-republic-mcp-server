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
 * Single error item in the errors array
 */
const ErrorItemSchema = z.object({
  /** Error code like PIN_INVALID, 2FA_INVALID, etc. */
  errorCode: z.string(),
  /** Error message (often null) */
  errorMessage: z.string().nullable().optional(),
  /** Metadata about the error */
  meta: z.record(z.unknown()).optional(),
});

/**
 * Error response schema
 * Returned when API request fails
 * Trade Republic returns errors in an array format
 */
export const ErrorResponseSchema = z.object({
  /** Array of error objects */
  errors: z.array(ErrorItemSchema).optional(),
  /** Legacy: Error code (for backwards compatibility) */
  errorCode: z.string().optional(),
  /** Legacy: Error message */
  errorMessage: z.string().nullable().optional(),
  /** Legacy: Human-readable error description */
  message: z.string().optional(),
});

export type ErrorResponse = z.output<typeof ErrorResponseSchema>;

/**
 * Extract a human-readable error message from an error response
 */
export function extractErrorMessage(
  errorData: unknown,
  fallback: string,
): string {
  const parsed = ErrorResponseSchema.safeParse(errorData);
  if (!parsed.success) {
    return fallback;
  }

  const data = parsed.data;

  // Check errors array first (new format)
  if (data.errors && data.errors.length > 0) {
    const firstError = data.errors[0];
    return firstError.errorMessage || firstError.errorCode || fallback;
  }

  // Fall back to legacy format
  return data.message || data.errorMessage || data.errorCode || fallback;
}

/**
 * Response schema for entering two-factor authentication code
 */
export const EnterTwoFactorCodeResponseSchema = z
  .object({
    message: z
      .string()
      .describe('Result message indicating success or failure'),
  })
  .describe('Response from entering the two-factor authentication code');

export type EnterTwoFactorCodeResponse = z.output<
  typeof EnterTwoFactorCodeResponseSchema
>;
